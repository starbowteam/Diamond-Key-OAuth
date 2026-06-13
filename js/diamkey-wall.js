// ==================== DIAMKEY FORUM – обсуждения ====================
async function loadTopics() {
    const { data: topics } = await _supabase.from('forum_topics').select('*').order('created_at', { ascending: false });
    const container = document.getElementById('forumTopics');
    container.innerHTML = topics.map(t => `
        <div class="glass-panel" style="margin-bottom: 12px; padding: 16px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <strong>${escapeHtml(t.user_login)}</strong>
                <span class="text-muted" style="margin-left:auto;">${new Date(t.created_at).toLocaleString()}</span>
            </div>
            <h4>${escapeHtml(t.title)}</h4>
            <p>${escapeHtml(t.content)}</p>
            <button class="btn" onclick="viewReplies(${t.id})">Ответы</button>
            <div id="replies-${t.id}" style="margin-top: 12px; display: none;"></div>
        </div>
    `).join('');
}

document.getElementById('createTopicBtn').addEventListener('click', async () => {
    const title = document.getElementById('topicTitle').value.trim();
    const content = document.getElementById('topicContent').value.trim();
    if (!title || !content) return;
    await _supabase.from('forum_topics').insert([{ user_login: currentUser.login, title, content }]);
    document.getElementById('topicTitle').value = '';
    document.getElementById('topicContent').value = '';
    loadTopics();
});

async function viewReplies(topicId) {
    const container = document.getElementById(`replies-${topicId}`);
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
    const { data: replies } = await _supabase.from('forum_replies').select('*').eq('topic_id', topicId).order('created_at');
    container.innerHTML = replies.map(r => `
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding: 8px 0;">
            <strong>${escapeHtml(r.user_login)}</strong>: ${escapeHtml(r.content)}
        </div>
    `).join('');
}
