let gpxMap, gpxLayerGroup, elevationChart, currentGpxContent = null, hoverMarker = null;

function initGPX() {
    if (typeof L === 'undefined' || !document.getElementById('gpx-map')) return;
    if (gpxMap) { gpxMap.invalidateSize(); return; }

    const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20 });
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });

    gpxMap = L.map('gpx-map', {
        center: [55.751244, 37.618423], zoom: 10,
        layers: [satelliteLayer],
        zoomControl: true
    });
    gpxLayerGroup = L.featureGroup().addTo(gpxMap);

    // Переключатель слоёв
    const layerToggle = document.createElement('button');
    layerToggle.className = 'layer-toggle';
    layerToggle.textContent = 'Схема';
    layerToggle.onclick = () => {
        if (gpxMap.hasLayer(satelliteLayer)) {
            gpxMap.removeLayer(satelliteLayer);
            gpxMap.addLayer(streetLayer);
            layerToggle.textContent = 'Спутник';
        } else {
            gpxMap.removeLayer(streetLayer);
            gpxMap.addLayer(satelliteLayer);
            layerToggle.textContent = 'Схема';
        }
    };
    document.querySelector('.gpx-toolbar').appendChild(layerToggle);

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
                previewGpxBeforeSave(ev.target.result);
            } catch (err) { showToast('Ошибка: ' + err.message); }
        };
        reader.readAsText(file);
    });

    document.getElementById('saveGpxBtn').addEventListener('click', () => {
        const modal = document.getElementById('gpxNameModal');
        modal.style.display = 'flex';
        modal.classList.add('active');
    });

    document.getElementById('saveGpxNameBtn').addEventListener('click', async () => {
        const name = document.getElementById('gpxNameInput')?.value?.trim() || 'Без названия';
        await _supabase.from('gpx_files').insert([{ user_login: currentUser.login, name, content: currentGpxContent }]);
        closeModal('gpxNameModal');
        showToast('Прогулка опубликована!');
        // Кнопка «Поделиться» появится после перезагрузки профиля, но можем сразу дать ссылку
    });

    if (document.getElementById('page-gpx').classList.contains('active')) setTimeout(() => gpxMap.invalidateSize(), 100);
}

// Остальные функции (parseGPX, displayGPX, updateDashboard, showAIReview, haversine) без изменений
// ... (приведены ниже полностью)
