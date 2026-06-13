// ==================== DIAMOND GPX – интерактивный модуль ====================
let gpxMap, gpxLayerGroup, elevationChart, currentGpxContent = null;
let trackPoints = []; // все точки трека для синхронизации
let hoverMarker = null; // маркер для наведения

function initGPX() {
    if (typeof L === 'undefined' || !L.tileLayer || !document.getElementById('gpx-map')) return;
    if (gpxMap) { gpxMap.invalidateSize(); return; }

    gpxMap = L.map('gpx-map', {
        center: [55.751244, 37.618423],
        zoom: 10,
        layers: [L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { attribution: '© Google', maxZoom: 20 })],
        zoomControl: true
    });
    gpxLayerGroup = L.featureGroup().addTo(gpxMap);

    document.getElementById('gpx-file-input').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const data = parseGPX(ev.target.result);
                displayGPX(data);
                currentGpxContent = ev.target.result;
                const saveBtn = document.getElementById('saveGpxBtn');
                if (saveBtn) saveBtn.style.display = 'inline-flex';
                showAIReview(data);
                showToast('GPX-файл загружен');
            } catch (err) { showToast('Ошибка: ' + err.message); }
        };
        reader.readAsText(file);
    });

    const saveBtn = document.getElementById('saveGpxBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const modal = document.getElementById('gpxNameModal');
            if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); }
        });
    }
    const saveNameBtn = document.getElementById('saveGpxNameBtn');
    if (saveNameBtn) {
        saveNameBtn.addEventListener('click', async () => {
            const name = document.getElementById('gpxNameInput')?.value?.trim() || 'Без названия';
            await _supabase.from('gpx_files').insert([{ user_login: currentUser.login, name, content: currentGpxContent }]);
            closeModal('gpxNameModal');
            showToast('Прогулка опубликована!');
        });
    }

    // Принудительно обновляем размер карты, когда вкладка активна
    const gpxPage = document.getElementById('page-gpx');
    if (gpxPage && gpxPage.classList.contains('active')) {
        setTimeout(() => gpxMap.invalidateSize(), 100);
    }
}

// Парсинг GPX
function parseGPX(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const tracks = [];
    xmlDoc.querySelectorAll('trk').forEach(trk => {
        const segments = [];
        trk.querySelectorAll('trkseg').forEach(seg => {
            const pts = [];
            seg.querySelectorAll('trkpt').forEach(pt => {
                const lat = +pt.getAttribute('lat'), lon = +pt.getAttribute('lon');
                const ele = parseFloat(pt.querySelector('ele')?.textContent);
                pts.push({ lat, lon, ele: isNaN(ele) ? null : ele });
            });
            if (pts.length > 1) segments.push(pts);
        });
        if (segments.length) tracks.push({ segments });
    });
    return { tracks };
}

// Отображение трека и старт/финиш
function displayGPX(data) {
    gpxLayerGroup.clearLayers();
    if (elevationChart) { elevationChart.destroy(); elevationChart = null; }
    trackPoints = [];

    data.tracks.forEach(track => {
        track.segments.forEach(seg => {
            if (seg.length === 0) return;
            const latlngs = seg.map(p => [p.lat, p.lon]);
            L.polyline(latlngs, { color: '#4ecdc4', weight: 5, opacity: 0.9 }).addTo(gpxLayerGroup);
            trackPoints.push(...seg);
            const start = seg[0], end = seg[seg.length-1];
            L.marker([start.lat, start.lon], {
                icon: L.divIcon({ className: 'gpx-marker-start', html: '<i class="fas fa-flag-checkered"></i>', iconSize: [30,30], iconAnchor: [15,30] })
            }).addTo(gpxLayerGroup).bindPopup('Старт');
            if (seg.length > 1) {
                L.marker([end.lat, end.lon], {
                    icon: L.divIcon({ className: 'gpx-marker-end', html: '<i class="fas fa-flag"></i>', iconSize: [30,30], iconAnchor: [15,30] })
                }).addTo(gpxLayerGroup).bindPopup('Финиш');
            }
        });
    });

    if (gpxLayerGroup.getLayers().length) {
        const bounds = gpxLayerGroup.getBounds();
        if (bounds.isValid()) gpxMap.fitBounds(bounds, { padding: [40,40], maxZoom:16 });
    }
    updateDashboard(data.tracks);
}

