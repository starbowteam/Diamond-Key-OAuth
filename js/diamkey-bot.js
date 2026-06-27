// ======== DIAMOND AI MINI BOT ========
function setupDiamondBot() {
    if (document.getElementById('diamond-bot-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'diamond-bot-btn';
    btn.innerHTML = '<i class="fas fa-robot"></i>';
    btn.title = 'Спросить Diamond AI';
    document.body.appendChild(btn);

    const modal = document.createElement('div');
    modal.id = 'diamond-bot-modal';
    modal.className = 'diamond-bot-modal glass-panel';
    modal.innerHTML = `
        <div class="bot-header">
            <span>Diamond AI</span>
            <button class="btn btn-icon" id="close-bot-modal"><i class="fas fa-times"></i></button>
        </div>
        <div class="bot-messages" id="bot-messages"></div>
        <div class="bot-input-area">
            <input type="text" id="bot-input" placeholder="Задайте вопрос...">
            <button class="btn btn-icon" id="bot-send-btn"><i class="fas fa-paper-plane"></i></button>
        </div>
    `;
    document.body.appendChild(modal);

    btn.addEventListener('click', () => {
        modal.classList.toggle('show');
    });
    document.getElementById('close-bot-modal').addEventListener('click', () => {
        modal.classList.remove('show');
    });

    const sendBtn = document.getElementById('bot-send-btn');
    const input = document.getElementById('bot-input');
    const messages = document.getElementById('bot-messages');

    async function sendBotMessage() {
        const text = input.value.trim();
        if (!text) return;
        messages.innerHTML += `<div class="bot-msg user">${escapeHtml(text)}</div>`;
        input.value = '';
        const reply = await askDiamondAI(text);
        messages.innerHTML += `<div class="bot-msg bot">${escapeHtml(reply)}</div>`;
        messages.scrollTop = messages.scrollHeight;
    }

    sendBtn.addEventListener('click', sendBotMessage);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendBotMessage();
    });
}

document.addEventListener('DOMContentLoaded', setupDiamondBot);
