// js/osd-drawing-plugin.js
(function (OpenSeadragon) {
  if (!OpenSeadragon) throw new Error('OpenSeadragon is required');

  const STROKE_WIDTH = 1.5;
  const svgNS = 'http://www.w3.org/2000/svg';
  const STORAGE_KEY = 'osd_drawing_strokes';

  OpenSeadragon.Viewer.prototype.initDrawingPlugin = function (options = {}) {
    const viewer = this;
    const storageKey = options.storageKey || STORAGE_KEY;

    // === SVG overlay ===
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('version', '1.1');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';

    // === 状态 ===
    let isDrawMode = false;
    let isDrawing = false;
    let currentPath = null;
    let currentPoints = [];
    let currentColor = '#ff3300';
    // strokes: [{points: [{x,y},...], color}]
    let strokes = [];
    let undoStack = []; // 记录撤销历史

    // === 持久化 ===
    const saveToStorage = () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(strokes));
      } catch (e) {}
    };

    const loadFromStorage = () => {
      try {
        const data = localStorage.getItem(storageKey);
        return data ? JSON.parse(data) : [];
      } catch (e) {
        return [];
      }
    };

    const renderStroke = (stroke) => {
      if (stroke.points.length < 2) return;
      const path = document.createElementNS(svgNS, 'path');
      const d = stroke.points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', stroke.color);
      path.setAttribute('stroke-width', STROKE_WIDTH + '');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(path);
      return path;
    };

    // === 坐标转换 ===
    const round = (n) => Math.round(n * 1000) / 1000;
    const toSVGCoords = (clientX, clientY) => {
      const rect = viewer.canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const vp = viewer.viewport.pointFromPixel(new OpenSeadragon.Point(px, py));
      const bounds = viewer.world.getHomeBounds();
      return {
        x: round(((vp.x - bounds.x) / bounds.width) * 100),
        y: round(((vp.y - bounds.y) / bounds.height) * 100)
      };
    };

    // === 更新按钮状态 ===
    const updateButtonStates = () => {
      const canUndo = strokes.length > 0;
      const canRedraw = undoStack.length > 0;

      if (window._drawingPluginCallbacks) {
        window._drawingPluginCallbacks.updateUndoButton?.(canUndo);
        window._drawingPluginCallbacks.updateRedrawButton?.(canRedraw);
        window._drawingPluginCallbacks.updateClearButton?.(canUndo || canRedraw);
      }
    };

    // === 加载历史笔迹 ===
    viewer.addHandler('open', () => {
      const bounds = viewer.world.getHomeBounds();
      viewer.addOverlay(svg, new OpenSeadragon.Rect(bounds.x, bounds.y, bounds.width, bounds.height));

      strokes = loadFromStorage();
      undoStack = [];
      strokes.forEach(renderStroke);
      updateButtonStates();
    });

    // === 绘图事件 ===
    svg.addEventListener('mousedown', (e) => {
      if (!isDrawMode) return;
      isDrawing = true;
      currentPoints = [];
      const p = toSVGCoords(e.clientX, e.clientY);
      currentPoints.push(p);

      currentPath = document.createElementNS(svgNS, 'path');
      currentPath.setAttribute('fill', 'none');
      currentPath.setAttribute('stroke', currentColor);
      currentPath.setAttribute('stroke-width', STROKE_WIDTH + '');
      currentPath.setAttribute('stroke-linecap', 'round');
      currentPath.setAttribute('stroke-linejoin', 'round');
      currentPath.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(currentPath);
    });

    svg.addEventListener('mousemove', (e) => {
      if (!isDrawing || !currentPath) return;
      const p = toSVGCoords(e.clientX, e.clientY);
      currentPoints.push(p);
      const d = currentPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
      currentPath.setAttribute('d', d);
    });

    const stopDrawing = () => {
      if (isDrawing && currentPoints.length >= 2) {
        const stroke = { points: currentPoints, color: currentColor };
        strokes.push(stroke);
        undoStack = []; // 新的笔画后清空重做栈
        saveToStorage();
        updateButtonStates();
      } else if (isDrawing && currentPath) {
        // 点太少，移除无效路径
        svg.removeChild(currentPath);
      }
      isDrawing = false;
      currentPath = null;
    };

    svg.addEventListener('mouseup', stopDrawing);
    svg.addEventListener('mouseleave', stopDrawing);

    // === 公开 API ===
    const plugin = {
      setMode(drawMode) {
        isDrawMode = drawMode;
        viewer.setMouseNavEnabled(!isDrawMode);
        svg.style.pointerEvents = isDrawMode ? 'auto' : 'none';
      },
      setColor(color) {
        currentColor = color;
      },
      getColor() {
        return currentColor;
      },
      undo() {
        if (strokes.length === 0) return;
        const removedStroke = strokes.pop();
        undoStack.push(removedStroke); // 放入撤销栈

        // 移除最后一个 path
        const paths = svg.querySelectorAll('path');
        if (paths.length > 0) svg.removeChild(paths[paths.length - 1]);

        saveToStorage();
        updateButtonStates();
      },
      redraw() {
        if (undoStack.length === 0) return;
        const restoredStroke = undoStack.pop();
        strokes.push(restoredStroke);

        // 重新渲染被恢复的笔画
        renderStroke(restoredStroke);

        saveToStorage();
        updateButtonStates();
      },
      clear() {
        strokes = [];
        undoStack = [];
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        saveToStorage();
        updateButtonStates();
      },
      isInDrawMode() {
        return isDrawMode;
      },
      canUndo() {
        return strokes.length > 0;
      },
      canRedraw() {
        return undoStack.length > 0;
      }
    };

    viewer.drawingPlugin = plugin;
    return plugin;
  };

}(OpenSeadragon));