// Статистика и график с интерактивностью
function updateDashboard(tracks) {
    let allPoints = [];
    tracks.forEach(t => t.segments.forEach(seg => allPoints.push(...seg)));
    if (!allPoints.length) return;

    let totalDist = 0, ascent = 0, cumDist = 0;
    const elevationData = [];
    // Сохраняем расстояния до каждой точки для синхронизации
    const distances = [];

    for (let i = 0; i < allPoints.length; i++) {
        if (i > 0) {
            const prev = allPoints[i-1], pt = allPoints[i];
            const d = haversine(prev.lat, prev.lon, pt.lat, pt.lon);
            totalDist += d;
            cumDist += d;
            if (prev.ele !== null && pt.ele !== null && pt.ele > prev.ele) ascent += pt.ele - prev.ele;
        }
        if (allPoints[i].ele !== null) {
            elevationData.push({ dist: cumDist, ele: allPoints[i].ele, lat: allPoints[i].lat, lon: allPoints[i].lon });
        }
    }

    const distEl = document.getElementById('distVal');
    const ascentEl = document.getElementById('ascentVal');
    if (distEl) distEl.textContent = totalDist > 1000 ? (totalDist/1000).toFixed(2)+' км' : totalDist.toFixed(0)+' м';
    if (ascentEl) ascentEl.textContent = ascent > 0 ? '+' + ascent.toFixed(0)+' м' : '—';
    const timeEl = document.getElementById('timeVal');
    const speedEl = document.getElementById('speedVal');
    if (timeEl) timeEl.textContent = '—';
    if (speedEl) speedEl.textContent = '—';

    if (elevationData.length > 1) {
        const ctx = document.getElementById('elevationChart')?.getContext('2d');
        if (!ctx) return;
        elevationChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: elevationData.map(p => (p.dist / 1000).toFixed(1)),
                datasets: [{
                    data: elevationData.map(p => p.ele),
                    borderColor: '#4ecdc4',
                    backgroundColor: 'rgba(78,205,196,0.2)',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'км', color: '#888' }, ticks: { color: '#888' }, grid: { color: '#222' } },
                    y: { title: { display: true, text: 'м', color: '#888' }, ticks: { color: '#888' }, grid: { color: '#222' } }
                },
                onHover: (event, elements) => {
                    if (elements.length > 0 && gpxMap) {
                        const index = elements[0].index;
                        const point = elevationData[index];
                        if (point && point.lat !== undefined) {
                            if (!hoverMarker) {
                                hoverMarker = L.circleMarker([point.lat, point.lon], { radius: 8, color: '#ff6b6b', fillColor: '#ff6b6b', fillOpacity: 0.8 }).addTo(gpxMap);
                            } else {
                                hoverMarker.setLatLng([point.lat, point.lon]);
                            }
                        }
                    } else {
                        if (hoverMarker) { gpxMap.removeLayer(hoverMarker); hoverMarker = null; }
                    }
                }
            }
        });
    }
}

// Отзыв от ИИ
function showAIReview(data) {
    const box = document.getElementById('aiReview');
    const text = document.getElementById('aiReviewText');
    if (!box || !text) return;
    let allPoints = [];
    data.tracks.forEach(t => t.segments.forEach(seg => allPoints.push(...seg)));
    let totalDist = 0;
    for (let i = 1; i < allPoints.length; i++) totalDist += haversine(allPoints[i-1].lat, allPoints[i-1].lon, allPoints[i].lat, allPoints[i].lon);
    text.textContent = `Отличная прогулка! Вы проехали ${(totalDist/1000).toFixed(1)} км. Продолжайте исследовать новые маршруты!`;
    box.style.display = 'flex';
}

function haversine(lat1,lon1,lat2,lon2) {
    const R=6371000, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Безопасное закрытие модалки
function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('closing');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('active', 'closing');
    }, 300);
}

// Активация GPX при открытии вкладки
document.addEventListener('DOMContentLoaded', () => {
    const gpxPage = document.getElementById('page-gpx');
    if (gpxPage) {
        const observer = new MutationObserver(() => {
            if (gpxPage.classList.contains('active')) initGPX();
        });
        observer.observe(gpxPage, { attributes: true, attributeFilter: ['class'] });
        if (gpxPage.classList.contains('active')) initGPX();
    }
});
