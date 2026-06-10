// === CART.JS ===
// Корзина: гейт авторизации, рендер из LocalStorage, изменение количества,
// удаление с анимацией, многошаговое оформление: заказ → карта → оплата → успех.

(() => {
  const authGate = document.getElementById('cartAuthGate');
  const layout = document.getElementById('cartLayout');
  const itemsBox = document.getElementById('cartItems');
  const emptyBlock = document.getElementById('cartEmpty');
  const summaryCount = document.getElementById('summaryCount');
  const summaryTotal = document.getElementById('summaryTotal');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const clearBtn = document.getElementById('clearCartBtn');

  const modal = document.getElementById('checkoutModal');
  const modalBody = document.getElementById('modalBody');
  const stepOrder = document.getElementById('stepOrder');
  const stepCard = document.getElementById('stepCard');
  const stepPaying = document.getElementById('stepPaying');
  const stepSuccess = document.getElementById('stepSuccess');
  const cardList = document.getElementById('cardList');
  const addCardBtn = document.getElementById('addCardBtn');
  const payBtn = document.getElementById('payBtn');
  const modalCancel = document.getElementById('modalCancel');
  const modalClose = document.getElementById('modalClose');
  const successOrderInfo = document.getElementById('successOrderInfo');

  const cardForm = document.getElementById('cardForm');
  const cardNumber = document.getElementById('cardNumber');
  const cardHolder = document.getElementById('cardHolder');
  const cardExp = document.getElementById('cardExp');
  const cardCvc = document.getElementById('cardCvc');
  const cardBackBtn = document.getElementById('cardBackBtn');

  const cart = Cart.load();
  let displayedTotal = cart.getTotal();
  let clearArmed = false;
  let clearArmTimer = null;
  let selectedCardId = null;
  let orderPlaced = false;

  // ---------- Плавная анимация числа итога ----------

  function animateNumber(el, from, to, duration = 450) {
    // В фоновой вкладке requestAnimationFrame заморожен — ставим значение сразу
    if (document.hidden || from === to) {
      el.textContent = `$${to.toFixed(2)}`;
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = `$${(from + (to - from) * eased).toFixed(2)}`;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function calculateTotal() {
    const total = cart.getTotal();
    summaryCount.textContent = cart.getCount();
    animateNumber(summaryTotal, displayedTotal, total);
    displayedTotal = total;
  }

  // ---------- Рендер корзины ----------

  function renderRow(item, index, animate) {
    const p = item.product;
    const title = escapeHtml(p.title);
    const delay = animate ? `--d: ${index * 0.07}s` : '--d: 0s; animation: none';
    return `
      <div class="cart-row" data-id="${p.id}" style="${delay}">
        <a href="product.html?id=${p.id}" class="cart-thumb">
          <img
            src="${p.image}"
            alt="${title}"
            loading="lazy"
            width="64"
            height="64"
            onerror="handleImgError(this)">
        </a>
        <div class="cart-row-info">
          <a href="product.html?id=${p.id}" class="cart-row-title">${title}</a>
          <span class="cart-row-price">$${p.price.toFixed(2)} / шт.</span>
        </div>
        <div class="cart-row-controls">
          <div class="qty-stepper" aria-label="Количество">
            <button type="button" class="qty-btn" data-action="dec" aria-label="Уменьшить">−</button>
            <span class="qty-value">${item.quantity}</span>
            <button type="button" class="qty-btn" data-action="inc" aria-label="Увеличить">+</button>
          </div>
          <span class="cart-row-total">$${item.getTotalPrice().toFixed(2)}</span>
          <button type="button" class="cart-row-remove" data-action="remove" aria-label="Удалить товар">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  function renderCart(animate = true) {
    if (!isLoggedIn()) {
      authGate.hidden = false;
      layout.hidden = true;
      emptyBlock.hidden = true;
      return;
    }
    authGate.hidden = true;

    const isEmpty = cart.items.length === 0;
    layout.hidden = isEmpty;
    emptyBlock.hidden = !isEmpty;

    itemsBox.innerHTML = cart.items
      .map((item, i) => renderRow(item, i, animate))
      .join('');

    calculateTotal();
    updateCartIcon();
  }

  // ---------- Действия со строками ----------

  function updateQuantity(id, delta) {
    cart.updateQuantity(id, delta);
    const item = cart.items.find((i) => i.product.id === id);
    if (!item) {
      removeRowAnimated(id, false);
      return;
    }
    const row = itemsBox.querySelector(`.cart-row[data-id="${id}"]`);
    if (row) {
      row.querySelector('.qty-value').textContent = item.quantity;
      row.querySelector('.cart-row-total').textContent = `$${item.getTotalPrice().toFixed(2)}`;
    }
    calculateTotal();
    updateCartIcon(true);
  }

  // Анимация удаления: slideOut + fade + плавный collapse высоты
  function removeRowAnimated(id, alsoRemoveFromCart = true) {
    const row = itemsBox.querySelector(`.cart-row[data-id="${id}"]`);
    if (!row) {
      renderCart(false);
      return;
    }
    row.style.maxHeight = `${row.scrollHeight}px`;
    void row.offsetHeight; // фиксируем стартовую высоту перед transition
    row.classList.add('removing');
    setTimeout(() => {
      if (alsoRemoveFromCart) cart.removeProduct(id);
      renderCart(false);
      showToast('Товар удалён из корзины', 'info');
    }, 380);
  }

  itemsBox.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const row = actionBtn.closest('.cart-row');
    const id = Number(row.dataset.id);
    const action = actionBtn.dataset.action;

    if (action === 'inc') updateQuantity(id, 1);
    else if (action === 'dec') updateQuantity(id, -1);
    else if (action === 'remove') removeRowAnimated(id);
  });

  // ---------- Очистка корзины (двухшаговое подтверждение) ----------

  clearBtn.addEventListener('click', () => {
    if (cart.items.length === 0) return;
    if (!clearArmed) {
      clearArmed = true;
      clearBtn.textContent = 'Нажмите ещё раз для очистки';
      clearArmTimer = setTimeout(() => {
        clearArmed = false;
        clearBtn.textContent = 'Очистить корзину';
      }, 3000);
      return;
    }
    clearTimeout(clearArmTimer);
    clearArmed = false;
    clearBtn.textContent = 'Очистить корзину';
    cart.clear();
    renderCart(false);
    updateCartIcon();
    showToast('Корзина очищена', 'info');
  });

  // ---------- Оформление заказа ----------

  function showStep(step) {
    [stepOrder, stepCard, stepPaying, stepSuccess].forEach((s) => {
      s.hidden = s !== step;
    });
  }

  // Список привязанных карт (радио-выбор)
  function renderCardList() {
    const cards = loadCards();

    if (cards.length === 0) {
      cardList.innerHTML = `<p class="card-list-empty">Нет привязанных карт. Привяжите карту, чтобы оплатить заказ.</p>`;
      selectedCardId = null;
    } else {
      if (!cards.some((c) => c.id === selectedCardId)) {
        selectedCardId = cards[0].id;
      }
      cardList.innerHTML = cards
        .map(
          (card) => `
          <label class="card-option">
            <input type="radio" name="payCard" value="${card.id}" ${card.id === selectedCardId ? 'checked' : ''}>
            <span class="card-brand">${escapeHtml(card.brand)}</span>
            <span class="card-num">•••• ${card.last4}</span>
            <span class="card-exp">${escapeHtml(card.exp)}</span>
          </label>`
        )
        .join('');
    }

    payBtn.disabled = !selectedCardId;
    payBtn.textContent = `Оплатить $${cart.getTotal().toFixed(2)}`;
  }

  cardList.addEventListener('change', (e) => {
    if (e.target.name === 'payCard') {
      selectedCardId = e.target.value;
      payBtn.disabled = false;
    }
  });

  function openModal() {
    const lines = cart.items
      .map(
        (item) => `
        <div class="modal-line">
          <span>${escapeHtml(item.product.title)} × ${item.quantity}</span>
          <span>$${item.getTotalPrice().toFixed(2)}</span>
        </div>`
      )
      .join('');
    modalBody.innerHTML = `
      ${lines}
      <div class="modal-line modal-total">
        <span>Итого:</span>
        <span>$${cart.getTotal().toFixed(2)}</span>
      </div>
    `;
    renderCardList();
    orderPlaced = false;
    showStep(stepOrder);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (orderPlaced) renderCart(false);
  }

  checkoutBtn.addEventListener('click', () => {
    if (!requireAuth('Войдите, чтобы оформить заказ')) return;
    if (cart.items.length === 0) {
      showToast('Корзина пуста', 'error');
      return;
    }
    openModal();
  });

  // Шаг привязки карты
  addCardBtn.addEventListener('click', () => {
    cardForm.reset();
    ['cardNumber', 'cardHolder', 'cardExp', 'cardCvc'].forEach((id) => {
      document.getElementById(id).classList.remove('invalid');
      document.getElementById(`${id}Error`).textContent = '';
    });
    showStep(stepCard);
  });

  cardBackBtn.addEventListener('click', () => {
    renderCardList();
    showStep(stepOrder);
  });

  attachCardInputMasks(cardNumber, cardExp, cardCvc);

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
    selectedCardId = card.id;

    showToast(`Карта •••• ${card.last4} привязана`, 'success');
    renderCardList();
    showStep(stepOrder);
  });

  // Оплата (имитация обработки платежа)
  payBtn.addEventListener('click', () => {
    if (!selectedCardId) {
      showToast('Привяжите карту для оплаты', 'error');
      return;
    }
    const card = loadCards().find((c) => c.id === selectedCardId);
    if (!card) return;

    showStep(stepPaying);

    setTimeout(() => {
      const order = createOrder(cart, card);
      cart.clear();
      orderPlaced = true;
      updateCartIcon();
      successOrderInfo.textContent =
        `Заказ ${order.id} на сумму $${order.total.toFixed(2)} оплачен картой •••• ${card.last4}`;
      showStep(stepSuccess);
    }, 2200);
  });

  modalCancel.addEventListener('click', closeModal);
  modalClose.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    // не даём закрыть модал кликом по фону во время «оплаты»
    if (e.target === modal && stepPaying.hidden) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden && stepPaying.hidden) closeModal();
  });

  // ---------- Инициализация ----------

  document.addEventListener('DOMContentLoaded', () => {
    renderCart(true);
  });
})();
