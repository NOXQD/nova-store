// === CART.JS ===
// Корзина: рендер из LocalStorage, изменение количества, удаление с анимацией,
// плавный пересчёт суммы, модальное окно оформления заказа.

(() => {
  const layout = document.getElementById('cartLayout');
  const itemsBox = document.getElementById('cartItems');
  const emptyBlock = document.getElementById('cartEmpty');
  const summaryCount = document.getElementById('summaryCount');
  const summaryTotal = document.getElementById('summaryTotal');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const clearBtn = document.getElementById('clearCartBtn');

  const modal = document.getElementById('checkoutModal');
  const modalBody = document.getElementById('modalBody');
  const modalConfirmStep = document.getElementById('modalConfirmStep');
  const modalSuccessStep = document.getElementById('modalSuccessStep');
  const modalCancel = document.getElementById('modalCancel');
  const modalConfirm = document.getElementById('modalConfirm');
  const modalClose = document.getElementById('modalClose');

  const cart = Cart.load();
  let displayedTotal = cart.getTotal();
  let clearArmed = false;
  let clearArmTimer = null;

  // ---------- Плавная анимация числа итога ----------

  function animateNumber(el, from, to, duration = 450) {
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

  // ---------- Рендер ----------

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
      // Количество дошло до нуля — товар удалён
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

  // ---------- Модальное окно оформления заказа ----------

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
    modalConfirmStep.hidden = false;
    modalSuccessStep.hidden = true;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  checkoutBtn.addEventListener('click', () => {
    if (cart.items.length === 0) {
      showToast('Корзина пуста', 'error');
      return;
    }
    openModal();
  });

  modalConfirm.addEventListener('click', () => {
    cart.clear();
    modalConfirmStep.hidden = true;
    modalSuccessStep.hidden = false;
    updateCartIcon();
  });

  modalCancel.addEventListener('click', closeModal);

  modalClose.addEventListener('click', () => {
    closeModal();
    renderCart(false);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
      // если заказ уже оформлен — обновить страницу корзины
      if (!modalSuccessStep.hidden) renderCart(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) {
      closeModal();
      if (!modalSuccessStep.hidden) renderCart(false);
    }
  });

  // ---------- Инициализация ----------

  document.addEventListener('DOMContentLoaded', () => {
    renderCart(true);
  });
})();
