// ==================== DIAMOND GPX – переработанный модуль ====================
let gpxMap, gpxLayerGroup, elevationChart, currentGpxContent = null;

function initGPX() {
    // Проверяем, загружен ли Leaflet и DOM
    if (typeof L === 'undefined' || !L.tileLayer || !document.getElementById('gpx-map')) return;

    if (gpxMap) {
        gpxMap.invalidateSize();
        return;
    }

    gpxMap = L.map('gpx-map', {
        center: [55.751244, 37.618423],
        zoom: 10,
        layers: [L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { attribution: '© Google', maxZoom: 20 })],
        zoomControl: true
    });
    gpxLayerGroup = L.featureGroup().addTo(gpxMap);

    // Обработчик загрузки файла
    document.getElementById('gpx-file-input').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const data = parseGPX(ev.target.result);
                displayGPX(data);
                currentGpxContent = ev.target.result;
                document.getElementById('saveGpxBtn').style.display = 'inline-flex';
                showAIReview(data);
            } catch (err) {
                alert('Ошибка: ' + err.message);
            }
        };
        reader.readAsText(file);
    });

    // Кнопка сохранения
    document.getElementById('saveGpxBtn').addEventListener('click', () => {
        document.getElementById('gpxNameModal').style.display = 'flex';
    });
    document.getElementById('saveGpxNameBtn').addEventListener('click', async () => {
        const name = document.getElementById('gpxNameInput').value.trim() || 'Без названия';
        await _supabase.from('gpx_files').insert([{ user_login: currentUser.login, name, content: currentGpxContent }]);
        document.getElementById('gpxNameModal').style.display = 'none';
        showToast('Прогулка сохранена!');
    });

    // Если вкладка активна, обновить размер карты
    if (document.getElementById('page-gpx').classList.contains('active')) {
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

    data.tracks.forEach(track => {
        track.segments.forEach(seg => {
            if (seg.length === 0) return;
            const latlngs = seg.map(p => [p.lat, p.lon]);
            L.polyline(latlngs, { color: '#4ecdc4', weight: 5, opacity: 0.9 }).addTo(gpxLayerGroup);

            // Старт и финиш
            const start = seg[0];
            const end = seg[seg.length - 1];
            L.marker([start.lat, start.lon], {
                icon: L.divIcon({ className: 'gpx-marker-start', html: '<i class="fas fa-flag-checkered"></i>', iconSize: [30, 30], iconAnchor: [15, 30] })
            }).addTo(gpxLayerGroup).bindPopup('Старт');
            if (seg.length > 1) {
                L.marker([end.lat, end.lon], {
                    icon: L.divIcon({ className: 'gpx-marker-end', html: '<i class="fas fa-flag"></i>', iconSize: [30, 30], iconAnchor: [15, 30] })
                }).addTo(gpxLayerGroup).bindPopup('Финиш');
            }
        });
    });

    if (gpxLayerGroup.getLayers().length) {
        const bounds = gpxLayerGroup.getBounds();
        if (bounds.isValid()) gpxMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }

    updateDashboard(data.tracks);
}

// Статистика и график высот
function updateDashboard(tracks) {
    let allPoints = [];
    tracks.forEach(t => t.segments.forEach(seg => allPoints.push(...seg)));
    if (allPoints.length === 0) return;

    let totalDist = 0, ascent = 0, cumDist = 0;
    const elevationData = [];

    for (let i = 0; i < allPoints.length; i++) {
        if (i > 0) {
            const prev = allPoints[i - 1], pt = allPoints[i];
            const d = haversine(prev.lat, prev.lon, pt.lat, pt.lon);
            totalDist += d;
            cumDist += d;
            if (prev.ele !== null && pt.ele !== null && pt.ele > prev.ele) ascent += pt.ele - prev.ele;
        }
        if (allPoints[i].ele !== null) elevationData.push({ dist: cumDist, ele: allPoints[i].ele });
    }

    document.getElementById('distVal').textContent = totalDist > 1000 ? (totalDist / 1000).toFixed(2) + ' км' : totalDist.toFixed(0) + ' м';
    document.getElementById('ascentVal').textContent = ascent > 0 ? '+' + ascent.toFixed(0) + ' м' : '—';

    // Время (если есть таймстемпы в GPX, можно вычислить, пока заглушка)
    document.getElementById('timeVal').textContent = '—';
    document.getElementById('speedVal').textContent = '—';

    // График высот
    if (elevationData.length > 1) {
        const ctx = document.getElementById('elevationChart').getContext('2d');
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
                plugins: { legend: { display: false } },
                scales: {
                    x: { title: { display: true, text: 'км', color: '#888' }, ticks: { color: '#888' }, grid: { color: '#222' } },
                    y: { title: { display: true, text: 'м', color: '#888' }, ticks: { color: '#888' }, grid: { color: '#222' } }
                }
            }
        });
    }
}

// Отзыв от ИИ (заглушка)
function showAIReview(data) {
    const box = document.getElementById('aiReview');
    const text = document.getElementById('aiReviewText');
    let allPoints = [];
    data.tracks.forEach(t => t.segments.forEach(seg => allPoints.push(...seg)));
    let totalDist = 0;
    for (let i = 1; i < allPoints.length; i++) totalDist += haversine(allPoints[i - 1].lat, allPoints[i - 1].lon, allPoints[i].lat, allPoints[i].lon);
    const km = (totalDist / 1000).toFixed(1);
    text.textContent = `Отличная прогулка! Вы проехали ${km} км. Продолжайте исследовать новые маршруты!`;
    box.style.display = 'flex';
}

// Формула гаверсинуса
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Инициализация при активации вкладки GPX
document.addEventListener('DOMContentLoaded', () => {
    const gpxPage = document.getElementById('page-gpx');
    if (gpxPage) {
        const observer = new MutationObserver(() => {
            if (gpxPage.classList.contains('active')) {
                initGPX();
            }
        });
        observer.observe(gpxPage, { attributes: true, attributeFilter: ['class'] });
        if (gpxPage.classList.contains('active')) initGPX();
    }
});
