#!/usr/bin/env node

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { program } = require('commander');
const { Builder } = require('xml2js');

const DEFAULT_TILE_SIZE = 256;

class OpenSeadragonConverter {
  constructor(options = {}) {
    this.tileSize = options.tileSize || DEFAULT_TILE_SIZE;
    this.format = options.format || 'jpg'; // 'jpg' or 'webp'
    this.quality = options.quality || 85;
    this.targetWidth = options.targetWidth || null;
    this.targetHeight = options.targetHeight || null;
  }

  /**
   * Convert a single image to DZI format
   */
  async convert(inputPath, outputDir) {
    try {
      // Create output directory structure FIRST
      await this.createOutputStructure(outputDir);

      // Read input image
      const image = sharp(inputPath);
      let metadata = await image.metadata();
      
      console.log(`Processing image: ${inputPath}`);
      console.log(`Original dimensions: ${metadata.width}x${metadata.height}`);

      // Resize if target dimensions specified
      if (this.targetWidth || this.targetHeight) {
        const resizeOptions = {
          fit: 'fill',
          withoutEnlargement: false
        };
        
        const resizedPath = path.join(outputDir, 'resized.jpg');
        await sharp(inputPath)
          .resize(this.targetWidth, this.targetHeight, resizeOptions)
          .toFile(resizedPath);

        metadata = await sharp(resizedPath).metadata();
        console.log(`Resized dimensions: ${metadata.width}x${metadata.height}`);
        inputPath = resizedPath;
      }

      // Generate tiles
      const tilesDir = path.join(outputDir, 'tiles');
      await this.generateTiles(inputPath, metadata, tilesDir);

      // Generate DZI XML descriptor
      const dziPath = path.join(outputDir, `image.dzi`);
      await this.generateDZI(metadata, dziPath);

      // Generate info.json for compatibility
      const infoPath = path.join(outputDir, 'info.json');
      await this.generateInfo(metadata, infoPath);

      console.log(`✓ Conversion completed successfully!`);
      console.log(`✓ Output directory: ${outputDir}`);
      console.log(`✓ Format: ${this.format.toUpperCase()}`);
      console.log(`✓ Tile size: ${this.tileSize}x${this.tileSize}`);
      if (this.targetWidth || this.targetHeight) {
        console.log(`✓ Target size: ${this.targetWidth}x${this.targetHeight}`);
      }

    } catch (error) {
      console.error('Error during conversion:', error);
      throw error;
    }
  }

  /**
   * Create output directory structure
   */
  async createOutputStructure(outputDir) {
    try {
      await fs.mkdir(outputDir, { recursive: true });
      await fs.mkdir(path.join(outputDir, 'tiles'), { recursive: true });
    } catch (error) {
      console.error('Error creating output structure:', error);
      throw error;
    }
  }

  /**
   * Generate tiles from image
   */
  async generateTiles(inputPath, metadata, tilesDir) {
    const levels = this.calculateZoomLevels(metadata.width, metadata.height);
    
    console.log(`\nGenerating ${levels} zoom levels...`);

    for (let level = 0; level < levels; level++) {
      const levelDir = path.join(tilesDir, level.toString());
      await fs.mkdir(levelDir, { recursive: true });

      // Calculate dimensions for this zoom level
      const scaleFactor = Math.pow(2, levels - 1 - level);
      const levelWidth = Math.ceil(metadata.width / scaleFactor);
      const levelHeight = Math.ceil(metadata.height / scaleFactor);

      // Calculate number of tiles needed
      const tilesX = Math.ceil(levelWidth / this.tileSize);
      const tilesY = Math.ceil(levelHeight / this.tileSize);

      console.log(`  Level ${level}: ${levelWidth}x${levelHeight} (${tilesX}x${tilesY} tiles)`);

      // Generate tiles for this level
      await this.generateLevelTiles(inputPath, levelDir, tilesX, tilesY, levelWidth, levelHeight, level);
    }
  }

