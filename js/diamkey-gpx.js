let gpxMap = null;
let gpxLayerGroup = null;
let elevationChart = null;
let currentGpxContent = null;
let hoverMarker = null;
let gpxInitialized = false;

const AI_REVIEWS = [
    "Отличная поездка! Ты проехал {dist} км. Рекомендую добавить фото к маршруту, чтобы сохранить воспоминания. Поддерживай темп и не забывай про разминку перед стартом.",
    "Неплохой маршрут! {dist} км — хорошая дистанция. Попробуй в следующий раз увеличить набор высоты для более интенсивной тренировки. Не забудь взять с собой воду!",
    "Твой заезд на {dist} км впечатляет! Обрати внимание на скорость на спусках — безопасность прежде всего. Используй приложения для отслеживания прогресса.",
    "Прекрасная прогулка! {dist} км — отличный результат. Анализируй свой график высот, чтобы лучше планировать усилия. Помни, что отдых так же важен, как и нагрузка.",
    "Маршрут на {dist} км покорён! Как насчёт того, чтобы в следующий раз исследовать новую местность? Открывай для себя интересные места и делись с друзьями.",
    "Ты проехал {dist} км! Это достойно уважения. Следи за давлением в шинах и состоянием цепи — это влияет на комфорт. Хорошей дороги!",
    "Шикарный трек! {dist} км позади. Попробуй записывать свои ощущения после каждой поездки — это поможет улучшить форму. И не забывай про защиту!",
    "Твой путь длиной {dist} км впечатляет. Советую синхронизировать GPX с календарём, чтобы видеть прогресс по неделям. Дисциплина — ключ к успеху.",
    "Отличная работа! {dist} км — с каждым разом ты становишься сильнее. Включай в маршруты интервальные участки для развития выносливости. Удачи!",
    "Поздравляю с завершением {dist} км! Помни, что правильное питание после поездки ускоряет восстановление. Банан и протеиновый коктейль — твои друзья.",
    "Ты проехал {dist} км! Это достижение. Попробуй в следующий раз ехать с другом — вместе веселее и безопаснее. Делись маршрутами в сообществе.",
    "Маршрут на {dist} км выполнен! Обрати внимание на погоду перед выездом — ветер может сильно повлиять на удовольствие. Будь готов ко всему!",
    "Твой заезд на {dist} км — круто! Не забывай разминать шею и плечи во время остановок. Здоровье превыше всего. Продолжай в том же духе!",
    "Поездка на {dist} км удалась! Рекомендую ставить небольшие цели на каждую неделю — это мотивирует. Маленькие шаги ведут к большим результатам.",
    "Классный маршрут! {dist} км — ты молодец. Проверь настройки GPS перед записью, чтобы трек был максимально точным. Детали имеют значение.",
    "Твой GPX-файл на {dist} км загружен. Анализируй среднюю скорость и пульс (если есть датчик) для оптимизации тренировок. Данные — сила!",
    "Поздравляю с завершением {dist} км! Планируй маршруты заранее, чтобы избегать опасных участков. Безопасная поездка — лучшая поездка.",
    "Отличная дистанция! {dist} км — ты супер. Попробуй разнообразить маршруты: лес, город, горы — каждый тип даёт уникальный опыт. Экспериментируй!",
    "Твой трек на {dist} км впечатляет. Не забывай заряжать устройства перед поездкой — севший телефон может испортить впечатление. Заряжайся энергией!",
    "Маршрут пройден! {dist} км — это серьёзно. Делись своими достижениями с сообществом Diamond, чтобы вдохновлять других. Вместе мы сильнее!"
];

function initGPX() {
    if (typeof L === 'undefined' || !document.getElementById('gpx-map')) {
        console.warn('[DiamKey] Leaflet не загружен или карта отсутствует');
        return;
    }
    if (gpxInitialized) {
        console.log('[DiamKey] Карта уже инициализирована');
        if (gpxMap) gpxMap.invalidateSize();
        return;
    }

    console.log('[DiamKey] Инициализация карты');
    const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20 });

    gpxMap = L.map('gpx-map', {
        center: [55.751244, 37.618423],
        zoom: 10,
        layers: [satelliteLayer],
        zoomControl: true
    });
    gpxLayerGroup = L.featureGroup().addTo(gpxMap);
    gpxInitialized = true;

    document.getElementById('gpx-file-input').addEventListener('change', function(e) {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const data = parseGPX(ev.target.result);
                displayGPX(data);
                currentGpxContent = ev.target.result;
                document.getElementById('saveGpxBtn').style.display = 'inline-flex';
                showAIReview(data);
                if (typeof previewGpxBeforeSave === 'function') previewGpxBeforeSave(ev.target.result);
            } catch (err) { showToast('Ошибка: ' + err.message); }
        };
        reader.readAsText(file);
    });

    document.getElementById('saveGpxBtn').addEventListener('click', () => {
        const modal = document.getElementById('gpxNameModal');
        if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); }
    });

    document.getElementById('saveGpxNameBtn').addEventListener('click', async () => {
        const name = document.getElementById('gpxNameInput')?.value?.trim() || 'Без названия';
        if (!currentUser) return showToast('Войдите');
        const { error } = await _supabase.from('gpx_files').insert([{ user_login: currentUser.login, name, content: currentGpxContent }]);
        if (error) {
            console.error('[DiamKey] Ошибка сохранения GPX:', error);
            return showToast('Ошибка сохранения');
        }
        closeModal('gpxNameModal');
        showToast('Опубликовано!');
        document.getElementById('saveGpxBtn').style.display = 'none';
    });

    if (document.getElementById('page-add-gpx') && document.getElementById('page-add-gpx').classList.contains('active')) {
        setTimeout(() => gpxMap.invalidateSize(), 100);
    }
}

