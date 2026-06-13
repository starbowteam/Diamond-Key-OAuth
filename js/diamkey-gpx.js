// ==================== DIAMOND GPX – карта и парсер (стиль DiamKey) ====================
let gpxMap, gpxLayerGroup, elevationChart, elevationData;

function initGPX() {
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
            try { displayGPX(parseGPX(ev.target.result)); }
            catch(err) { alert('Ошибка: ' + err.message); }
        };
        reader.readAsText(file);
    });
}

function parseGPX(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const tracks = [];
    xmlDoc.querySelectorAll('trk').forEach(trk => {
        const name = trk.querySelector('name')?.textContent?.trim() || '';
        const segments = [];
        trk.querySelectorAll('trkseg').forEach(seg => {
            const pts = [];
            seg.querySelectorAll('trkpt').forEach(pt => {
                const lat = +pt.getAttribute('lat'), lon = +pt.getAttribute('lon');
                const ele = parseFloat(pt.querySelector('ele')?.textContent);
                pts.push({ lat, lon, ele: isNaN(ele)?null:ele });
            });
            if (pts.length > 1) segments.push(pts);
        });
        if (segments.length) tracks.push({ name, segments });
    });
    return { tracks };
}

function displayGPX(data) {
    gpxLayerGroup.clearLayers();
    if (elevationChart) { elevationChart.destroy(); elevationChart = null; }
    const { tracks } = data;

    tracks.forEach((track, idx) => {
        track.segments.forEach(seg => {
            const latlngs = seg.map(p => [p.lat, p.lon]);
            L.polyline(latlngs, { color: '#ff6b6b', weight: 5, opacity: 0.85 }).addTo(gpxLayerGroup);
        });
    });

    if (gpxLayerGroup.getLayers().length) {
        const bounds = gpxLayerGroup.getBounds();
        if (bounds.isValid()) gpxMap.fitBounds(bounds, { padding: [40,40], maxZoom:16 });
    }

    updateDashboard(tracks);
}

function updateDashboard(tracks) {
    let allPoints = [];
    tracks.forEach(t => t.segments.forEach(seg => allPoints.push(...seg)));
    let totalDist = 0, ascent = 0;
    let cumDist = 0;
    elevationData = [];
    for (let i=0; i<allPoints.length; i++) {
        if (i>0) {
            const prev = allPoints[i-1], pt = allPoints[i];
            const d = haversine(prev.lat, prev.lon, pt.lat, pt.lon);
            totalDist += d;
            cumDist += d;
            if (prev.ele !== null && pt.ele !== null) {
                const diff = pt.ele - prev.ele;
                if (diff>0) ascent += diff;
            }
        }
        if (allPoints[i].ele !== null) elevationData.push({ dist: cumDist, ele: allPoints[i].ele });
    }

    document.getElementById('distVal').textContent = totalDist > 1000 ? (totalDist/1000).toFixed(2)+' км' : totalDist.toFixed(0)+' м';
    document.getElementById('ascentVal').textContent = ascent > 0 ? '+' + ascent.toFixed(0)+' м' : '—';
    document.getElementById('timeVal').textContent = '—';
    document.getElementById('speedVal').textContent = '—';

    if (elevationData.length > 1) {
        document.getElementById('noElevationMsg').style.display = 'none';
        const ctx = document.getElementById('elevationChart').getContext('2d');
        elevationChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: elevationData.map(p => (p.dist/1000).toFixed(1)),
                datasets: [{
                    data: elevationData.map(p => p.ele),
                    borderColor: '#4ecdc4',
                    backgroundColor: 'rgba(78,205,196,0.12)',
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
                    x: { ticks: { color: '#888', maxTicksLimit: 6 }, grid: { color: '#222' } },
                    y: { ticks: { color: '#888' }, grid: { color: '#222' } }
                }
            }
        });
    } else {
        document.getElementById('noElevationMsg').style.display = 'block';
    }
}

function haversine(lat1,lon1,lat2,lon2) {
    const R=6371000, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function resetGPX() {
    gpxLayerGroup.clearLayers();
    if (elevationChart) { elevationChart.destroy(); elevationChart = null; }
    elevationData = [];
    document.getElementById('distVal').textContent = '—';
    document.getElementById('ascentVal').textContent = '—';
    document.getElementById('timeVal').textContent = '—';
    document.getElementById('speedVal').textContent = '—';
    document.getElementById('noElevationMsg').style.display = 'block';
    document.getElementById('gpx-file-input').value = '';
    gpxMap.setView([55.751244, 37.618423], 10);
}
