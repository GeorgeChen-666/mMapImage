// js/index.js
(() => {
  const showMap = (cat = 'map') => {
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

    CdnControls.initSelector(viewer);

    const drawing = viewer.initDrawingPlugin({ storageKey: `osd_strokes_${cat}` });
    const mapContainer = document.getElementById('zoomMap');
    DrawingControls.init(viewer, drawing, mapContainer);
  };

  const modal = document.getElementById('modal-1');
  modal.showModal();

  const onSelect = (cat) => {
    modal.close();
    CdnControls.startTest();          // ← 点击后才开始测速
    window.cdnReady.then(() => showMap(cat));
  };

  document.getElementById('btnGoTo1').addEventListener('click', () => onSelect('map'));
  document.getElementById('btnGoTo2').addEventListener('click', () => onSelect('map2'));
})();
