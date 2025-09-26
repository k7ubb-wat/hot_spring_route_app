'use strict';

import { loadResource, getAvoidPoints } from './const';

import L from 'leaflet';

// BRouter APIのURL生成（坂道回避オプション追加）
function getBRouterUrl(start: number[], end: number[], avoidHills: boolean): string {
  // profile: shortest（通常）/ trekking（坂道回避）
  const profile = avoidHills ? 'trekking' : 'shortest';
  let avoidareas = '';
  if (isFloodMap) {
    const avoidPoints = getAvoidPoints();
    if (avoidPoints && avoidPoints.length > 0) {
      avoidareas = '&nogos=' + avoidPoints.map(pt => `${pt[1].toFixed(5)},${pt[0].toFixed(5)},400`).join('|');
    }
  }
  return `https://brouter.de/brouter?lonlats=${start[1]},${start[0]}|${end[1]},${end[0]}&profile=${profile}&alternativeidx=0&format=geojson${avoidareas}`;
}

// MLIT 浸水マップタイルURL（全国洪水浸水想定区域図ラスタ例）
const floodTileUrl = 'https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png';

let floodLayer: L.TileLayer | null = null;
let isFloodMap = false;

// カスタムアイコン（緑：出発地、赤：目的地）
const greenIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
const redIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// ピンとルートの管理用
let lastMarkers: L.Marker[] = [];
let lastRouteLayer: L.Layer | null = null;

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

window.onload = async () => {
  await loadResource();

  const map = L.map('map').setView([35.755532, 139.733945], 16);

  // 通常地図レイヤー
  const baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // 浸水マップレイヤー（初期は非表示）
  floodLayer = L.tileLayer(floodTileUrl, {
    opacity: 0.7,
    attribution: '国土交通省 浸水マップ'
  });

  // Layer group for avoid points markers
  const avoidPointsLayer = L.layerGroup();

  // Function to add avoid points markers
  function addAvoidPointsMarkers() {
    const avoidPoints = getAvoidPoints();
    avoidPoints.forEach(([lat, lng]) => {
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'avoid-point-marker',
          html: '❌',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(avoidPointsLayer);
    });
  }

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
        map.removeLayer(avoidPointsLayer);
        baseLayer.addTo(map);
        isFloodMap = false;
      } else {
        map.addLayer(floodLayer!);
        addAvoidPointsMarkers();
        map.addLayer(avoidPointsLayer);
        isFloodMap = true;
      }
    });
  }

  // ルート設定ボタンの機能
  const openRouteModalBtn = document.getElementById('open-route-modal');
  const routeModal = document.getElementById('route-modal') as HTMLDivElement;
  const routeForm = document.getElementById('route-form') as HTMLFormElement;
  const originInput = document.getElementById('origin-input') as HTMLInputElement;
  const destinationInput = document.getElementById('destination-input') as HTMLInputElement;
  const avoidHillsInput = document.getElementById('avoid-hills') as HTMLInputElement;

  if (openRouteModalBtn && routeModal && routeForm && originInput && destinationInput && avoidHillsInput) {
    openRouteModalBtn.addEventListener('click', () => {
      routeModal.style.display = 'block';
      originInput.value = '';
      destinationInput.value = '';
      avoidHillsInput.checked = false;
    });
    // 枠の外側クリックで閉じる
    document.addEventListener('mousedown', (e) => {
      if (routeModal.style.display === 'block') {
        const target = e.target as HTMLElement;
        if (routeModal && !routeModal.contains(target) && target !== openRouteModalBtn) {
          routeModal.style.display = 'none';
        }
      }
    });
    routeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      routeModal.style.display = 'none';
      const originText = originInput.value.trim();
      const destinationText = destinationInput.value.trim();
      const avoidHills = avoidHillsInput.checked;
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
      // 地図にマーカー表示（色付きアイコンを使用）
      const originMarker = L.marker(originLatLng as L.LatLngTuple, { icon: greenIcon }).addTo(map).bindPopup('出発地').openPopup();
      const destinationMarker = L.marker(destinationLatLng as L.LatLngTuple, { icon: redIcon }).addTo(map).bindPopup('目的地').openPopup();
      lastMarkers.push(originMarker, destinationMarker);
      // ルート全体が表示されるように地図の表示範囲を調整
      const bounds = L.latLngBounds([
        originLatLng as L.LatLngTuple,
        destinationLatLng as L.LatLngTuple
      ]);
      // BRouter APIでルート取得（坂道回避オプションを反映）
      try {
        const url = getBRouterUrl(originLatLng, destinationLatLng, avoidHills);
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
};