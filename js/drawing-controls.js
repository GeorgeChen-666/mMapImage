// js/drawing-controls.js
const DrawingControls = (() => {
  const imgPrefix = './imgs/';

  const imgSrcs = {
    move:  { rest: 'move_rest.png',  grouphover: 'move_grouphover.png',  hover: 'move_hover.png',  pressed: 'move_pressed.png'  },
    pen:   { rest: 'pen_rest.png',   grouphover: 'pen_grouphover.png',   hover: 'pen_hover.png',   pressed: 'pen_pressed.png'   },
    rl:    { rest: 'rl_rest.png',    grouphover: 'rl_grouphover.png',    hover: 'rl_hover.png',    pressed: 'rl_pressed.png'    },
    rr:    { rest: 'rr_rest.png',    grouphover: 'rr_grouphover.png',    hover: 'rr_hover.png',    pressed: 'rr_pressed.png'    },
    trash: { rest: 'trash_rest.png', grouphover: 'trash_grouphover.png', hover: 'trash_hover.png', pressed: 'trash_pressed.png' },
  };

  const src = (name, state) => imgPrefix + imgSrcs[name][state];

  const createImgBtn = (name, tooltip, onClick) => {
    return new OpenSeadragon.Button({
      tooltip,
      srcRest:  src(name, 'rest'),
      srcGroup: src(name, 'grouphover'),
      srcHover: src(name, 'hover'),
      srcDown:  src(name, 'pressed'),
      onClick
    });
  };

  const setButtonActive = (btn, name, active) => {
    btn.imgRest.src  = active ? src(name, 'pressed') : src(name, 'rest');
    btn.imgGroup.src = active ? src(name, 'pressed') : src(name, 'grouphover');
    btn.imgHover.src = active ? src(name, 'pressed') : src(name, 'hover');
    btn.imgDown.src  = src(name, 'pressed');
  };

  const init = (viewer, drawing, mapContainer) => {
    let isOpen = false;
    let btnGroup = null;
    let undoBtnOsd, redrawBtnOsd, clearBtnOsd, colorBtnOsd;
    let moveBtnOsd, drawBtnOsd;
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

    viewer.canvas.addEventListener('mousedown',  () => { colorPanel.style.display = 'none'; });
    viewer.canvas.addEventListener('touchstart', () => { colorPanel.style.display = 'none'; }, { passive: true });

    // === 屏蔽右键菜单，绘图模式下右键退回移动模式 ===
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (drawing.isInDrawMode()) setDrawMode(false);
    });

    // === 键盘快捷键 ===
    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.key === 'Escape') {
        if (drawing.isInDrawMode()) setDrawMode(false);
      } else if (e.key === 'Shift') {
        setDrawMode(!drawing.isInDrawMode());
      }
    });

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

      viewer.canvas.style.cursor = drawMode ? 'crosshair' : 'move';

      setButtonActive(moveBtnOsd, 'move', !drawMode);
      setButtonActive(drawBtnOsd, 'pen',   drawMode);

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
      viewer.canvas.style.cursor = 'move';
      separator.style.display = 'none';

      setButtonActive(moveBtnOsd, 'move', true);
      setButtonActive(drawBtnOsd, 'pen',  false);
      updateButtonState();
    };

    viewer.addHandler('open', () => {
      isOpen = true;
      tryRegister();
    });

    // === 创建按钮 ===
    moveBtnOsd   = createImgBtn('move',  '移动模式', () => setDrawMode(false));
    drawBtnOsd   = createImgBtn('pen',   '绘画模式', () => setDrawMode(true));
    undoBtnOsd   = createImgBtn('rl',    '撤销',     () => { if (drawing.canUndo())   { drawing.undo();   updateButtonState(); } });
    redrawBtnOsd = createImgBtn('rr',    '重做',     () => { if (drawing.canRedraw()) { drawing.redraw(); updateButtonState(); } });
    clearBtnOsd  = createImgBtn('trash', '清空',     () => {
      if ((drawing.canUndo() || drawing.canRedraw()) && confirm('确定要清空所有绘制吗？')) {
        drawing.clear(); updateButtonState();
      }
    });

    // 颜色按钮仍用 OSD 默认底图
    const prefixUrl = './libs/openseadragon/images/';
    colorBtnOsd = new OpenSeadragon.Button({
      tooltip:  '选色',
      srcRest:  prefixUrl + 'button_rest.png',
      srcGroup: prefixUrl + 'button_grouphover.png',
      srcHover: prefixUrl + 'button_hover.png',
      srcDown:  prefixUrl + 'button_pressed.png',
      onClick: (e) => {
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
      }
    });

    colorBtnOsd.element.style.position = 'absolute';
    colorBtnOsd.element.style.left = '65px';
    colorBtnOsd.element.style.bottom = '50px';
    colorBtnOsd.element.appendChild(colorDot);

    btnGroup = new OpenSeadragon.ButtonGroup({
      buttons: [moveBtnOsd, drawBtnOsd, undoBtnOsd, redrawBtnOsd, clearBtnOsd, colorBtnOsd]
    });

    tryRegister();
  };

  return { init };
})();
