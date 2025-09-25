'use strict';

import L from 'leaflet';

window.onload = () => {
  const map = L.map('map').setView([35.681236, 139.767125], 13); // 東京駅周辺

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
};
