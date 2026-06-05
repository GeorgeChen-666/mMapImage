(function (OpenSeadragon) {
  if (!OpenSeadragon) throw new Error('OpenSeadragon is required');

  const STROKE_WIDTH = 2;
  const svgNS = 'http://www.w3.org/2000/svg';
  const STORAGE_KEY = 'osd_drawing_strokes';

  // ======================
  // 🔥 只加这个：采样频率
  // 1 = 全部保存
  // 2 = 每2个点存1个
  // 3 = 每3个点存1个（1/3密度）
  // ======================
  const SAMPLE_RATE = 5;

  OpenSeadragon.Viewer.prototype.initDrawingPlugin = function (options = {}) {
    const viewer = this;
    const storageKey = options.storageKey || STORAGE_KEY;

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('version', '1.1');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';

    let isDrawMode = false;
    let isDrawing = false;
    let currentPath = null;
    let currentPoints = [];
    let currentColor = '';
    let strokes = [];
    let undoStack = [];

    // 🔥 只加这个计数器
    let _sampleCounter = 0;

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

    const updateButtonStates = () => {
      if (window._drawingPluginCallbacks) {
        window._drawingPluginCallbacks.updateUndoButton?.();
        window._drawingPluginCallbacks.updateRedrawButton?.();
        window._drawingPluginCallbacks.updateClearButton?.();
      }
    };

    viewer.addHandler('open', () => {
      const bounds = viewer.world.getHomeBounds();
      viewer.addOverlay(svg, new OpenSeadragon.Rect(bounds.x, bounds.y, bounds.width, bounds.height));
      strokes = loadFromStorage();
      undoStack = [];
      strokes.forEach(renderStroke);
      updateButtonStates();
    });

    const getPoint = (e) => {
      if (e.touches && e.touches.length > 0) {
        return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
      }
      return { clientX: e.clientX, clientY: e.clientY };
    };

    const startDrawing = (e) => {
      if (!isDrawMode) return;
      e.preventDefault();
      isDrawing = true;
      currentPoints = [];
      _sampleCounter = 0; // 🔥 重置计数

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

    // ================================
    // 🔥 唯一修改：moveDrawing 采样控制
    // ================================
    const moveDrawing = (e) => {
      if (!isDrawing || !currentPath) return;
      e.preventDefault();

      const { clientX, clientY } = getPoint(e);
      const p = toSVGCoords(clientX, clientY);

      // 实时绘制（不变）
      const tempPoints = [...currentPoints, p];
      const d = tempPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
      currentPath.setAttribute('d', d);

      // 🔥 只在这里控制：每 SAMPLE_RATE 次存一次
      _sampleCounter++;
      if (_sampleCounter >= SAMPLE_RATE) {
        currentPoints.push(p);
        _sampleCounter = 0;
      }
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

    svg.addEventListener('mousedown', startDrawing);
    svg.addEventListener('mousemove', moveDrawing);
    svg.addEventListener('mouseup', stopDrawing);
    svg.addEventListener('mouseleave', stopDrawing);

    svg.addEventListener('touchstart', startDrawing, { passive: false });
    svg.addEventListener('touchmove', moveDrawing, { passive: false });
    svg.addEventListener('touchend', stopDrawing);
    svg.addEventListener('touchcancel', stopDrawing);

    const plugin = {
      setMode(drawMode) {
        isDrawMode = drawMode;
        viewer.setMouseNavEnabled(!isDrawMode);
        viewer.gestureSettingsTouch.dragToPan = !drawMode;
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
      canUndo() { return strokes.length > 0; },
      canRedraw() { return undoStack.length > 0; }
    };

    viewer.drawingPlugin = plugin;
    return plugin;
  };

}(OpenSeadragon));