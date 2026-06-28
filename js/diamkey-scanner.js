let qrScanner = null;

async function startQrScanner() {
    if (!currentUser) {
        showToast('Сначала войдите в DiamKey');
        return;
    }

    if (typeof QrScanner === 'undefined') {
        showToast('Сканер не загружен. Обновите страницу.');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'qr-scanner-modal';
    modal.innerHTML = `
        <div class="qr-scanner-content glass-panel">
            <div class="qr-scanner-header">
                <h3>Сканер QR-кода</h3>
                <button class="btn btn-icon" id="closeScannerBtn"><i class="fas fa-times"></i></button>
            </div>
            <video id="qr-video" style="width:100%; border-radius:16px;"></video>
            <p class="text-muted" style="text-align:center; margin-top:12px;">Наведите камеру на QR-код</p>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('closeScannerBtn').addEventListener('click', () => {
        stopScanner();
        modal.remove();
    });

    try {
        const video = document.getElementById('qr-video');
        qrScanner = new QrScanner(
            video,
            async (result) => {
                stopScanner();
                modal.remove();

                let ticket = null;
                try {
                    const url = new URL(result.data);
                    ticket = url.searchParams.get('ticket');
                } catch (e) {
                    if (result.data.startsWith('qr_')) ticket = result.data;
                }

                if (!ticket) {
                    showToast('Неверный QR-код');
                    return;
                }

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
            {
                returnDetailedScanResult: true,
                highlightScanRegion: true,
                highlightCodeOutline: true,
            }
        );
        await qrScanner.start();
    } catch (err) {
        modal.remove();
        showToast('Ошибка доступа к камере');
        console.error(err);
    }
}

function stopScanner() {
    if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
        qrScanner = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const scannerBtn = document.getElementById('qrScannerBtn');
    if (scannerBtn) {
        scannerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            startQrScanner();
        });
    }
});
