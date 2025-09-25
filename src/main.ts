'use strict';

import L from 'leaflet';

window.onload = () => {
  const map = L.map('map').setView([35.681236, 139.767125], 13); // 東京駅周辺

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
};
