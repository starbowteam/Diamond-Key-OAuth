// diamkey-reactions.js — модалка выбора эмодзи для реакций на стене
(function() {
  // Инжектим стили модалки
  const style = document.createElement('style');
  style.textContent = `
    .emoji-modal-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.8); backdrop-filter: blur(10px);
      z-index: 1000; display: flex; align-items: center; justify-content: center;
      opacity: 0; visibility: hidden; transition: opacity 0.25s, visibility 0.25s;
    }
    .emoji-modal-overlay.active { opacity: 1; visibility: visible; }
    .emoji-modal {
      background: var(--bg-glass, rgba(18,18,24,0.85));
      backdrop-filter: blur(24px);
      border: 1px solid var(--border-glass, rgba(255,255,255,0.12));
      border-radius: 28px;
      padding: 24px;
      width: 580px;
      max-width: 95vw;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .emoji-modal-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 20px;
    }
    .emoji-modal-title { font-weight: 700; font-size: 18px; color: var(--text-primary); }
    .emoji-categories {
      display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;
    }
    .emoji-cat-btn {
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border-glass);
      border-radius: 20px; padding: 6px 14px;
      cursor: pointer; color: var(--text-muted);
      font-size: 14px; display: flex; align-items: center; gap: 6px;
      transition: all 0.2s;
    }
    .emoji-cat-btn.active { background: var(--accent); color: #0a0a0f; border-color: var(--accent); }
    .emoji-cat-btn:hover { background: rgba(255,255,255,0.08); }
    .emoji-grid {
      display: flex; flex-wrap: wrap; gap: 10px;
      justify-content: flex-start; padding: 4px;
    }
    .emoji-item {
      width: 50px; height: 50px;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px;
      border-radius: 14px;
      cursor: pointer;
      transition: background 0.15s;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .emoji-item:hover { background: rgba(255,255,255,0.12); }
    .emoji-close-btn {
      background: none; border: none; color: var(--text-muted);
      font-size: 20px; cursor: pointer; transition: color 0.2s;
    }
    .emoji-close-btn:hover { color: var(--text-primary); }
  `;
  document.head.appendChild(style);

  // Данные эмодзи по категориям
  const emojiData = {
    people: ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
    gestures: ['👍','👎','👏','🙌','🤝','🤜','🤛','✊','👊','🤚','👋','🖐','✋','🖖','👌','🤏','✌️','🤞','🤟','🤘','🤙','🖕','☝️','👆','👇','👉','👈','✍️','🙏','💪','🤳'],
    hearts: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️'],
    emotions: ['🔥','⭐','🌟','✨','💥','💯','💢','💫','💦','💨','💣','💬','💭','🗯️','💤','💀','☠️','👻','👽','🤖'],
    celebrations: ['🎉','🎊','🎈','🎂','🎀','🎁','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎯','🎲','🎳','🎮','🎰','🎨','🎭','🎬','🎤','🎧','🎼','🎹','🥁','🎸']
  };

  // Строим модалку в DOM
  const overlay = document.createElement('div');
  overlay.className = 'emoji-modal-overlay';
  overlay.id = 'emojiModalOverlay';
  overlay.innerHTML = `
    <div class="emoji-modal">
      <div class="emoji-modal-header">
        <span class="emoji-modal-title">Выбрать реакцию</span>
        <button class="emoji-close-btn" id="emojiModalClose"><i class="fas fa-times"></i></button>
      </div>
      <div class="emoji-categories" id="emojiCats">
        <button class="emoji-cat-btn active" data-cat="people"><i class="fas fa-smile"></i> Люди</button>
        <button class="emoji-cat-btn" data-cat="gestures"><i class="fas fa-hand-peace"></i> Жесты</button>
        <button class="emoji-cat-btn" data-cat="hearts"><i class="fas fa-heart"></i> Сердца</button>
        <button class="emoji-cat-btn" data-cat="emotions"><i class="fas fa-face-laugh"></i> Эмоции</button>
        <button class="emoji-cat-btn" data-cat="celebrations"><i class="fas fa-party-horn"></i> Праздники</button>
      </div>
      <div class="emoji-grid" id="emojiGrid"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  let currentPostId = null;

  function renderEmoji(category) {
    const grid = document.getElementById('emojiGrid');
    const list = emojiData[category] || [];
    grid.innerHTML = list.map(emoji =>
      `<div class="emoji-item" data-emoji="${emoji}">${emoji}</div>`
    ).join('');
  }

  // Выбор эмодзи
  document.getElementById('emojiGrid').addEventListener('click', (e) => {
    const item = e.target.closest('.emoji-item');
    if (!item) return;
    const emoji = item.dataset.emoji;
    if (currentPostId && typeof toggleReaction === 'function') {
      toggleReaction(currentPostId, emoji);
    }
    closeModal();
  });

  // Категории
  document.getElementById('emojiCats').addEventListener('click', (e) => {
    const btn = e.target.closest('.emoji-cat-btn');
    if (!btn) return;
    document.querySelectorAll('.emoji-cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderEmoji(btn.dataset.cat);
  });

  // Закрытие
  function closeModal() {
    overlay.classList.remove('active');
    currentPostId = null;
  }

  document.getElementById('emojiModalClose').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Инициализация первой категории
  renderEmoji('people');

  // Глобальная функция открытия модалки
  window.openReactionPicker = function(postId) {
    currentPostId = postId;
    overlay.classList.add('active');
  };
})();
