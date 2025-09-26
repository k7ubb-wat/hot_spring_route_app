'use strict';

import { loadResource, getAvoidPoints } from './const';

import L from 'leaflet';

// 坂道回避状態を管理
let avoidHills = false;

function updateHillsStatusDiv() {
  const hillsStatusDiv = document.getElementById('hills-status') as HTMLDivElement;
  if (avoidHills) {
    hillsStatusDiv.innerText = '坂道回避 ON';
    hillsStatusDiv.style.color = '#2563eb';
  } else {
    hillsStatusDiv.innerText = '坂道回避 OFF';
    hillsStatusDiv.style.color = '#22c55e';
  }
}

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

let map: L.Map; // グローバルで宣言

window.onload = async () => {
  await loadResource();

  map = L.map('map').setView([35.755532, 139.733945], 16);

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
        floodBtn.classList.remove('active');
        isFloodMap = false;
      } else {
        map.addLayer(floodLayer!);
        floodBtn.classList.add('active');
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

  if (openRouteModalBtn && routeModal && routeForm && originInput && destinationInput  ) {
    openRouteModalBtn.addEventListener('click', () => {
      routeModal.style.display = 'block';
      originInput.value = '';
      destinationInput.value = '';
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

    // 坂道回避切替ボタンの機能
    const avoidHillsBtn = document.getElementById('toggle-avoid-hills');
    if (avoidHillsBtn) {
      avoidHillsBtn.style.backgroundColor = '#22c55e';

      avoidHillsBtn.addEventListener('click', async () => {
        avoidHills = !avoidHills;
        if (avoidHills) {
          avoidHillsBtn.style.backgroundColor = '#2563eb'; // ON:青
        } else {
          avoidHillsBtn.style.backgroundColor = '#22c55e'; // OFF:緑
        }
        updateHillsStatusDiv();
        // 出発地・目的地が入力済みならルート再検索
        const originInput = document.getElementById('origin-input') as HTMLInputElement;
        const destinationInput = document.getElementById('destination-input') as HTMLInputElement;
        const originText = originInput?.value.trim();
        const destinationText = destinationInput?.value.trim();
        if (originText && destinationText) {
          await searchRoute(originText, destinationText, avoidHills);
        }
      });
    }

    // ルート検索処理を関数化
    async function searchRoute(originText: string, destinationText: string, avoidHills: boolean) {
      // ここで map = L.map('map') を呼ばない！
      const originLatLng = await getLatLngByNominatim(originText);
      const destinationLatLng = await getLatLngByNominatim(destinationText);
      if (!originLatLng || !destinationLatLng) {
        alert('出発地または目的地の位置が見つかりませんでした');
        return;
      }
      lastMarkers.forEach(marker => map.removeLayer(marker));
      lastMarkers = [];
      if (lastRouteLayer) {
        map.removeLayer(lastRouteLayer);
        lastRouteLayer = null;
      }
      const originMarker = L.marker(originLatLng as L.LatLngTuple, { icon: greenIcon }).addTo(map).bindPopup('出発地').openPopup();
      const destinationMarker = L.marker(destinationLatLng as L.LatLngTuple, { icon: redIcon }).addTo(map).bindPopup('目的地').openPopup();
      lastMarkers.push(originMarker, destinationMarker);
      const bounds = L.latLngBounds([
        originLatLng as L.LatLngTuple,
        destinationLatLng as L.LatLngTuple
      ]);
      try {
        const url = getBRouterUrl(originLatLng, destinationLatLng, avoidHills);
        const res = await fetch(url);
        if (!res.ok) throw new Error('ルート取得失敗');
        const geojson = await res.json();
        const routeLayer = L.geoJSON(geojson, {
          style: {
            color: 'blue',
            weight: 5,
            opacity: 0.7
          }
        }).addTo(map);
        lastRouteLayer = routeLayer;
        if (routeLayer.getBounds) {
          map.fitBounds(routeLayer.getBounds());
        } else {
          map.fitBounds(bounds);
        }
      } catch (e) {
        alert('ルートの取得に失敗しました');
        console.error(e);
      }
    }

    // ルート設定フォームのsubmitイベントでsearchRouteを呼び出す
    if (routeForm && originInput && destinationInput) {
      routeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        routeModal.style.display = 'none';
        const originText = originInput.value.trim();
        const destinationText = destinationInput.value.trim();
        if (!originText || !destinationText) {
          alert('出発地と目的地を入力してください');
          return;
        }
        await searchRoute(originText, destinationText, avoidHills);
      });
    }
  }

  // 坂道回避状態表示用の要素を作成
  const hillsStatusDiv = document.createElement('div');
  hillsStatusDiv.id = 'hills-status';
 
  hillsStatusDiv.innerText = '坂道回避 OFF';
  document.body.appendChild(hillsStatusDiv);
};