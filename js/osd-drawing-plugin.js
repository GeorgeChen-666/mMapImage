// js/osd-drawing-plugin.js
(function (OpenSeadragon) {
  if (!OpenSeadragon) throw new Error('OpenSeadragon is required');

  const STROKE_WIDTH = 2;
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
    let currentColor = '';
    let strokes = [];
    let undoStack = [];

    // === 持久化 ===
    const saveToStorage = () => {
      try { localStorage.setItem(storageKey, JSON.stringify(strokes)); } catch (e) {}
    };

    const loadFromStorage = () => {
      try {
        const data = localStorage.getItem(storageKey);
        return data ? JSON.parse(data) : [];
      } catch (e) { return []; }
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
      if (window._drawingPluginCallbacks) {
        window._drawingPluginCallbacks.updateUndoButton?.();
        window._drawingPluginCallbacks.updateRedrawButton?.();
        window._drawingPluginCallbacks.updateClearButton?.();
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

    // === 事件辅助 ===
    const getPoint = (e) => {
      if (e.touches && e.touches.length > 0) {
        return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
      }
      return { clientX: e.clientX, clientY: e.clientY };
    };

    // === 绘图事件 ===
    const startDrawing = (e) => {
      if (!isDrawMode) return;
      e.preventDefault();
      isDrawing = true;
      currentPoints = [];
      const { clientX, clientY } = getPoint(e);
      const p = toSVGCoords(clientX, clientY);
      currentPoints.push(p);

      currentPath = document.createElementNS(svgNS, 'path');
      currentPath.setAttribute('fill', 'none');
      currentPath.setAttribute('stroke', currentColor);
      currentPath.setAttribute('stroke-width', STROKE_WIDTH + '');
      currentPath.setAttribute('stroke-linecap', 'round');
      currentPath.setAttribute('stroke-linejoin', 'round');
      currentPath.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(currentPath);
    };

    const moveDrawing = (e) => {
      if (!isDrawing || !currentPath) return;
      e.preventDefault();
      const { clientX, clientY } = getPoint(e);
      const p = toSVGCoords(clientX, clientY);
      currentPoints.push(p);
      const d = currentPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
      currentPath.setAttribute('d', d);
    };

    const stopDrawing = () => {
      if (isDrawing && currentPoints.length >= 2) {
        const stroke = { points: currentPoints, color: currentColor };
        strokes.push(stroke);
        undoStack = [];
        saveToStorage();
        updateButtonStates();
      } else if (isDrawing && currentPath) {
        svg.removeChild(currentPath);
      }
      isDrawing = false;
      currentPath = null;
    };

    // mouse
    svg.addEventListener('mousedown',  startDrawing);
    svg.addEventListener('mousemove',  moveDrawing);
    svg.addEventListener('mouseup',    stopDrawing);
    svg.addEventListener('mouseleave', stopDrawing);

    // touch
    svg.addEventListener('touchstart',  startDrawing, { passive: false });
    svg.addEventListener('touchmove',   moveDrawing,  { passive: false });
    svg.addEventListener('touchend',    stopDrawing);
    svg.addEventListener('touchcancel', stopDrawing);

    // === 公开 API ===
    const plugin = {
      setMode(drawMode) {
        isDrawMode = drawMode;
        viewer.setMouseNavEnabled(!isDrawMode);
        viewer.gestureSettingsTouch.dragToPan   = !drawMode;
        viewer.gestureSettingsTouch.pinchToZoom = !drawMode;
        svg.style.pointerEvents = isDrawMode ? 'auto' : 'none';
      },
      setColor(color) { currentColor = color; },
      getColor() { return currentColor; },
      undo() {
        if (strokes.length === 0) return;
        const removedStroke = strokes.pop();
        undoStack.push(removedStroke);
        const paths = svg.querySelectorAll('path');
        if (paths.length > 0) svg.removeChild(paths[paths.length - 1]);
        saveToStorage();
        updateButtonStates();
      },
      redraw() {
        if (undoStack.length === 0) return;
        const restoredStroke = undoStack.pop();
        strokes.push(restoredStroke);
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
      isInDrawMode() { return isDrawMode; },
      canUndo()   { return strokes.length > 0; },
      canRedraw() { return undoStack.length > 0; }
    };

    viewer.drawingPlugin = plugin;
    return plugin;
  };

}(OpenSeadragon));
