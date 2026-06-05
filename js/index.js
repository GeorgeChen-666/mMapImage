// js/index.js
(() => {
  const STORAGE_KEY = 'cdn_selected_node';

  const showMap = (cat = 'map1') => {
    if (window._viewer) {
      window._viewer.destroy();
      window._viewer = null;
    }

    const viewer = OpenSeadragon({
      id: 'zoomMap',
      prefixUrl: './libs/openseadragon/images/',
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
        getTileUrl: (level, x, y) => window.activeTileUrl(cat, level - 6, x, y)
      }
    });

    window._viewer = viewer;

    CdnControls.initSelector(viewer);

    const drawing = viewer.initDrawingPlugin({ storageKey: `osd_strokes_${cat}` });
    const mapContainer = document.getElementById('zoomMap');
    DrawingControls.init(viewer, drawing, mapContainer);
  };

  window.reloadMap = () => {
    if (window._currentCat) showMap(window._currentCat);
  };

  const modal = document.getElementById('modal-1');
  modal.showModal();

  const onSelect = (cat) => {
    modal.close();
    window._currentCat = cat;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved !== '__auto__') {
      // 有手动选择，不阻塞，异步测速
      CdnControls.startTest();
      showMap(cat);
    } else {
      // 自动模式，等测速完成再显示
      CdnControls.startTest();
      window.cdnReady.then(() => showMap(cat));
    }
  };

  document.getElementById('btnGoTo1').addEventListener('click', () => onSelect('map1'));
  document.getElementById('btnGoTo2').addEventListener('click', () => onSelect('map2'));
  document.getElementById('btnGoTo3').addEventListener('click', () => onSelect('map3'));
  document.getElementById('btnGoTo4').addEventListener('click', () => onSelect('map4'));
})();
