// js/index.js
(() => {
  const showMap = (cat = 'map') => {
    const viewer = OpenSeadragon({
      id: 'zoomMap',
      prefixUrl: "./libs/openseadragon/images/",
      showNavigator: true,
      showFullPageControl: false,
      drawer: 'canvas',
      gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true },
      tileSources: {
        height: 256 * 34,
        width: 256 * 50,
        tileSize: 256,
        minLevel: 9,
        maxLevel: 12,
        getTileUrl: (level, x, y) => `./${cat}/${level - 6}/${level - 6}-${x}-${y}.jpg`
      }
    });

    const drawing = viewer.initDrawingPlugin({ storageKey: `osd_strokes_${cat}` });

    const mapContainer = document.getElementById('zoomMap');
    const btnStyle = `position:absolute;bottom:10px;z-index:200;padding:6px 12px;color:white;border:1px solid #888;border-radius:4px;cursor:pointer;font-size:14px;`;

    const createBtn = (text, left, bg, hidden = false) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.style.cssText = btnStyle + `left:${left}px;background:${bg};${hidden ? 'display:none;' : ''}`;
      mapContainer.appendChild(btn);
      return btn;
    };

    const moveBtn        = createBtn('✥',  10,  'rgba(180,60,60,0.8)');
    const drawBtn        = createBtn('✎️',  60,  'rgba(0,0,0,0.6)');
    const undoBtn        = createBtn('↩',  110, 'rgba(0,0,0,0.6)', true);
    const redrawBtn      = createBtn('↪',  160, 'rgba(0,0,0,0.6)', true);
    const clearBtn       = createBtn('⊠️', 210, 'rgba(180,60,60,0.8)', true);
    const colorPickerBtn = createBtn('',   260, 'rgba(0,0,0,0.6)', true);

    // 颜色按钮显示当前色块
    const colorDot = document.createElement('span');
    colorDot.style.cssText = `display:inline-block;width:14px;height:14px;border-radius:50%;background:#ff3300;border:1px solid #fff;vertical-align:middle;`;
    colorPickerBtn.appendChild(colorDot);

    // === 颜色面板 ===
    const COLORS = [
      '#ff3300','#ff6600','#ff9900','#ffcc00','#ffff00',
      '#99ff00','#00cc44','#00ffcc','#0099ff','#0044ff',
      '#6600ff','#cc44ff','#ff00cc','#ff3399','#ffffff',
      '#cccccc','#888888','#444444','#000000','#8B4513'
    ];
    let currentSwatch = null;

    const colorPanel = document.createElement('div');
    colorPanel.style.cssText = `position:absolute;z-index:201;bottom:52px;left:260px;background:rgba(30,30,30,0.95);border:1px solid #888;border-radius:6px;padding:8px;display:none;gap:6px;flex-wrap:wrap;width:162px;`;
    mapContainer.appendChild(colorPanel);

    COLORS.forEach(color => {
      const swatch = document.createElement('div');
      swatch.style.cssText = `width:24px;height:24px;border-radius:4px;cursor:pointer;background:${color};border:2px solid transparent;box-sizing:border-box;display:inline-block;`;
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        drawing.setColor(color);
        colorDot.style.background = color;
        if (currentSwatch) currentSwatch.style.borderColor = 'transparent';
        swatch.style.borderColor = '#fff';
        currentSwatch = swatch;
        colorPanel.style.display = 'none';
      });
      if (color === '#ff3300') { swatch.style.borderColor = '#fff'; currentSwatch = swatch; }
      colorPanel.appendChild(swatch);
    });

    colorPickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      colorPanel.style.display = colorPanel.style.display === 'flex' ? 'none' : 'flex';
    });

    viewer.canvas.addEventListener('mousedown', () => { colorPanel.style.display = 'none'; });

    // === 按钮状态 ===
    const setBtn = (btn, enabled) => {
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? '1' : '0.5';
      btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    };

    const updateButtonState = () => {
      const canUndo = drawing.canUndo();
      const canRedraw = drawing.canRedraw();
      setBtn(undoBtn, canUndo);
      setBtn(redrawBtn, canRedraw);
      setBtn(clearBtn, canUndo || canRedraw);
    };

    window._drawingPluginCallbacks = {
      updateUndoButton: updateButtonState,
      updateRedrawButton: updateButtonState,
      updateClearButton: updateButtonState
    };

    // === 模式切换 ===
    const setDrawMode = (drawMode) => {
      drawing.setMode(drawMode);
      moveBtn.style.background = drawMode ? 'rgba(0,0,0,0.6)' : 'rgba(180,60,60,0.8)';
      drawBtn.style.background = drawMode ? 'rgba(180,60,60,0.8)' : 'rgba(0,0,0,0.6)';
      [undoBtn, redrawBtn, clearBtn, colorPickerBtn].forEach(b => b.style.display = drawMode ? 'inline-block' : 'none');
      if (!drawMode) colorPanel.style.display = 'none';
      updateButtonState();
    };

    moveBtn.addEventListener('click', () => setDrawMode(false));
    drawBtn.addEventListener('click', () => setDrawMode(true));
    undoBtn.addEventListener('click', () => { if (!undoBtn.disabled) drawing.undo(); });
    redrawBtn.addEventListener('click', () => { if (!redrawBtn.disabled) drawing.redraw(); });
    clearBtn.addEventListener('click', () => {
      if (!clearBtn.disabled && confirm('确定要清空所有绘制吗？')) {
        drawing.clear();
        updateButtonState();
      }
    });

    updateButtonState();
  };

  const modal = document.getElementById('modal-1');
  modal.showModal();
  document.getElementById('btnGoTo1').addEventListener('click', () => { modal.close(); showMap(); });
  document.getElementById('btnGoTo2').addEventListener('click', () => { modal.close(); showMap('map2'); });
})();