  /**
   * Generate tiles for a specific level
   */
  async generateLevelTiles(inputPath, levelDir, tilesX, tilesY, levelWidth, levelHeight, level) {
    // Read and resize the image once per level
    const resizedBuffer = await sharp(inputPath)
      .resize(levelWidth, levelHeight, {
        fit: 'fill',
        withoutEnlargement: true
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = resizedBuffer;

    for (let y = 0; y < tilesY; y++) {
      for (let x = 0; x < tilesX; x++) {
        const tileLeft = x * this.tileSize;
        const tileTop = y * this.tileSize;
        const tileWidth = Math.min(this.tileSize, levelWidth - tileLeft);
        const tileHeight = Math.min(this.tileSize, levelHeight - tileTop);

        // Extract tile region from buffer
        const tileBuffer = this.extractTileFromBuffer(
          data,
          info,
          tileLeft,
          tileTop,
          tileWidth,
          tileHeight
        );

        // Save tile with format: ${level}-${x}-${y}
        const fileName = `${level}-${x}-${y}.${this.format === 'webp' ? 'webp' : 'jpg'}`;
        const tilePath = path.join(levelDir, fileName);

        let pipeline = sharp(tileBuffer, {
          raw: {
            width: tileWidth,
            height: tileHeight,
            channels: info.channels,
            depth: 'uchar'
          }
        });

        if (this.format === 'webp') {
          await pipeline.webp({ quality: this.quality }).toFile(tilePath);
        } else {
          await pipeline.jpeg({ quality: this.quality }).toFile(tilePath);
        }
      }
    }
  }

  /**
   * Extract a tile region from a raw image buffer
   */
  extractTileFromBuffer(buffer, info, tileLeft, tileTop, tileWidth, tileHeight) {
    const channels = info.channels;
    const bytesPerPixel = channels;
    const stride = info.width * bytesPerPixel;

    const tileSize = tileWidth * tileHeight * bytesPerPixel;
    const tileBuffer = Buffer.allocUnsafe(tileSize);

    let tileIdx = 0;
    for (let y = 0; y < tileHeight; y++) {
      const srcY = tileTop + y;
      const srcOffset = srcY * stride + tileLeft * bytesPerPixel;
      const rowSize = tileWidth * bytesPerPixel;
      
      buffer.copy(tileBuffer, tileIdx, srcOffset, srcOffset + rowSize);
      tileIdx += rowSize;
    }

    return tileBuffer;
  }

  /**
   * Calculate number of zoom levels
   */
  calculateZoomLevels(width, height) {
    const maxDim = Math.max(width, height);
    return Math.ceil(Math.log2(maxDim / this.tileSize)) + 1;
  }

  /**
   * Generate DZI XML descriptor
   */
  async generateDZI(metadata, outputPath) {
    const builder = new Builder();
    const dziObj = {
      Image: {
        $: {
          xmlns: 'http://schemas.microsoft.com/deepzoom/2008',
          TileSize: this.tileSize.toString(),
          Overlap: '0',
          Format: this.format === 'webp' ? 'webp' : 'jpg'
        },
        Size: {
          Width: metadata.width.toString(),
          Height: metadata.height.toString()
        }
      }
    };

    const xml = builder.buildObject(dziObj);
    await fs.writeFile(outputPath, xml, 'utf8');
    console.log(`✓ Generated DZI descriptor: ${outputPath}`);
  }

  /**
   * Generate info.json for IIIF/web compatibility
   */
  async generateInfo(metadata, outputPath) {
    const infoObj = {
      "@context": "http://iiif.io/api/image/2/context.json",
      "@id": "image",
      "protocol": "http://iiif.io/api/image",
      "width": metadata.width,
      "height": metadata.height,
      "tiles": [
        {
          "width": this.tileSize,
          "scaleFactors": this.generateScaleFactors()
        }
      ],
      "sizes": this.generateSizes(metadata.width, metadata.height)
    };

    await fs.writeFile(outputPath, JSON.stringify(infoObj, null, 2), 'utf8');
    console.log(`✓ Generated info.json: ${outputPath}`);
  }

  /**
   * Generate scale factors for info.json
   */
  generateScaleFactors() {
    const factors = [1];
    let factor = 2;
    while (factor <= 32) {
      factors.push(factor);
      factor *= 2;
    }
    return factors;
  }

  /**
   * Generate sizes for info.json
   */
  generateSizes(width, height) {
    const sizes = [];
    let w = width;
    let h = height;
    
    while (w >= 150 && h >= 150) {
      sizes.push({
        width: Math.ceil(w),
        height: Math.ceil(h)
      });
      w /= 2;
      h /= 2;
    }
    
    return sizes.reverse();
  }

  /**
   * Convert batch of images from a directory
   */
  async convertDirectory(inputDir, outputDir) {
    try {
      const files = await fs.readdir(inputDir);
      const imageFiles = files.filter(f => 
        /\.(jpg|jpeg|png|webp)$/i.test(f)
      );

      console.log(`Found ${imageFiles.length} image files to convert\n`);

      for (const file of imageFiles) {
        const inputPath = path.join(inputDir, file);
        const outputName = path.parse(file).name;
        const outputSubDir = path.join(outputDir, outputName);

        await this.convert(inputPath, outputSubDir);
        console.log('');
      }

      console.log('✓ All conversions completed!');
    } catch (error) {
      console.error('Error during batch conversion:', error);
      throw error;
    }
  }
}

// CLI
program
  .name('openseadragon-converter')
  .description('Convert images to OpenSeadragon compatible DZI format')
  .version('1.0.0');

program
  .command('convert <input>')
  .description('Convert an image or directory to DZI format')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('-f, --format <format>', 'Output format: jpg or webp', 'jpg')
  .option('-q, --quality <number>', 'Image quality (1-100)', '85')
  .option('-t, --tile-size <number>', 'Tile size in pixels', '256')
  .option('-w, --width <number>', 'Target width (in pixels or tiles*256)')
  .option('--width-tiles <number>', 'Target width in tiles (e.g. 50 = 50*256 = 12800)')
  .option('-h, --height <number>', 'Target height (in pixels or tiles*256)')
  .option('--height-tiles <number>', 'Target height in tiles (e.g. 34 = 34*256 = 8704)')
  .action(async (input, options) => {
    try {
      const stat = await fs.stat(input);
      
      // Calculate target dimensions
      let targetWidth = null;
      let targetHeight = null;

      if (options.widthTiles) {
        targetWidth = parseInt(options.widthTiles) * DEFAULT_TILE_SIZE;
      } else if (options.width) {
        targetWidth = parseInt(options.width);
      }

      if (options.heightTiles) {
        targetHeight = parseInt(options.heightTiles) * DEFAULT_TILE_SIZE;
      } else if (options.height) {
        targetHeight = parseInt(options.height);
      }

      const converter = new OpenSeadragonConverter({
        tileSize: parseInt(options.tileSize),
        format: options.format.toLowerCase(),
        quality: parseInt(options.quality),
        targetWidth,
        targetHeight
      });

      if (stat.isDirectory()) {
        await converter.convertDirectory(input, options.output);
      } else {
        await converter.convert(input, options.output);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);

// Show help if no arguments
if (process.argv.length < 3) {
  program.help();
}

module.exports = OpenSeadragonConverter;
