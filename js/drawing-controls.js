// js/drawing-controls.js
const DrawingControls = (() => {
  const prefixUrl = './libs/openseadragon/images/';
  const states = ['rest', 'grouphover', 'hover', 'pressed'];

  const preloadImages = () => Promise.all(
    states.map(s => new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(img);
      img.src = `${prefixUrl}button_${s}.png`;
    }))
  );

  const makeIcons = (imgMap, text) => {
    const urls = {};
    states.forEach(state => {
      const canvas = document.createElement('canvas');
      canvas.width  = imgMap[state].naturalWidth  || 34;
      canvas.height = imgMap[state].naturalHeight || 34;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgMap[state], 0, 0);
      ctx.fillStyle = '#2e2e2e';
      ctx.font = `bold ${Math.floor(canvas.height * 0.55)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      urls[state] = canvas.toDataURL();
    });
    return urls;
  };

  const makeActiveIcons = (imgMap, text) => {
    const urls = {};
    states.forEach(state => {
      const canvas = document.createElement('canvas');
      canvas.width  = imgMap.pressed.naturalWidth  || 34;
      canvas.height = imgMap.pressed.naturalHeight || 34;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgMap.pressed, 0, 0);
      ctx.fillStyle = '#2e2e2e';
      ctx.font = `bold ${Math.floor(canvas.height * 0.55)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      urls[state] = canvas.toDataURL();
    });
    return urls;
  };

  const createOsdBtn = (imgMap, text, tooltip, onClick) => {
    const icons = makeIcons(imgMap, text);
    return new OpenSeadragon.Button({
      tooltip,
      srcRest:  icons.rest,
      srcGroup: icons.grouphover,
      srcHover: icons.hover,
      srcDown:  icons.pressed,
      onClick
    });
  };

  const setButtonActive = (btn, imgMap, text, active) => {
    const icons = active ? makeActiveIcons(imgMap, text) : makeIcons(imgMap, text);
    btn.imgRest.src  = icons.rest;
    btn.imgGroup.src = icons.grouphover;
    btn.imgHover.src = icons.hover;
    btn.imgDown.src  = icons.pressed;
  };

  const init = (viewer, drawing, mapContainer) => {
    let isOpen = false;
    let btnGroup = null;
    let undoBtnOsd, redrawBtnOsd, clearBtnOsd, colorBtnOsd;
    let moveBtnOsd, drawBtnOsd;
    let cachedImgMap = null;
    let separator = null;

    // === 颜色面板 ===
    const COLORS = [
      '#292A2E','#1558BC','#206A83','#216E4E',
      '#E06C00','#AE2E24','#803FA5','#7D818A',
      '#357DE8','#2898BD','#22A06B','#FCA700',
      '#C9372C','#AF59E1','#CFE1FD','#C6EDFB',
      '#BAF3DB','#F5E989','#FFD5D2','#EED7FC'
    ];
    let currentSwatch = null;

    // 同步初始颜色到 plugin
    drawing.setColor(COLORS[0]);

    const colorPanel = document.createElement('div');
    colorPanel.style.cssText = `position:absolute;z-index:9999;background:rgba(30,30,30,0.95);border:1px solid #888;border-radius:6px;padding:8px;display:none;gap:6px;flex-wrap:wrap;width:162px;`;
    mapContainer.appendChild(colorPanel);

    const colorDot = document.createElement('div');
    colorDot.style.cssText = `
      position:absolute;
      top:calc(50% - 2px);left:50%;
      transform:translate(-50%,-50%);
      width:25px;height:25px;
      border-radius:3px;
      background:${COLORS[0]};
      border:1px solid #fff;
      pointer-events:none;
      z-index:10;`;

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
      if (color === COLORS[0]) { swatch.style.borderColor = '#fff'; currentSwatch = swatch; }
      colorPanel.appendChild(swatch);
    });

    viewer.canvas.addEventListener('mousedown', () => { colorPanel.style.display = 'none'; });

    // === 按钮状态 ===
    const updateButtonState = () => {
      if (!undoBtnOsd) return;
      const canUndo   = drawing.canUndo();
      const canRedraw = drawing.canRedraw();
      canUndo   ? undoBtnOsd.enable()   : undoBtnOsd.disable();
      canRedraw ? redrawBtnOsd.enable() : redrawBtnOsd.disable();
      (canUndo || canRedraw) ? clearBtnOsd.enable() : clearBtnOsd.disable();

      [undoBtnOsd, redrawBtnOsd, clearBtnOsd].forEach(btn => {
        btn.element.style.opacity = btn.element.disabled ? '0.6' : '1';
      });
    };

    window._drawingPluginCallbacks = {
      updateUndoButton:   updateButtonState,
      updateRedrawButton: updateButtonState,
      updateClearButton:  updateButtonState
    };

    // === 模式切换 ===
    const setDrawMode = (drawMode) => {
      drawing.setMode(drawMode);

      if (cachedImgMap) {
        setButtonActive(moveBtnOsd, cachedImgMap, '✥', !drawMode);
        setButtonActive(drawBtnOsd, cachedImgMap, '✎',  drawMode);
      }

      [undoBtnOsd, redrawBtnOsd, clearBtnOsd, colorBtnOsd].forEach(b => {
        if (b) b.element.style.display = drawMode ? 'inline-block' : 'none';
      });
      if (separator) separator.style.display = drawMode ? 'inline-block' : 'none';
      if (!drawMode) colorPanel.style.display = 'none';
      updateButtonState();
    };

    // === 注册到 OSD ===
    const tryRegister = () => {
      if (!isOpen || !btnGroup) return;

      separator = document.createElement('div');
      separator.style.cssText = `
        display:inline-block;
        width:3px;
        height:25px;
        background:rgba(0,0,0,0.5);
        margin:0 8px;
        vertical-align:middle;
      `;
      drawBtnOsd.element.insertAdjacentElement('afterend', separator);

      viewer.addControl(btnGroup.element, {
        anchor: OpenSeadragon.ControlAnchor.BOTTOM_LEFT
      });

      [undoBtnOsd, redrawBtnOsd, clearBtnOsd, colorBtnOsd].forEach(b => {
        b.element.style.display = 'none';
      });
      separator.style.display = 'none';

      if (cachedImgMap) {
        setButtonActive(moveBtnOsd, cachedImgMap, '✥', true);
        setButtonActive(drawBtnOsd, cachedImgMap, '✎', false);
      }
      updateButtonState();
    };

    viewer.addHandler('open', () => {
      isOpen = true;
      tryRegister();
    });

    // === 预加载底图后创建按钮 ===
    preloadImages().then(imgs => {
      const imgMap = {};
      states.forEach((s, i) => { imgMap[s] = imgs[i]; });
      cachedImgMap = imgMap;

      moveBtnOsd = createOsdBtn(imgMap, '✥', '移动模式', () => setDrawMode(false));
      drawBtnOsd = createOsdBtn(imgMap, '✎', '绘画模式', () => setDrawMode(true));
      undoBtnOsd   = createOsdBtn(imgMap, '↩', '撤销', () => { if (drawing.canUndo())   { drawing.undo();   updateButtonState(); } });
      redrawBtnOsd = createOsdBtn(imgMap, '↪', '重做', () => { if (drawing.canRedraw()) { drawing.redraw(); updateButtonState(); } });
      clearBtnOsd  = createOsdBtn(imgMap, '🗑', '清空', () => {
        if ((drawing.canUndo() || drawing.canRedraw()) && confirm('确定要清空所有绘制吗？')) {
          drawing.clear(); updateButtonState();
        }
      });
      colorBtnOsd = createOsdBtn(imgMap, '', '选色', (e) => {
        if (e?.originalEvent) e.originalEvent.stopPropagation();
        if (colorPanel.style.display === 'flex') {
          colorPanel.style.display = 'none';
          return;
        }
        const rect = colorDot.getBoundingClientRect();
        const cr   = mapContainer.getBoundingClientRect();
        colorPanel.style.visibility = 'hidden';
        colorPanel.style.display = 'flex';
        const panelHeight = colorPanel.offsetHeight;
        colorPanel.style.visibility = '';
        colorPanel.style.left = (rect.left - cr.left) + 'px';
        colorPanel.style.top  = (rect.top - cr.top - panelHeight - 4) + 'px';
      });

      colorBtnOsd.element.style.position = 'absolute';
      colorBtnOsd.element.style.left = '65px';
      colorBtnOsd.element.style.bottom = '50px';
      colorBtnOsd.element.appendChild(colorDot);

      btnGroup = new OpenSeadragon.ButtonGroup({
        buttons: [moveBtnOsd, drawBtnOsd, undoBtnOsd, redrawBtnOsd, clearBtnOsd, colorBtnOsd]
      });

      tryRegister();
    });
  };

  return { init };
})();