async function loadGpxFromId(gpxId) {
    console.log('[DiamKey] Загрузка GPX по ID:', gpxId);
    if (!gpxMap) {
        console.warn('[DiamKey] Карта ещё не готова, пробуем позже');
        setTimeout(() => loadGpxFromId(gpxId), 200);
        return;
    }
    const { data, error } = await _supabase.from('gpx_files').select('content, name, user_login').eq('id', gpxId).maybeSingle();
    if (error || !data || !data.content) {
        console.error('[DiamKey] Ошибка получения GPX:', error);
        return showToast('Не удалось загрузить маршрут');
    }
    try {
        const parsed = parseGPX(data.content);
        displayGPX(parsed);
        gpxMap.invalidateSize();
        
        if (currentUser && currentUser.login === data.user_login) {
            showAIReview(parsed);
            document.getElementById('gpxOwnerInfo').style.display = 'none';
        } else {
            document.getElementById('aiReview').style.display = 'none';
            const ownerInfo = document.getElementById('gpxOwnerInfo');
            ownerInfo.style.display = 'block';
            const { data: owner } = await _supabase.from('users').select('avatar').eq('login', data.user_login).maybeSingle();
            const avatarHTML = owner?.avatar 
                ? `<img src="${escapeHtml(owner.avatar)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">`
                : '<i class="fas fa-user" style="font-size:48px;color:var(--text-muted);"></i>';
            ownerInfo.innerHTML = `
                <div class="gpx-name">${escapeHtml(data.name)}</div>
                <div style="display:flex; align-items:center; justify-content:center; gap:12px; margin-top:8px;">
                    ${avatarHTML}
                    <span class="owner-name">${escapeHtml(data.user_login)}</span>
                </div>
            `;
        }
    } catch (e) {
        console.error('[DiamKey] Ошибка парсинга GPX:', e);
        showToast('Ошибка обработки маршрута');
    }
}

function parseGPX(xmlString) {
    const parser = new DOMParser(); const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const tracks = [];
    xmlDoc.querySelectorAll('trk').forEach(trk => {
        const segments = [];
        trk.querySelectorAll('trkseg').forEach(seg => {
            const pts = [];
            seg.querySelectorAll('trkpt').forEach(pt => {
                const lat = +pt.getAttribute('lat'), lon = +pt.getAttribute('lon');
                const ele = parseFloat(pt.querySelector('ele')?.textContent);
                const time = pt.querySelector('time')?.textContent;
                pts.push({ lat, lon, ele: isNaN(ele)?null:ele, time: time ? new Date(time) : null });
            });
            if (pts.length > 1) segments.push(pts);
        });
        if (segments.length) tracks.push({ segments });
    });
    return { tracks };
}

function displayGPX(data) {
    gpxLayerGroup.clearLayers();
    if (elevationChart) { elevationChart.destroy(); elevationChart = null; }
    data.tracks.forEach(track => {
        track.segments.forEach(seg => {
            L.polyline(seg.map(p => [p.lat, p.lon]), { color: '#4ecdc4', weight: 5, opacity: 0.9 }).addTo(gpxLayerGroup);
            const start = seg[0], end = seg[seg.length-1];
            L.marker([start.lat, start.lon], { icon: L.divIcon({ className: 'gpx-marker-start', html: '<i class="fas fa-flag-checkered"></i>', iconSize: [30,30], iconAnchor: [15,30] }) }).addTo(gpxLayerGroup).bindPopup('Старт');
            if (seg.length > 1) L.marker([end.lat, end.lon], { icon: L.divIcon({ className: 'gpx-marker-end', html: '<i class="fas fa-flag"></i>', iconSize: [30,30], iconAnchor: [15,30] }) }).addTo(gpxLayerGroup).bindPopup('Финиш');
        });
    });
    if (gpxLayerGroup.getLayers().length) { const bounds = gpxLayerGroup.getBounds(); if (bounds.isValid()) gpxMap.fitBounds(bounds, { padding: [40,40], maxZoom:16 }); }
    updateDashboard(data.tracks);
    gpxMap.invalidateSize();
}

