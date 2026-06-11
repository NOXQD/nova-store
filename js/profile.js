// === PROFILE.JS ===
// Личный кабинет: данные пользователя, привязанные карты, история заказов.

(() => {
  const authGate = document.getElementById('profileAuthGate');
  const layout = document.getElementById('profileLayout');
  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');
  const savedCards = document.getElementById('savedCards');
  const toggleCardFormBtn = document.getElementById('toggleCardFormBtn');
  const cardForm = document.getElementById('profileCardForm');
  const ordersList = document.getElementById('ordersList');

  const cardNumber = document.getElementById('cardNumber');
  const cardHolder = document.getElementById('cardHolder');
  const cardExp = document.getElementById('cardExp');
  const cardCvc = document.getElementById('cardCvc');

  // ---------- Карты ----------

  function renderCards() {
    const cards = loadCards();
    if (cards.length === 0) {
      savedCards.innerHTML = `<p class="card-list-empty">Пока нет привязанных карт</p>`;
      return;
    }
    savedCards.innerHTML = cards
      .map(
        (card) => `
        <div class="saved-card" data-id="${card.id}">
          <div class="saved-card-main">
            <span class="card-brand">${escapeHtml(card.brand)}</span>
            <span class="card-num">•••• ${card.last4}</span>
          </div>
          <div class="saved-card-meta">
            <span class="card-holder">${escapeHtml(card.holder)}</span>
            <span class="card-exp">${escapeHtml(card.exp)}</span>
          </div>
          <button type="button" class="cart-row-remove card-delete" data-id="${card.id}" aria-label="Удалить карту">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>`
      )
      .join('');
  }

  savedCards.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.card-delete');
    if (!deleteBtn) return;
    const cards = loadCards().filter((c) => c.id !== deleteBtn.dataset.id);
    saveCards(cards);
    renderCards();
    showToast('Карта удалена', 'info');
  });

  toggleCardFormBtn.addEventListener('click', () => {
    cardForm.hidden = !cardForm.hidden;
    toggleCardFormBtn.textContent = cardForm.hidden
      ? '+ Привязать новую карту'
      : 'Скрыть форму';
  });

  cardForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const { errors, card } = validateCardForm({
      number: cardNumber.value,
      holder: cardHolder.value,
      exp: cardExp.value,
      cvc: cardCvc.value,
    });

    const fields = { number: 'cardNumber', holder: 'cardHolder', exp: 'cardExp', cvc: 'cardCvc' };
    Object.entries(fields).forEach(([key, id]) => {
      const input = document.getElementById(id);
      const errorEl = document.getElementById(`${id}Error`);
      input.classList.toggle('invalid', Boolean(errors[key]));
      errorEl.textContent = errors[key] || '';
    });

    if (!card) {
      cardForm.classList.remove('shake');
      void cardForm.offsetWidth;
      cardForm.classList.add('shake');
      return;
    }

    const cards = loadCards();
    cards.push(card);
    saveCards(cards);

    cardForm.reset();
    cardForm.hidden = true;
    toggleCardFormBtn.textContent = '+ Привязать новую карту';
    renderCards();
    showToast(`Карта •••• ${card.last4} привязана`, 'success');
  });

  // ---------- Заказы ----------

  function formatDate(iso) {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function renderOrders() {
    const orders = loadOrders();
    if (orders.length === 0) {
      ordersList.innerHTML = `
        <p class="card-list-empty">Заказов пока нет</p>
        <a href="index.html" class="btn btn-primary">Перейти в каталог</a>
      `;
      return;
    }

    ordersList.innerHTML = orders
      .map(
        (order) => `
        <article class="order-card">
          <header class="order-header">
            <div>
              <span class="order-id">Заказ ${escapeHtml(order.id)}</span>
              <span class="order-date">${formatDate(order.date)}</span>
            </div>
            <span class="order-status">${escapeHtml(order.status)}</span>
          </header>
          <div class="order-items">
            ${order.items
              .map(
                (item) => `
              <a href="product.html?id=${item.id}" class="order-item" title="${escapeHtml(item.title)}">
                <span class="order-thumb">
                  <img src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy" width="48" height="48" onerror="handleImgError(this)">
                </span>
                <span class="order-item-qty">× ${item.quantity}</span>
              </a>`
              )
              .join('')}
          </div>
          <footer class="order-footer">
            <span>Оплачено картой ${escapeHtml(order.cardBrand)} •••• ${order.cardLast4}</span>
            <span class="order-total">$${order.total.toFixed(2)}</span>
          </footer>
        </article>`
      )
      .join('');
  }

  // ---------- Инициализация ----------

  document.addEventListener('DOMContentLoaded', () => {
    const user = getStoredUser();
    if (!user) {
      authGate.hidden = false;
      layout.hidden = true;
      return;
    }

    authGate.hidden = true;
    layout.hidden = false;

    profileName.textContent = user.name;
    profileEmail.textContent = user.email;

    attachCardInputMasks(cardNumber, cardExp, cardCvc);
    renderCards();
    renderOrders();
    renderThemePicker(document.getElementById('themePicker'));
  });
})();
