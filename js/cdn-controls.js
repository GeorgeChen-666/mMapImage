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
      name: 'fastly',
      testUrl: 'https://fastly.jsdelivr.net/gh/GeorgeChen-666/mMapImage@master/map/3/3-0-0.jpg',
      getTileUrl: (cat, level, x, y) =>
        `https://fastly.jsdelivr.net/gh/GeorgeChen-666/mMapImage@master/${cat}/${level}/${level}-${x}-${y}.jpg`
    },
    {
      name: 'gcore',
      testUrl: 'https://gcore.jsdelivr.net/gh/GeorgeChen-666/mMapImage@master/map/3/3-0-0.jpg',
      getTileUrl: (cat, level, x, y) =>
        `https://gcore.jsdelivr.net/gh/GeorgeChen-666/mMapImage@master/${cat}/${level}/${level}-${x}-${y}.jpg`
    },
    {
      name: 'cloudflare',
      testUrl: 'https://testingcf.jsdelivr.net/gh/GeorgeChen-666/mMapImage@master/map/3/3-0-0.jpg',
      getTileUrl: (cat, level, x, y) =>
        `https://testingcf.jsdelivr.net/gh/GeorgeChen-666/mMapImage@master/${cat}/${level}/${level}-${x}-${y}.jpg`
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
      name: 'mirror.ghproxy',
      testUrl: 'https://mirror.ghproxy.com/https://raw.githubusercontent.com/GeorgeChen-666/mMapImage/master/map/3/3-0-0.jpg',
      getTileUrl: (cat, level, x, y) =>
        `https://mirror.ghproxy.com/https://raw.githubusercontent.com/GeorgeChen-666/mMapImage/master/${cat}/${level}/${level}-${x}-${y}.jpg`
    },
    {
      name: 'local',
      testUrl: './map/3/3-0-0.jpg',
      getTileUrl: (cat, level, x, y) =>
        `./${cat}/${level}/${level}-${x}-${y}.jpg`
    },
  ];
  let activeNode = CDN_NODES[0]; // 默认 local

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
    const all = await Promise.all(CDN_NODES.map(testNode));

    // 过滤超时，按速度排序
    const valid = all
      .filter(r => r.time !== Infinity)
      .sort((a, b) => a.time - b.time);

    const timedOut = all.filter(r => r.time === Infinity);

    [...valid, ...timedOut].forEach(r => {
      const ms   = r.time === Infinity ? 'timeout' : `${Math.round(r.time)}ms`;
      const flag = r === valid[0] ? ' ✅ 最快' : '';
      console.log(`[CDN测速] ${r.node.name}: ${ms}${flag}`);
    });

    if (valid.length > 0) {
      activeNode = valid[0].node;
      console.log(`[CDN测速] 采用节点: ${activeNode.name}`);
    }

    _resolve({ valid, timedOut });
  };

  // 创建下拉并挂到 OSD TOP_LEFT 最左边
  const initSelector = (viewer) => {
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

    // 占位，测速完成后更新
    const autoOpt = document.createElement('option');
    autoOpt.value = '__auto__';
    autoOpt.textContent = '[自动] 测速中...';
    select.appendChild(autoOpt);

    select.addEventListener('change', () => {
      if (select.value === '__auto__') {
        // 切回自动：用测速最快节点
        window.cdnReady.then(({ valid }) => {
          if (valid.length > 0) activeNode = valid[0].node;
        });
      } else {
        activeNode = CDN_NODES.find(n => n.name === select.value);
        console.log(`[CDN] 手动切换节点: ${activeNode.name}`);
      }
    });

    // 测速完成后填充选项
    window.cdnReady.then(({ valid, timedOut }) => {
      const fastest = valid[0];
      if (fastest) {
        autoOpt.textContent = `[自动] ${fastest.node.name} (${Math.round(fastest.time)}ms)`;
      } else {
        autoOpt.textContent = '[自动] 无可用节点';
      }

      // 只显示有效节点，按速度排序
      valid.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.node.name;
        opt.textContent = `${r.node.name}  (${Math.round(r.time)}ms)`;
        select.appendChild(opt);
      });

      // 超时节点置灰放最后
      timedOut.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.node.name;
        opt.textContent = `${r.node.name}  (timeout)`;
        opt.style.color = '#888';
        select.appendChild(opt);
      });
    });

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
