// js/cdn-controls.js
const CdnControls = (() => {

  const CDN_NODES = [
    {
      name: 'zzko',
      testUrl: 'http://jsd.cdn.zzko.cn/gh/GeorgeChen-666/mMapImage@master/map_pices/map/3/3-0-0.webp',
      getTileUrl: (cat, level, x, y) =>
        `http://jsd.cdn.zzko.cn/gh/GeorgeChen-666/mMapImage@master/map_pices/${cat}/${level}/${level}-${x}-${y}.webp`
    },
    {
      name: 'onmicrosoft',
      testUrl: 'http://jsd.onmicrosoft.cn/gh/GeorgeChen-666/mMapImage@master/map_pices/map/3/3-0-0.webp',
      getTileUrl: (cat, level, x, y) =>
        `http://jsd.onmicrosoft.cn/gh/GeorgeChen-666/mMapImage@master/map_pices/${cat}/${level}/${level}-${x}-${y}.webp`
    },
    {
      name: 'jsdmirror',
      testUrl: 'https://cdn.jsdmirror.com/gh/GeorgeChen-666/mMapImage@master/map_pices/map/3/3-0-0.webp',
      getTileUrl: (cat, level, x, y) =>
        `https://cdn.jsdmirror.com/gh/GeorgeChen-666/mMapImage@master/map_pices/${cat}/${level}/${level}-${x}-${y}.webp`
    },
    {
      name: 'duolaa',
      testUrl: 'https://jsd.duolaa.top/gh/GeorgeChen-666/mMapImage@master/map_pices/map/3/3-0-0.webp',
      getTileUrl: (cat, level, x, y) =>
        `https://jsd.duolaa.top/gh/GeorgeChen-666/mMapImage@master/map_pices/${cat}/${level}/${level}-${x}-${y}.webp`
    },
    {
      name: 'jsdelivr',
      testUrl: 'https://cdn.jsdelivr.net/gh/GeorgeChen-666/mMapImage@master/map_pices/map/3/3-0-0.webp',
      getTileUrl: (cat, level, x, y) =>
        `https://gcore.jsdelivr.net/gh/GeorgeChen-666/mMapImage@master/map_pices/${cat}/${level}/${level}-${x}-${y}.webp`
    },
    {
      name: 'bcdn',
      testUrl: 'https://jsdelivr.b-cdn.net/gh/GeorgeChen-666/mMapImage@master/map_pices/map/3/3-0-0.webp',
      getTileUrl: (cat, level, x, y) =>
        `https://jsdelivr.b-cdn.net/gh/GeorgeChen-666/mMapImage@master/map_pices/${cat}/${level}/${level}-${x}-${y}.webp`
    },
    {
      name: 'ghproxy',
      testUrl: 'https://ghproxy.net/https://raw.githubusercontent.com/GeorgeChen-666/mMapImage/master/map_pices/map/3/3-0-0.webp',
      getTileUrl: (cat, level, x, y) =>
        `https://ghproxy.net/https://raw.githubusercontent.com/GeorgeChen-666/mMapImage/master/map_pices/${cat}/${level}/${level}-${x}-${y}.webp`
    },
    {
      name: 'ghfast',
      testUrl: 'https://ghfast.top/https://raw.githubusercontent.com/GeorgeChen-666/mMapImage/master/map_pices/map/3/3-0-0.webp',
      getTileUrl: (cat, level, x, y) =>
        `https://ghfast.top/https://raw.githubusercontent.com/GeorgeChen-666/mMapImage/master/map_pices/${cat}/${level}/${level}-${x}-${y}.webp`
    },
    {
      name: 'local',
      testUrl: './map_pices/map/3/3-0-0.webp',
      getTileUrl: (cat, level, x, y) =>
        `./map_pices/${cat}/${level}/${level}-${x}-${y}.webp`
    },
  ];

  const STORAGE_KEY = 'cdn_selected_node';
  let activeNode = CDN_NODES[0];
  let _testResult = null; // 缓存测速结果，reloadMap 时复用

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

      if (isAuto && !firstResolved && r.time !== Infinity) {
        firstResolved = true;
        activeNode = r.node;
        console.log(`[CDN测速] 首个可用节点: ${r.node.name} (${Math.round(r.time)}ms)`);
        _resolve({ valid: [r], timedOut: [], pending: true });
      }

      return r;
    }));

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

    if (isAuto && valid.length > 0) {
      activeNode = valid[0].node;
      console.log(`[CDN测速] 最终采用节点: ${activeNode.name}`);
    }

    if (isAuto && !firstResolved && valid.length > 0) {
      _resolve({ valid, timedOut, pending: false });
    }

    if (!isAuto) {
      _resolve({ valid, timedOut, pending: false });
    }

    // 缓存结果
    _testResult = { valid };
    window.dispatchEvent(new CustomEvent('cdnTestComplete', { detail: { valid } }));
  };

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

    const autoOpt = document.createElement('option');
    autoOpt.value = '__auto__';
    select.appendChild(autoOpt);

    // 如果测速已完成（reloadMap 场景），直接用缓存结果填充
    if (_testResult) {
      const { valid } = _testResult;
      const fastest = valid[0];
      autoOpt.textContent = fastest
        ? `[自动] ${fastest.node.name} (${Math.round(fastest.time)}ms)`
        : '[自动] 无可用节点';

      valid.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.node.name;
        opt.textContent = `${r.node.name}  (${Math.round(r.time)}ms)`;
        select.appendChild(opt);
      });

      const currentSaved = localStorage.getItem(STORAGE_KEY);
      select.value = (currentSaved && currentSaved !== '__auto__') ? currentSaved : '__auto__';
      select.disabled = false;

    } else {
      // 首次加载，测速中
      autoOpt.textContent = '[自动] 测速中...';
      select.disabled = true;

      if (saved && saved !== '__auto__') {
        const preOpt = document.createElement('option');
        preOpt.value = saved;
        preOpt.textContent = `${saved}  (测速中...)`;
        select.appendChild(preOpt);
        select.value = saved;
      }

      // auto 模式：第一个节点完成后解锁
      window.cdnReady.then(() => {
        select.disabled = false;
      });

      // 全部完成后更新选项
      window.addEventListener('cdnTestComplete', ({ detail: { valid } }) => {
        const fastest = valid[0];
        autoOpt.textContent = fastest
          ? `[自动] ${fastest.node.name} (${Math.round(fastest.time)}ms)`
          : '[自动] 无可用节点';

        [...select.options].forEach(opt => {
          if (opt !== autoOpt && opt.textContent.includes('测速中...')) {
            select.removeChild(opt);
          }
        });

        valid.forEach(r => {
          const opt = document.createElement('option');
          opt.value = r.node.name;
          opt.textContent = `${r.node.name}  (${Math.round(r.time)}ms)`;
          select.appendChild(opt);
        });

        const currentSaved = localStorage.getItem(STORAGE_KEY);
        select.value = (currentSaved && currentSaved !== '__auto__') ? currentSaved : '__auto__';
        select.disabled = false;
      }, { once: true });
    }

    select.addEventListener('change', () => {
      if (select.value === '__auto__') {
        localStorage.setItem(STORAGE_KEY, '__auto__');
        if (_testResult) {
          const { valid } = _testResult;
          if (valid.length > 0) activeNode = valid[0].node;
        }
      } else {
        activeNode = CDN_NODES.find(n => n.name === select.value);
        localStorage.setItem(STORAGE_KEY, select.value);
        console.log(`[CDN] 手动切换节点: ${activeNode.name}`);
      }
      window.reloadMap && window.reloadMap();
    });

    wrap.appendChild(select);

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
