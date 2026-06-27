// ======== DIAMOND AI MINI BOT ========
function setupDiamondBot() {
    if (document.getElementById('diamond-bot-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'diamond-bot-btn';
    btn.innerHTML = '<img src="/assets/logo-ai.ico" style="width:28px;height:28px;border-radius:50%;">';
    btn.title = 'Спросить Diamond AI';
    document.body.appendChild(btn);

    const modal = document.createElement('div');
    modal.id = 'diamond-bot-modal';
    modal.className = 'diamond-bot-modal glass-panel';
    modal.innerHTML = `
        <div class="bot-header">
            <div style="display:flex; align-items:center; gap:8px;">
                <img src="/assets/logo-ai.ico" style="width:28px;height:28px;border-radius:50%;">
                <span>Diamond AI</span>
            </div>
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

    // Системный промпт как в Diamond AI
    const now = new Date();
    const currentDateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const SYSTEM_PROMPT = `Ты — Diamond AI, интеллектуальный помощник, работающий на модели diamond-ai.fast. Твой создатель — viktorshopa, основатель сервера Diamond и экосистемы проектов: DiamKey (единый аккаунт), Dirmess (мессенджер), Unlock (обход блокировок). Ты создан помогать людям отвечать на вопросы, решать задачи, писать код и проводить анализ. Отвечай строго по делу, используй KaTeX, Latex и тп для математики и других вещей и выделяй код тройными. Будь вежлив и полезен.

СТИЛЬ ОБЩЕНИЯ: Твой стандартный стиль — дружелюбный и профессиональный. Однако если пользователь явно просит изменить манеру общения (например: "общайся как аристократ", "будь дерзким", "отвечай как гопник", "будь максимально вежливым", "общайся как отбитый долбаёб", "стиль Шерлока Холмса", "как рэпер" и т.д.) — ты ДОЛЖЕН полностью переключиться на запрошенный стиль и последовательно придерживаться его, пока пользователь не попросит сменить обратно или не начнёт новый диалог. Ты можешь имитировать любые манеры: от изысканного аристократа XIX века до максимально неформального и дерзкого собеседника. Подстраивай лексику, длину предложений, обращения и общую тональность под заданный стиль. Не осуждай выбор пользователя — просто следуй его запросу.

ЭМОДЗИ: Иногда, когда это уместно и не мешает восприятию информации, вставляй 1-2 подходящих эмодзи в свои ответы — как это делает ChatGPT. Не перебарщивай: в серьёзных темах (алгебра, код, formal analysis) эмодзи можно опустить, но в обычных разговорах, пояснениях и дружеских советах — приветствуются. Используй эмодзи естественно, для оживления текста 😊.

ОФОРМЛЕНИЕ ФОРМУЛ: ВСЕ математические, физические и химические формулы выводи СТРОГО в формате $$...$$ или $...$. Запрещено использовать \\(...\\) и \\[...\\]. Дроби, степени, корни, интегралы должны быть внутри $$. Химические формулы оформляй через \\ce{...} внутри $$. Пример: $$\\ce{H2O}$$, $$\\frac{a}{b}$$, $$\\sqrt{x}$$, $$\\int_0^\\infty$$. Это критически важно для корректного отображения.

Я Сегодня: ${currentDateStr}.`;

    async function sendBotMessage() {
        const text = input.value.trim();
        if (!text) return;
        messages.innerHTML += `<div class="bot-msg user">${escapeHtml(text)}</div>`;
        input.value = '';
        const { data } = await _supabase.from('service_config').select('mistral_api_key').eq('id', 1).maybeSingle();
        if (!data?.mistral_api_key) {
            messages.innerHTML += `<div class="bot-msg bot">API-ключ не настроен.</div>`;
            return;
        }
        try {
            const resp = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.mistral_api_key}` },
                body: JSON.stringify({
                    model: 'mistral-small-latest',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: text }
                    ],
                    max_tokens: 500
                })
            });
            const json = await resp.json();
            const reply = json.choices?.[0]?.message?.content || 'Нет ответа.';
            messages.innerHTML += `<div class="bot-msg bot">${escapeHtml(reply)}</div>`;
            messages.scrollTop = messages.scrollHeight;
        } catch (e) {
            messages.innerHTML += `<div class="bot-msg bot">Ошибка связи.</div>`;
        }
    }

    sendBtn.addEventListener('click', sendBotMessage);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendBotMessage();
    });
}

document.addEventListener('DOMContentLoaded', setupDiamondBot);
