function setupDiamondBot() {
    if (document.getElementById('diamond-bot-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'diamond-bot-btn';
    btn.innerHTML = '<img src="/assets/logo-ai.ico" style="width:36px;height:36px;object-fit:contain;border-radius:50%;">';
    btn.title = 'Спросить Diamond AI';
    document.body.appendChild(btn);

    const modal = document.createElement('div');
    modal.id = 'diamond-bot-modal';
    modal.className = 'diamond-bot-modal glass-panel';
    modal.innerHTML = `
        <div class="bot-header">
            <div style="display:flex; align-items:center; gap:8px;">
                <img src="/assets/logo-ai.ico" style="width:32px;height:32px;border-radius:50%;">
                <span>Diamond AI</span>
            </div>
            <button class="btn btn-icon" id="close-bot-modal"><i class="fas fa-times"></i></button>
        </div>
        <div class="bot-messages" id="bot-messages"></div>
        <div class="bot-input-area">
            <input type="text" id="bot-input" placeholder="Спросите про DiamKey...">
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

    const SYSTEM_PROMPT = `Ты — Diamond AI, встроенный помощник на сайте DiamKey (diamkey.ru). Твоя единственная задача — помогать пользователям ориентироваться на сайте и объяснять функционал экосистемы Diamond. Ты не должен отвечать на общие вопросы, не связанные с DiamKey. Если вопрос выходит за рамки сайта, вежливо откажись и предложи воспользоваться полной версией Diamond AI.

ВАЖНО: Ты общаешься ТОЛЬКО чистым текстом. Запрещено использовать **жирный**, _курсив_, `код`, маркированные списки с * или -, и любые другие Markdown-символы. Пиши обычными предложениями, без форматирования.

ВОТ ЧТО ТЫ ДОЛЖЕН ЗНАТЬ О САЙТЕ:

1. Главная страница (/home): представление DiamKey, кнопка входа/регистрации, объявление создателя, преимущества системы (единый аккаунт, приватность, синхронизация).

2. Дополнения (/add): витрина сервисов. Сейчас там Diamond GPX — можно перейти по кнопке, чтобы загружать и просматривать GPS-треки.

3. Пользователи (/users): список всех зарегистрированных пользователей. По клику открывается профиль человека, где можно увидеть его аватар, описание, стену с сообщениями и кнопку «Поездки GPX» (пазл).

4. Профиль (/profile): личный профиль текущего пользователя. Можно сменить аватар, описание, посмотреть свою стену и перейти к своим GPX-поездкам (кнопка-пазл справа).

5. Поездки (/profile/ник/gpxview): страница со списком GPX-файлов пользователя. Карточки показывают название, дату, дистанцию и набор высоты. Есть кнопка «Назад» к профилю. Можно ставить реакции (❤️ 👍 🔥) на поездки.

6. GPX-просмотр (/add/gpx): инструмент для загрузки и просмотра GPS-треков. Отображается карта, график высот, статистика. Для чужих треков показывается имя владельца. Есть кнопка экспорта отчёта.

7. Уведомления: колокольчик в сайдбаре показывает новые события (реакции, сообщения на стене). При клике открывается панель с историей.

8. Стена: в профиле можно оставлять сообщения и ставить реакции (❤️ 👍 🔥). Поле ввода компактное, с аватаркой автора.

9. Статистика: в GPX-вью отображается общая дистанция и суммарный набор высоты.

10. Безопасность: все данные хранятся в Supabase, вход через DiamKey.

ТВОЙ СТИЛЬ: отвечай кратко, по делу, дружелюбно. Если пользователь спрашивает о чём-то, чего нет на сайте (например, прогноз погоды, столица Франции), скажи: «Я помогаю только с сайтом DiamKey. Для общих вопросов открой Diamond AI на diamond-ai.ru.»

ПРИМЕРЫ ОТВЕТОВ БЕЗ ФОРМАТИРОВАНИЯ:
— «Как посмотреть свои поездки?» → «Перейдите в профиль и нажмите на иконку пазла справа от аватара. Там будут все ваши GPX-файлы.»
— «Что такое DiamKey?» → «DiamKey — единая учётная запись для всех сервисов Diamond. Один аккаунт для AI, GPX и будущего мессенджера.»`;

    function showThinking() {
        const thinkingEl = document.createElement('div');
        thinkingEl.className = 'bot-msg bot thinking';
        thinkingEl.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Думаю…';
        messages.appendChild(thinkingEl);
        messages.scrollTop = messages.scrollHeight;
        return thinkingEl;
    }

    async function sendBotMessage() {
        const text = input.value.trim();
        if (!text) return;
        messages.innerHTML += `<div class="bot-msg user">${escapeHtml(text)}</div>`;
        input.value = '';
        messages.scrollTop = messages.scrollHeight;

        const thinkingEl = showThinking();

        const { data } = await _supabase.from('service_config').select('mistral_api_key').eq('id', 1).maybeSingle();
        if (!data?.mistral_api_key) {
            thinkingEl.remove();
            messages.innerHTML += `<div class="bot-msg bot">API-ключ не настроен.</div>`;
            messages.scrollTop = messages.scrollHeight;
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
                    max_tokens: 400,
                    temperature: 0.2
                })
            });
            const json = await resp.json();
            const reply = json.choices?.[0]?.message?.content || 'Нет ответа.';
            thinkingEl.remove();
            messages.innerHTML += `<div class="bot-msg bot">${escapeHtml(reply)}</div>`;
            messages.scrollTop = messages.scrollHeight;
        } catch (e) {
            thinkingEl.remove();
            messages.innerHTML += `<div class="bot-msg bot">Ошибка связи.</div>`;
            messages.scrollTop = messages.scrollHeight;
        }
    }

    sendBtn.addEventListener('click', sendBotMessage);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendBotMessage();
    });
}

document.addEventListener('DOMContentLoaded', setupDiamondBot);
