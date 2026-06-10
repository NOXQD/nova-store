// === CHAT.JS ===
// Чат поддержки: плавающий виджет на всех страницах, rule-based бот,
// история переписки в LocalStorage.

(() => {
  const CHAT_KEY = 'novastore_chat';

  const RULES = [
    {
      keys: ['привет', 'здравств', 'добрый'],
      answer: 'Здравствуйте! Я помощник NOVA STORE. Спросите про доставку, оплату, возврат, промокоды или кабинет продавца.',
    },
    {
      keys: ['достав', 'курьер', 'пункт выдачи', 'когда придет', 'когда придёт'],
      answer: 'Доставка: пункт выдачи — бесплатно (2–4 дня), курьер до двери — $3 (1–2 дня). Способ выбирается при оформлении заказа.',
    },
    {
      keys: ['оплат', 'карт', 'плат'],
      answer: 'Оплата картой Visa, Mastercard или МИР. Карта привязывается при оформлении — мы храним только последние 4 цифры, полный номер и CVC никуда не сохраняются.',
    },
    {
      keys: ['возврат', 'вернуть', 'обмен'],
      answer: 'Возврат — 14 дней с момента получения, товар должен сохранить вид и упаковку. Оформить можно через Профиль → Мои заказы.',
    },
    {
      keys: ['заказ', 'статус', 'где мой'],
      answer: 'Все ваши заказы и их статусы — в разделе Профиль → Мои заказы. Номер заказа начинается с NS-.',
    },
    {
      keys: ['промокод', 'купон', 'скидк', 'акци'],
      answer: 'Действующие промокоды: NOVA10 (−10% на всё), SALE20 (−20% от $50), FIRST5 (−$5 от $20). Вводятся в корзине.',
    },
    {
      keys: ['продав', 'ип', 'иин', 'бизнес', 'торговать'],
      answer: 'Чтобы продавать на NOVA STORE, откройте «Кабинет продавца» и зарегистрируйте бизнес: ИП, ТОО или самозанятый, понадобится ИИН/БИН. Комиссия от 5%.',
    },
    {
      keys: ['избранн', 'сердечк', 'wishlist'],
      answer: 'Нажмите на сердечко на карточке товара — он сохранится в «Избранное». Раздел доступен после входа.',
    },
    {
      keys: ['сравн'],
      answer: 'Кнопка сравнения на карточке добавляет товар в «Сравнение» (до 4 товаров). Раздел — в меню или верхней полоске шапки.',
    },
    {
      keys: ['отзыв', 'оценк', 'рейтинг'],
      answer: 'Отзывы и оценки оставляют на странице товара. Все отзывы проходят ИИ-модерацию: спам, ссылки и оскорбления не публикуются.',
    },
    {
      keys: ['человек', 'оператор', 'менеджер'],
      answer: 'Передаю диалог оператору… В учебном проекте операторов нет, но в реальном магазине здесь подключился бы живой сотрудник 🙂',
    },
  ];

  const FALLBACK =
    'Не совсем понял вопрос. Я умею отвечать про: доставку, оплату, возврат, заказы, промокоды, избранное, сравнение и кабинет продавца.';

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(CHAT_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    localStorage.setItem(CHAT_KEY, JSON.stringify(history.slice(-40)));
  }

  function botAnswer(text) {
    const lower = text.toLowerCase();
    for (const rule of RULES) {
      if (rule.keys.some((k) => lower.includes(k))) return rule.answer;
    }
    return FALLBACK;
  }

  // ---------- UI ----------

  function buildWidget() {
    const fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'chatFab';
    fab.className = 'chat-fab';
    fab.setAttribute('aria-label', 'Чат поддержки');
    fab.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
      </svg>`;

    const panel = document.createElement('div');
    panel.id = 'chatPanel';
    panel.className = 'chat-panel glass-card';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="chat-header">
        <div>
          <strong>Поддержка NOVA</strong>
          <span class="chat-status">● онлайн</span>
        </div>
        <button type="button" class="chat-close" id="chatClose" aria-label="Закрыть чат">✕</button>
      </div>
      <div class="chat-messages" id="chatMessages" aria-live="polite"></div>
      <form class="chat-input-row" id="chatForm">
        <input type="text" id="chatInput" class="chat-input" placeholder="Напишите сообщение…" autocomplete="off" maxlength="300" aria-label="Сообщение в чат">
        <button type="submit" class="btn btn-primary chat-send" aria-label="Отправить">➤</button>
      </form>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    const messagesBox = panel.querySelector('#chatMessages');
    const form = panel.querySelector('#chatForm');
    const input = panel.querySelector('#chatInput');

    function appendMessage(msg, persist = true) {
      const el = document.createElement('div');
      el.className = `chat-msg chat-msg-${msg.from}`;
      el.textContent = msg.text;
      messagesBox.appendChild(el);
      messagesBox.scrollTop = messagesBox.scrollHeight;
      if (persist) {
        const history = loadHistory();
        history.push(msg);
        saveHistory(history);
      }
    }

    function showTyping() {
      const el = document.createElement('div');
      el.className = 'chat-msg chat-msg-bot chat-typing';
      el.textContent = 'печатает…';
      messagesBox.appendChild(el);
      messagesBox.scrollTop = messagesBox.scrollHeight;
      return el;
    }

    // История или приветствие
    const history = loadHistory();
    if (history.length === 0) {
      appendMessage({ from: 'bot', text: 'Здравствуйте! Чем помочь? Доставка, оплата, возврат, промокоды — спрашивайте 🙂' });
    } else {
      history.forEach((msg) => appendMessage(msg, false));
    }

    fab.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        messagesBox.scrollTop = messagesBox.scrollHeight;
        input.focus();
      }
    });

    panel.querySelector('#chatClose').addEventListener('click', () => {
      panel.hidden = true;
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      appendMessage({ from: 'user', text });

      const typing = showTyping();
      setTimeout(() => {
        typing.remove();
        appendMessage({ from: 'bot', text: botAnswer(text) });
      }, 700 + Math.random() * 600);
    });
  }

  document.addEventListener('DOMContentLoaded', buildWidget);
})();