function updateDashboard(tracks) {
    let allPoints = []; tracks.forEach(t => t.segments.forEach(seg => allPoints.push(...seg)));
    if (!allPoints.length) return;
    let totalDist = 0, ascent = 0, cumDist = 0;
    const elevationData = [];
    let startTime = null, endTime = null;
    for (let i=0; i<allPoints.length; i++) {
        if (i>0) {
            const prev = allPoints[i-1], pt = allPoints[i];
            const d = haversine(prev.lat, prev.lon, pt.lat, pt.lon);
            totalDist += d; cumDist += d;
            if (prev.ele !== null && pt.ele !== null && pt.ele > prev.ele) ascent += pt.ele - prev.ele;
        }
        if (allPoints[i].time) {
            if (!startTime || allPoints[i].time < startTime) startTime = allPoints[i].time;
            if (!endTime || allPoints[i].time > endTime) endTime = allPoints[i].time;
        }
        if (allPoints[i].ele !== null) elevationData.push({ dist: cumDist, ele: allPoints[i].ele, lat: allPoints[i].lat, lon: allPoints[i].lon });
    }
    document.getElementById('distVal').textContent = totalDist > 1000 ? (totalDist/1000).toFixed(2)+' км' : totalDist.toFixed(0)+' м';
    document.getElementById('ascentVal').textContent = ascent > 0 ? '+' + ascent.toFixed(0)+' м' : '—';
    if (startTime && endTime) {
        const durationSec = (endTime - startTime) / 1000;
        const h = Math.floor(durationSec/3600), m = Math.floor((durationSec%3600)/60);
        document.getElementById('timeVal').textContent = h ? `${h}ч ${m}м` : `${m}м`;
        const speedKmh = totalDist > 0 ? ((totalDist/1000) / (durationSec/3600)).toFixed(1) : '—';
        document.getElementById('speedVal').textContent = speedKmh !== '—' ? speedKmh + ' км/ч' : '—';
    } else { document.getElementById('timeVal').textContent = '—'; document.getElementById('speedVal').textContent = '—'; }
    if (elevationData.length > 1) {
        const ctx = document.getElementById('elevationChart').getContext('2d');
        elevationChart = new Chart(ctx, { type: 'line', data: { labels: elevationData.map(p => (p.dist/1000).toFixed(1)), datasets: [{ data: elevationData.map(p => p.ele), borderColor: '#4ecdc4', backgroundColor: 'rgba(78,205,196,0.2)', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'км', color: '#888' }, ticks: { color: '#888' } }, y: { title: { display: true, text: 'м', color: '#888' }, ticks: { color: '#888' } } }, onHover: (event, elements) => { if (elements.length > 0 && gpxMap) { const point = elevationData[elements[0].index]; if (point && point.lat) { if (!hoverMarker) hoverMarker = L.circleMarker([point.lat, point.lon], { radius: 8, color: '#ff6b6b', fillColor: '#ff6b6b', fillOpacity: 0.8 }).addTo(gpxMap); else hoverMarker.setLatLng([point.lat, point.lon]); } } else { if (hoverMarker) { gpxMap.removeLayer(hoverMarker); hoverMarker = null; } } } } });
    }
}

function showAIReview(data) {
    const box = document.getElementById('aiReview');
    if (!box) return;
    let allPoints = []; data.tracks.forEach(t => t.segments.forEach(seg => allPoints.push(...seg)));
    let totalDist = 0; for (let i=1; i<allPoints.length; i++) totalDist += haversine(allPoints[i-1].lat, allPoints[i-1].lon, allPoints[i].lat, allPoints[i].lon);
    const distStr = totalDist > 1000 ? (totalDist/1000).toFixed(1) + ' км' : totalDist.toFixed(0) + ' м';
    const randomReview = AI_REVIEWS[Math.floor(Math.random() * AI_REVIEWS.length)].replace('{dist}', distStr);
    
    box.innerHTML = `
        <img src="/assets/logo-ai.ico" style="width:56px;height:56px;border-radius:50%;object-fit:cover;">
        <p>${randomReview}</p>
    `;
    box.style.display = 'flex';
}

function haversine(lat1,lon1,lat2,lon2) {
    const R=6371000, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

document.addEventListener('DOMContentLoaded', () => {
    const gpxPage = document.getElementById('page-add-gpx');
    if (gpxPage) {
        const observer = new MutationObserver(() => { if (gpxPage.classList.contains('active')) initGPX(); });
        observer.observe(gpxPage, { attributes: true, attributeFilter: ['class'] });
        if (gpxPage.classList.contains('active')) initGPX();
    }
});
