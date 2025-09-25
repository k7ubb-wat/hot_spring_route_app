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
  const map = L.map('map').setView([
    (OJI[0] + ASUKAYAMA_ANIMAL_HOSPITAL[0]) / 2,
    (OJI[1] + ASUKAYAMA_ANIMAL_HOSPITAL[1]) / 2
  ], 16);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

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
            L.marker([lat, lng]).addTo(map).bindPopup('現在地').openPopup();
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

  // 目的地入力ボックスをクリックしたら出発地入力画面を表示
  const destinationInput = document.getElementById('destination-input') as HTMLInputElement;
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
    originForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      originModal.style.display = 'none';
    });
  }

  // 王子駅・飛鳥山動物病院にマーカーを表示
  L.marker(OJI as L.LatLngTuple).addTo(map).bindPopup('王子駅').openPopup();
  L.marker(ASUKAYAMA_ANIMAL_HOSPITAL as L.LatLngTuple).addTo(map).bindPopup('飛鳥山動物病院');

  // BRouter APIでルート取得
  try {
    const url = getBRouterUrl(OJI, ASUKAYAMA_ANIMAL_HOSPITAL);
    const res = await fetch(url);
    if (!res.ok) throw new Error('ルート取得失敗');
    const geojson = await res.json();

    // GeoJSONのルートを地図に表示
    L.geoJSON(geojson, {
      style: {
        color: 'blue',
        weight: 5,
        opacity: 0.7
      }
    }).addTo(map);
  } catch (e) {
    alert('ルートの取得に失敗しました');
    console.error(e);
  }
};