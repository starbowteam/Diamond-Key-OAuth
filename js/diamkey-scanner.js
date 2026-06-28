let html5QrCode = null;

async function startQrScanner() {
    if (!currentUser) {
        showToast('Сначала войдите в DiamKey');
        return;
    }

    // Проверяем поддержку камеры
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Камера недоступна');
        return;
    }

    // Создаём модальное окно
    const modal = document.createElement('div');
    modal.className = 'qr-scanner-modal';
    modal.innerHTML = `
        <div class="qr-scanner-content glass-panel">
            <div class="qr-scanner-header">
                <h3>Сканер QR-кода</h3>
                <button class="btn btn-icon" id="closeScannerBtn"><i class="fas fa-times"></i></button>
            </div>
            <div id="qr-reader" style="width:100%;"></div>
            <p class="text-muted" style="text-align:center; margin-top:12px;">Наведите камеру на QR-код</p>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('closeScannerBtn').addEventListener('click', () => {
        stopScanner();
        modal.remove();
    });

    try {
        if (typeof Html5Qrcode === 'undefined') {
            throw new Error('Библиотека сканера не загружена');
        }
        html5QrCode = new Html5Qrcode("qr-reader");
        await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            async (decodedText, decodedResult) => {
                // Остановить сканирование
                stopScanner();
                modal.remove();
                
                // Извлечь ticket из URL
                let ticket = null;
                try {
                    const url = new URL(decodedText);
                    ticket = url.searchParams.get('ticket');
                } catch (e) {
                    // Если не URL, может быть просто ticket
                    if (decodedText.startsWith('qr_')) ticket = decodedText;
                }
                if (!ticket) {
                    showToast('Неверный QR-код');
                    return;
                }

                // Подтверждаем вход
                const { error } = await _supabase
                    .from('qr_tickets')
                    .update({ login: currentUser.login, status: 'accepted' })
                    .eq('ticket', ticket);
                if (error) {
                    showToast('Ошибка подтверждения');
                    return;
                }
                showToast('Вход подтверждён!');
            },
            (errorMessage) => {
                // Игнорируем ошибки сканирования
            }
        );
    } catch (err) {
        modal.remove();
        showToast('Ошибка доступа к камере');
        console.error(err);
    }
}

function stopScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            html5QrCode = null;
        }).catch(err => console.warn(err));
    }
}

// Привязываем кнопку в сайдбаре
document.addEventListener('DOMContentLoaded', () => {
    const scannerBtn = document.getElementById('qrScannerBtn');
    if (scannerBtn) {
        scannerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            startQrScanner();
        });
    }
});
