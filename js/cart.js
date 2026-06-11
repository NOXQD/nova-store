// === CART.JS ===
// Корзина: гейт авторизации, промокоды, многошаговый checkout:
// состав → адрес и доставка → карта → платёжный шлюз (мок) → успех.

(() => {
  const authGate = document.getElementById('cartAuthGate');
  const layout = document.getElementById('cartLayout');
  const itemsBox = document.getElementById('cartItems');
  const emptyBlock = document.getElementById('cartEmpty');
  const summaryCount = document.getElementById('summaryCount');
  const summarySubtotal = document.getElementById('summarySubtotal');
  const summaryTotal = document.getElementById('summaryTotal');
  const summaryDiscount = document.getElementById('summaryDiscount');
  const discountRow = document.getElementById('discountRow');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const clearBtn = document.getElementById('clearCartBtn');

  const couponInput = document.getElementById('couponInput');
  const couponApplyBtn = document.getElementById('couponApplyBtn');
  const couponInputRow = document.getElementById('couponInputRow');
  const couponApplied = document.getElementById('couponApplied');
  const couponAppliedText = document.getElementById('couponAppliedText');
  const couponRemoveBtn = document.getElementById('couponRemoveBtn');
  const couponError = document.getElementById('couponError');

  const modal = document.getElementById('checkoutModal');
  const checkoutSteps = document.getElementById('checkoutSteps');
  const modalBody = document.getElementById('modalBody');
  const stepOrder = document.getElementById('stepOrder');
  const stepAddress = document.getElementById('stepAddress');
  const stepPay = document.getElementById('stepPay');
  const stepCard = document.getElementById('stepCard');
  const stepPaying = document.getElementById('stepPaying');
  const stepSuccess = document.getElementById('stepSuccess');
  const payTotals = document.getElementById('payTotals');
  const cardList = document.getElementById('cardList');
  const addCardBtn = document.getElementById('addCardBtn');
  const payBtn = document.getElementById('payBtn');
  const payingStatus = document.getElementById('payingStatus');
  const modalCancel = document.getElementById('modalCancel');
  const modalClose = document.getElementById('modalClose');
  const successOrderInfo = document.getElementById('successOrderInfo');

  const toAddressBtn = document.getElementById('toAddressBtn');
  const addressForm = document.getElementById('addressForm');
  const addressBackBtn = document.getElementById('addressBackBtn');
  const deliveryMethod = document.getElementById('deliveryMethod');
  const addrCity = document.getElementById('addrCity');
  const addrStreet = document.getElementById('addrStreet');
  const payBackBtn = document.getElementById('payBackBtn');

  const cardForm = document.getElementById('cardForm');
  const cardNumber = document.getElementById('cardNumber');
  const cardHolder = document.getElementById('cardHolder');
  const cardExp = document.getElementById('cardExp');
  const cardCvc = document.getElementById('cardCvc');
  const cardBackBtn = document.getElementById('cardBackBtn');

  const cart = Cart.load();
  let displayedTotal = 0;
  let clearArmed = false;
  let clearArmTimer = null;
  let selectedCardId = null;
  let orderPlaced = false;

  let appliedCoupon = null; // { code, amount, label }
  let checkoutAddress = null;
  const DELIVERY_FEES = { pickup: 0, courier: 3 };

  // ---------- Суммы ----------

  function getDiscountAmount() {
    if (!appliedCoupon) return 0;
    const revalidated = validateCoupon(appliedCoupon.code, cart.getTotal());
    if (revalidated.error) {
      appliedCoupon = null;
      renderCouponBox();
      return 0;
    }
    appliedCoupon = revalidated;
    return revalidated.amount;
  }

  function getDeliveryFee() {
    return DELIVERY_FEES[deliveryMethod.value] || 0;
  }

  function getFinalTotal(withDelivery = false) {
    return Math.max(0, cart.getTotal() - getDiscountAmount() + (withDelivery ? getDeliveryFee() : 0));
  }

  function animateNumber(el, from, to, duration = 450) {
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
    const subtotal = cart.getTotal();
    const discount = getDiscountAmount();
    const total = Math.max(0, subtotal - discount);

    summaryCount.textContent = cart.getCount();
    summarySubtotal.textContent = `$${subtotal.toFixed(2)}`;
    discountRow.hidden = discount === 0;
    summaryDiscount.textContent = `−$${discount.toFixed(2)}`;
    animateNumber(summaryTotal, displayedTotal, total);
    displayedTotal = total;
  }

  // ---------- Промокоды ----------

  function renderCouponBox() {
    const active = Boolean(appliedCoupon);
    couponInputRow.hidden = active;
    couponApplied.hidden = !active;
    if (active) {
      couponAppliedText.textContent = `${appliedCoupon.code} · ${appliedCoupon.label}`;
    }
  }

  couponApplyBtn.addEventListener('click', () => {
    couponError.textContent = '';
    const result = validateCoupon(couponInput.value, cart.getTotal());
    if (result.error) {
      couponError.textContent = result.error;
      return;
    }
    appliedCoupon = result;
    couponInput.value = '';
    renderCouponBox();
    calculateTotal();
    showToast(`Промокод ${result.code} применён`, 'success');
  });

  couponInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      couponApplyBtn.click();
    }
  });

  couponRemoveBtn.addEventListener('click', () => {
    appliedCoupon = null;
    couponError.textContent = '';
    renderCouponBox();
    calculateTotal();
  });

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

    renderCouponBox();
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

  function removeRowAnimated(id, alsoRemoveFromCart = true) {
    const row = itemsBox.querySelector(`.cart-row[data-id="${id}"]`);
    if (!row) {
      renderCart(false);
      return;
    }
    row.style.maxHeight = `${row.scrollHeight}px`;
    void row.offsetHeight;
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

  // ---------- Очистка корзины ----------

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
    appliedCoupon = null;
    renderCart(false);
    updateCartIcon();
    showToast('Корзина очищена', 'info');
  });

  // ---------- Checkout: шаги ----------

  const STEP_NUMBERS = new Map([[stepOrder, 1], [stepAddress, 2], [stepPay, 3], [stepCard, 3]]);

  function showStep(step) {
    [stepOrder, stepAddress, stepPay, stepCard, stepPaying, stepSuccess].forEach((s) => {
      s.hidden = s !== step;
    });
    const num = STEP_NUMBERS.get(step) || 0;
    checkoutSteps.hidden = num === 0;
    checkoutSteps.querySelectorAll('.checkout-step-dot').forEach((dot) => {
      dot.classList.toggle('active', Number(dot.dataset.step) <= num);
    });
  }

  function renderOrderStep() {
    const discount = getDiscountAmount();
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
      ${discount > 0 ? `
        <div class="modal-line">
          <span>Промокод ${appliedCoupon.code}</span>
          <span>−$${discount.toFixed(2)}</span>
        </div>` : ''}
      <div class="modal-line modal-total">
        <span>Итого:</span>
        <span>$${getFinalTotal(false).toFixed(2)}</span>
      </div>
    `;
  }

  function renderPayStep() {
    const discount = getDiscountAmount();
    const fee = getDeliveryFee();
    payTotals.innerHTML = `
      <div class="modal-line"><span>Товары (${cart.getCount()} шт.)</span><span>$${cart.getTotal().toFixed(2)}</span></div>
      ${discount > 0 ? `<div class="modal-line"><span>Скидка ${appliedCoupon.code}</span><span>−$${discount.toFixed(2)}</span></div>` : ''}
      <div class="modal-line"><span>Доставка (${deliveryMethod.value === 'courier' ? 'курьер' : 'пункт выдачи'})</span><span>${fee > 0 ? `$${fee.toFixed(2)}` : 'бесплатно'}</span></div>
      <div class="modal-line modal-total"><span>К оплате:</span><span>$${getFinalTotal(true).toFixed(2)}</span></div>
    `;
    renderCardList();
  }

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
    payBtn.textContent = `Оплатить $${getFinalTotal(true).toFixed(2)}`;
  }

  cardList.addEventListener('change', (e) => {
    if (e.target.name === 'payCard') {
      selectedCardId = e.target.value;
      payBtn.disabled = false;
    }
  });

  function openModal() {
    orderPlaced = false;
    renderOrderStep();
    showStep(stepOrder);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (orderPlaced) {
      appliedCoupon = null;
      renderCart(false);
    }
  }

  checkoutBtn.addEventListener('click', () => {
    if (!requireAuth('Войдите, чтобы оформить заказ')) return;
    if (cart.items.length === 0) {
      showToast('Корзина пуста', 'error');
      return;
    }
    openModal();
  });

  // Шаг 1 → 2
  toAddressBtn.addEventListener('click', () => showStep(stepAddress));
  addressBackBtn.addEventListener('click', () => {
    renderOrderStep();
    showStep(stepOrder);
  });

  // Шаг 2 → 3
  addressForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;

    if (addrCity.value.trim().length < 2) {
      document.getElementById('addrCityError').textContent = 'Укажите город';
      addrCity.classList.add('invalid');
      valid = false;
    } else {
      document.getElementById('addrCityError').textContent = '';
      addrCity.classList.remove('invalid');
    }

    if (addrStreet.value.trim().length < 5) {
      document.getElementById('addrStreetError').textContent = 'Укажите адрес доставки или пункт выдачи';
      addrStreet.classList.add('invalid');
      valid = false;
    } else {
      document.getElementById('addrStreetError').textContent = '';
      addrStreet.classList.remove('invalid');
    }

    if (!valid) {
      addressForm.classList.remove('shake');
      void addressForm.offsetWidth;
      addressForm.classList.add('shake');
      return;
    }

    checkoutAddress = {
      city: addrCity.value.trim(),
      street: addrStreet.value.trim(),
      method: deliveryMethod.value,
    };
    renderPayStep();
    showStep(stepPay);
  });

  payBackBtn.addEventListener('click', () => showStep(stepAddress));

  // Привязка карты
  addCardBtn.addEventListener('click', () => {
    cardForm.reset();
    ['cardNumber', 'cardHolder', 'cardExp', 'cardCvc'].forEach((id) => {
      document.getElementById(id).classList.remove('invalid');
      document.getElementById(`${id}Error`).textContent = '';
    });
    showStep(stepCard);
  });

  cardBackBtn.addEventListener('click', () => {
    renderPayStep();
    showStep(stepPay);
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
    renderPayStep();
    showStep(stepPay);
  });

  // ---------- Оплата через мок платёжного шлюза ----------

  payBtn.addEventListener('click', async () => {
    if (!selectedCardId) {
      showToast('Привяжите карту для оплаты', 'error');
      return;
    }
    const card = loadCards().find((c) => c.id === selectedCardId);
    if (!card || !checkoutAddress) return;

    const finalTotal = getFinalTotal(true);
    showStep(stepPaying);

    payingStatus.textContent = 'Создаём платёж…';
    const intent = await PaymentGateway.createIntent(finalTotal);

    payingStatus.textContent = `Подтверждаем оплату картой •••• ${card.last4}…`;
    const result = await PaymentGateway.confirm(intent, card);

    if (result.status !== 'succeeded') {
      showToast(result.error || 'Платёж отклонён', 'error');
      renderPayStep();
      showStep(stepPay);
      return;
    }

    const order = createOrder(cart, card, {
      coupon: appliedCoupon ? appliedCoupon.code : null,
      discountAmount: getDiscountAmount(),
      deliveryFee: getDeliveryFee(),
      deliveryMethod: checkoutAddress.method === 'courier' ? 'Курьер' : 'Пункт выдачи',
      address: `${checkoutAddress.city}, ${checkoutAddress.street}`,
      finalTotal,
      receiptId: result.receiptId,
    });
    cart.clear();
    orderPlaced = true;
    updateCartIcon();

    successOrderInfo.textContent =
      `Заказ ${order.id} на сумму $${order.total.toFixed(2)} оплачен картой •••• ${card.last4}. ` +
      `Доставка: ${order.deliveryMethod.toLowerCase()}, ${order.address}`;
    showStep(stepSuccess);

    // Чек о покупке на почту покупателя
    const user = getStoredUser();
    EmailService.sendReceipt(order, user).then((sent) => {
      if (sent) {
        successOrderInfo.textContent += `. Чек отправлен на ${user.email}`;
        showToast(`Чек о покупке отправлен на ${user.email}`, 'success');
      } else {
        showToast('Чек на почту отправить не удалось — заказ сохранён в профиле', 'info');
      }
    });
  });

  modalCancel.addEventListener('click', closeModal);
  modalClose.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal && stepPaying.hidden) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden && stepPaying.hidden) closeModal();
  });

  // ---------- Инициализация ----------

  document.addEventListener('DOMContentLoaded', () => {
    displayedTotal = cart.getTotal();
    renderCart(true);
  });
})();
