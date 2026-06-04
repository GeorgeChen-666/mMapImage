// js/cdn-controls.js
const CdnControls = (() => {

  const CDN_NODES = [
    // === jsDelivr 国内优选 ===
    {
      name: 'zzko',
      testUrl: 'http://jsd.cdn.zzko.cn/gh/GeorgeChen-666/mMapImage@master/map/3/3-0-0.jpg',
      getTileUrl: (cat, level, x, y) =>
        `http://jsd.cdn.zzko.cn/gh/GeorgeChen-666/mMapImage@master/${cat}/${level}/${level}-${x}-${y}.jpg`
    },
    {
      name: 'onmicrosoft',
      testUrl: 'http://jsd.onmicrosoft.cn/gh/GeorgeChen-666/mMapImage@master/map/3/3-0-0.jpg',
      getTileUrl: (cat, level, x, y) =>
        `http://jsd.onmicrosoft.cn/gh/GeorgeChen-666/mMapImage@master/${cat}/${level}/${level}-${x}-${y}.jpg`
    },
    {
      name: 'jsdmirror',
      testUrl: 'https://cdn.jsdmirror.com/gh/GeorgeChen-666/mMapImage@master/map/3/3-0-0.jpg',
      getTileUrl: (cat, level, x, y) =>
        `https://cdn.jsdmirror.com/gh/GeorgeChen-666/mMapImage@master/${cat}/${level}/${level}-${x}-${y}.jpg`
    },
    {
      name: 'duolaa',
      testUrl: 'https://jsd.duolaa.top/gh/GeorgeChen-666/mMapImage@master/map/3/3-0-0.jpg',
      getTileUrl: (cat, level, x, y) =>
        `https://jsd.duolaa.top/gh/GeorgeChen-666/mMapImage@master/${cat}/${level}/${level}-${x}-${y}.jpg`
    },
    {
      name: 'jsdelivr',
      testUrl: 'https://cdn.jsdelivr.net/gh/GeorgeChen-666/mMapImage@master/map/3/3-0-0.jpg',
      getTileUrl: (cat, level, x, y) =>
        `https://gcore.jsdelivr.net/gh/GeorgeChen-666/mMapImage@master/${cat}/${level}/${level}-${x}-${y}.jpg`
    },
    {
      name: 'bcdn',
      testUrl: 'https://jsdelivr.b-cdn.net/gh/GeorgeChen-666/mMapImage@master/map/3/3-0-0.jpg',
      getTileUrl: (cat, level, x, y) =>
        `https://jsdelivr.b-cdn.net/gh/GeorgeChen-666/mMapImage@master/${cat}/${level}/${level}-${x}-${y}.jpg`
    },
    {
      name: 'ghproxy',
      testUrl: 'https://ghproxy.net/https://raw.githubusercontent.com/GeorgeChen-666/mMapImage/master/map/3/3-0-0.jpg',
      getTileUrl: (cat, level, x, y) =>
        `https://ghproxy.net/https://raw.githubusercontent.com/GeorgeChen-666/mMapImage/master/${cat}/${level}/${level}-${x}-${y}.jpg`
    },
    {
      name: 'ghfast',
      testUrl: 'https://ghfast.top/https://raw.githubusercontent.com/GeorgeChen-666/mMapImage/master/map/3/3-0-0.jpg',
      getTileUrl: (cat, level, x, y) =>
        `https://ghfast.top/https://raw.githubusercontent.com/GeorgeChen-666/mMapImage/master/${cat}/${level}/${level}-${x}-${y}.jpg`
    },
    {
      name: 'local',
      testUrl: './map/3/3-0-0.jpg',
      getTileUrl: (cat, level, x, y) =>
        `./${cat}/${level}/${level}-${x}-${y}.jpg`
    },
  ];

  const STORAGE_KEY = 'cdn_selected_node';
  let activeNode = CDN_NODES[0];

  // 供 index.js 的 OSD getTileUrl 调用
  window.activeTileUrl = (cat, level, x, y) => activeNode.getTileUrl(cat, level, x, y);

  const testNode = (node) => {
    if (node.name === 'local') return Promise.resolve({ node, time: 0 });
    return new Promise((resolve) => {
      const url = node.testUrl + '?_t=' + Date.now();
      const start = performance.now();
      const img = new Image();
      const timer = setTimeout(() => { img.src = ''; resolve({ node, time: Infinity }); }, 5000);
      img.onload  = () => { clearTimeout(timer); resolve({ node, time: performance.now() - start }); };
      img.onerror = () => { clearTimeout(timer); resolve({ node, time: Infinity }); };
      img.src = url;
    });
  };

  // 手动触发，供 index.js 调用
  let _resolve;
  window.cdnReady = new Promise(resolve => { _resolve = resolve; });

  const startTest = async () => {
    console.log('[CDN测速] 开始测速...');

    const saved = localStorage.getItem(STORAGE_KEY);
    const isAuto = !saved || saved === '__auto__';
    let firstResolved = false;
    const results = [];

    const tasks = CDN_NODES.map(node => testNode(node).then(r => {
      results.push(r);

      // auto 模式：第一个完成的节点立即生效并 resolve cdnReady，不阻塞
      if (isAuto && !firstResolved && r.time !== Infinity) {
        firstResolved = true;
        activeNode = r.node;
        console.log(`[CDN测速] 首个可用节点: ${r.node.name} (${Math.round(r.time)}ms)`);
        _resolve({ valid: [r], timedOut: [], pending: true });
      }

      return r;
    }));

    // 后台等所有测速完成
    await Promise.all(tasks);

    const valid = results
      .filter(r => r.time !== Infinity)
      .sort((a, b) => a.time - b.time);

    const timedOut = results.filter(r => r.time === Infinity);

    [...valid, ...timedOut].forEach(r => {
      const ms   = r.time === Infinity ? 'timeout' : `${Math.round(r.time)}ms`;
      const flag = r === valid[0] ? ' ✅ 最快' : '';
      console.log(`[CDN测速] ${r.node.name}: ${ms}${flag}`);
    });

    // auto 模式：全部完成后切换到最快节点
    if (isAuto && valid.length > 0) {
      activeNode = valid[0].node;
      console.log(`[CDN测速] 最终采用节点: ${activeNode.name}`);
    }

    // 全超时兜底
    if (isAuto && !firstResolved && valid.length > 0) {
      _resolve({ valid, timedOut, pending: false });
    }

    // 非 auto 模式的 cdnReady（showMap 在等它）
    if (!isAuto) {
      _resolve({ valid, timedOut, pending: false });
    }

    // 通知下拉更新最终结果
    window.dispatchEvent(new CustomEvent('cdnTestComplete', { detail: { valid } }));
  };

  // 创建下拉并挂到 OSD TOP_LEFT 最左边
  const initSelector = (viewer) => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved !== '__auto__') {
      const found = CDN_NODES.find(n => n.name === saved);
      if (found) activeNode = found;
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = `
      display: inline-block;
      vertical-align: middle;
      margin: 4px 6px 0 4px;
    `;

    const select = document.createElement('select');
    select.className = 'cdn_dropdown';
    select.disabled = true; // 测速期间禁用
    select.style.cssText = `
      background: rgba(30,30,30,0.85);
      color: #fff;
      border: 1px solid #666;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 12px;
      cursor: pointer;
      max-width: 200px;
      height: 28px;
    `;

    // 占位，测速完成后更新
    const autoOpt = document.createElement('option');
    autoOpt.value = '__auto__';
    autoOpt.textContent = '[自动] 测速中...';
    select.appendChild(autoOpt);

    // 如果有 saved，先立即加一个选项显示当前选择
    if (saved && saved !== '__auto__') {
      const preOpt = document.createElement('option');
      preOpt.value = saved;
      preOpt.textContent = `${saved}  (测速中...)`;
      select.appendChild(preOpt);
      select.value = saved;
    }

    select.addEventListener('change', () => {
      if (select.value === '__auto__') {
        localStorage.setItem(STORAGE_KEY, '__auto__');
        window.cdnReady.then(({ valid }) => {
          if (valid.length > 0) activeNode = valid[0].node;
        });
      } else {
        activeNode = CDN_NODES.find(n => n.name === select.value);
        localStorage.setItem(STORAGE_KEY, select.value);
        console.log(`[CDN] 手动切换节点: ${activeNode.name}`);
      }
      window.reloadMap && window.reloadMap(); // 重载地图
    });

    // auto 模式：第一个节点完成后立即解锁下拉
    window.cdnReady.then(() => {
      select.disabled = false;
    });

    // 全部测速完成后更新下拉选项
    window.addEventListener('cdnTestComplete', ({ detail: { valid } }) => {
      const fastest = valid[0];
      autoOpt.textContent = fastest
        ? `[自动] ${fastest.node.name} (${Math.round(fastest.time)}ms)`
        : '[自动] 无可用节点';

      // 清除临时的"测速中..."预占选项
      [...select.options].forEach(opt => {
        if (opt !== autoOpt && opt.textContent.includes('测速中...')) {
          select.removeChild(opt);
        }
      });

      // 只显示有效节点，按速度排序
      valid.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.node.name;
        opt.textContent = `${r.node.name}  (${Math.round(r.time)}ms)`;
        select.appendChild(opt);
      });

      // 恢复选中状态
      const currentSaved = localStorage.getItem(STORAGE_KEY);
      select.value = (currentSaved && currentSaved !== '__auto__') ? currentSaved : '__auto__';

      select.disabled = false;
    }, { once: true });

    wrap.appendChild(select);

    // 注册到 OSD，再移到最左边
    viewer.addControl(wrap, { anchor: OpenSeadragon.ControlAnchor.TOP_LEFT });
    const parent = wrap.parentElement;
    if (parent) {
      parent.parentElement.classList.add('top-left-div');
    }
    if (parent && parent.firstChild !== wrap) {
      parent.insertBefore(wrap, parent.firstChild);
    }
  };

  return { initSelector, startTest };
})();
