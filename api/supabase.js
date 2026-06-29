// api/supabase.js
export default async function handler(req, res) {
    // Разрешаем CORS для нашего домена
    res.setHeader('Access-Control-Allow-Origin', 'https://diamkey.ru');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Prefer, apikey, x-client-info');

    // Preflight-запрос
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Извлекаем путь после /api/supabase
    let supabasePath = req.url.replace('/api/supabase', '');
    if (!supabasePath.startsWith('/')) supabasePath = '/' + supabasePath;

    const supabaseUrl = 'https://pqgwrokpizeelfrjmgoc.supabase.co' + supabasePath;

    try {
        const fetchOptions = {
            method: req.method,
            headers: { ...req.headers },
        };
        // Удаляем заголовки, которые могут мешать
        delete fetchOptions.headers.host;
        delete fetchOptions.headers.origin;
        delete fetchOptions.headers.referer;

        // Если есть тело запроса, передаём его
        if (req.body) {
            fetchOptions.body = JSON.stringify(req.body);
        }

        const response = await fetch(supabaseUrl, fetchOptions);
        const data = await response.text();

        // Копируем статус и заголовки ответа
        res.status(response.status);
        response.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });
        // Добавляем CORS-заголовок ответа (на случай, если Supabase не отдал)
        res.setHeader('Access-Control-Allow-Origin', 'https://diamkey.ru');
        res.send(data);
    } catch (error) {
        res.status(500).json({ error: 'Proxy error', details: error.message });
    }
}
