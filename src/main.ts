'use strict';

import L from 'leaflet';

// 王子駅・飛鳥山動物病院の緯度経度
const OJI = [35.755532, 139.733945];
const ASUKAYAMA_ANIMAL_HOSPITAL = [35.751824, 139.736013]; // 飛鳥山動物病院

// BRouter APIのURL生成
function getBRouterUrl(start: number[], end: number[]): string {
  return `https://brouter.de/brouter?lonlats=${start[1]},${start[0]}|${end[1]},${end[0]}&profile=fastbike&alternativeidx=0&format=geojson`;
}

window.onload = async () => {
  
// MLIT 浸水マップタイルURL（全国洪水浸水想定区域図ラスタ例）
const floodTileUrl = 'https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png';

let floodLayer: L.TileLayer | null = null;
let isFloodMap = false;


  // ...existing code...
  // ピンとルートの管理用
  let lastMarkers: L.Marker[] = [];
  let lastRouteLayer: L.Layer | null = null;
  // 検索ボタン（目的地フォーム）のsubmitでページ遷移しないように
  const destinationForm = document.getElementById('destination-form') as HTMLFormElement;
  if (destinationForm) {
    destinationForm.addEventListener('submit', (e) => {
      e.preventDefault();
    });
  }
  // Nominatimで住所から緯度経度を取得
  async function getLatLngByNominatim(query: string): Promise<[number, number] | null> {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
    try {
      const res = await fetch(url, { headers: { 'Accept-Language': 'ja' } });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.length === 0) return null;
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch {
      return null;
    }
  }
  const map = L.map('map').setView([35.755532, 139.733945], 16);
  // const map = L.map('map').setView([
  //   (OJI[0] + ASUKAYAMA_ANIMAL_HOSPITAL[0]) / 2,
  //   (OJI[1] + ASUKAYAMA_ANIMAL_HOSPITAL[1]) / 2
  // ], 16);

// 通常地図レイヤー
  const baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // 浸水マップレイヤー（初期は非表示）
  floodLayer = L.tileLayer(floodTileUrl, {
    opacity: 0.7,
    attribution: '国土交通省 浸水マップ'
  });

  // 現在地ピン管理用
  let currentLocationMarker: L.Marker | null = null;
  // 現在地アイコン
  const currentLocationIcon = L.icon({
    iconUrl: 'current-location-pin.png',
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -48]
  });
  // 現在地ボタンの機能
  const gotoCurrentLocationBtn = document.getElementById('goto-current-location');
  if (gotoCurrentLocationBtn) {
    gotoCurrentLocationBtn.addEventListener('click', () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat, lng], 16);
            // 前の現在地ピンを削除
            if (currentLocationMarker) {
              map.removeLayer(currentLocationMarker);
              currentLocationMarker = null;
            }
            currentLocationMarker = L.marker([lat, lng], { icon: currentLocationIcon }).addTo(map);
          },
          () => {
            alert('現在地を取得できませんでした');
          }
        );
      } else {
        alert('このブラウザは現在地取得に対応していません');
      }
    });
  }


  // 浸水マップ切替ボタンの機能
  const floodBtn = document.getElementById('toggle-flood-map');
  if (floodBtn) {
    floodBtn.addEventListener('click', () => {
      if (isFloodMap) {
        map.removeLayer(floodLayer!);
        baseLayer.addTo(map);
        isFloodMap = false;
      } else {
        map.addLayer(floodLayer!);
        isFloodMap = true;
      }
    });
  }
  // 目的地入力ボックスをクリックしたら出発地入力画面を表示
  const destinationInput = document.getElementById('destination-input') as HTMLInputElement;
  const searchOptions = document.getElementById('search-options');
  if (destinationInput && searchOptions) {
    destinationInput.addEventListener('focus', () => {
      searchOptions.style.display = 'flex';
    });
    destinationInput.addEventListener('blur', () => {
      setTimeout(() => {
        // チェックボックスやボタンをクリックした場合も考慮
        if (document.activeElement && (document.activeElement as HTMLElement).closest('#search-options')) {
          return;
        }
        searchOptions.style.display = 'none';
      }, 150);
    });
    searchOptions.addEventListener('mousedown', (e) => {
      // チェックボックスクリック時は非表示にしない
      e.preventDefault();
    });
  }
  const originModal = document.getElementById('origin-modal') as HTMLDivElement;
  const originCancel = document.getElementById('origin-cancel') as HTMLButtonElement;

  if (destinationInput && originModal && originCancel) {
    destinationInput.addEventListener('focus', () => {
      originModal.style.display = 'block';
    });
    originCancel.addEventListener('click', () => {
      originModal.style.display = 'none';
    });
    // 決定ボタンで閉じる（必要なら値の取得もここで）
    const originForm = document.getElementById('origin-form') as HTMLFormElement;
    originForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      originModal.style.display = 'none';
      // 出発地・目的地の値取得
      const originInput = document.getElementById('origin-input') as HTMLInputElement;
      const originText = originInput?.value || '';
      const destinationText = destinationInput?.value || '';
      if (!originText || !destinationText) {
        alert('出発地と目的地を入力してください');
        return;
      }
      // Nominatimで両方の緯度経度取得
      const originLatLng = await getLatLngByNominatim(originText);
      const destinationLatLng = await getLatLngByNominatim(destinationText);
      if (!originLatLng || !destinationLatLng) {
        alert('出発地または目的地の位置が見つかりませんでした');
        return;
      }
      // 前回のピンとルートを削除
      lastMarkers.forEach(marker => map.removeLayer(marker));
      lastMarkers = [];
      if (lastRouteLayer) {
        map.removeLayer(lastRouteLayer);
        lastRouteLayer = null;
      }

      // 地図にマーカー表示
      const originMarker = L.marker(originLatLng as L.LatLngTuple).addTo(map).bindPopup('出発地').openPopup();
      const destinationMarker = L.marker(destinationLatLng as L.LatLngTuple).addTo(map).bindPopup('目的地').openPopup();
      lastMarkers.push(originMarker, destinationMarker);
      // ルート全体が表示されるように地図の表示範囲を調整
      const bounds = L.latLngBounds([
        originLatLng as L.LatLngTuple,
        destinationLatLng as L.LatLngTuple
      ]);


      // BRouter APIでルート取得
      try {
        const url = getBRouterUrl(originLatLng, destinationLatLng);
        const res = await fetch(url);
        if (!res.ok) throw new Error('ルート取得失敗');
        const geojson = await res.json();
        // GeoJSONのルートを地図に表示
        const routeLayer = L.geoJSON(geojson, {
          style: {
            color: 'blue',
            weight: 5,
            opacity: 0.7
          }
        }).addTo(map);
        lastRouteLayer = routeLayer;
        // ルート全体が表示されるようにfitBounds
        if (routeLayer.getBounds) {
          map.fitBounds(routeLayer.getBounds());
        } else {
          map.fitBounds(bounds);
        }
      } catch (e) {
        alert('ルートの取得に失敗しました');
        console.error(e);
      }
    });
  }

  // // 王子駅・飛鳥山動物病院にマーカーを表示
  // L.marker(OJI as L.LatLngTuple).addTo(map).bindPopup('王子駅').openPopup();
  // L.marker(ASUKAYAMA_ANIMAL_HOSPITAL as L.LatLngTuple).addTo(map).bindPopup('飛鳥山動物病院');

  // // BRouter APIでルート取得
  // try {
  //   const url = getBRouterUrl(OJI, ASUKAYAMA_ANIMAL_HOSPITAL);
  //   const res = await fetch(url);
  //   if (!res.ok) throw new Error('ルート取得失敗');
  //   const geojson = await res.json();

  //   // GeoJSONのルートを地図に表示
  //   L.geoJSON(geojson, {
  //     style: {
  //       color: 'blue',
  //       weight: 5,
  //       opacity: 0.7
  //     }
  //   }).addTo(map);
  // } catch (e) {
  //   alert('ルートの取得に失敗しました');
  //   console.error(e);
  // }
};