// === PRODUCT.JS ===
// Страница товара: id из URL → загрузка из API → рендер, счётчик, добавление в корзину.

(() => {
  const skeleton = document.getElementById('productSkeleton');
  const content = document.getElementById('productContent');
  const errorBlock = document.getElementById('productError');
  const errorTitle = document.getElementById('productErrorTitle');
  const errorText = document.getElementById('productErrorText');
  const breadcrumbCurrent = document.querySelector('.breadcrumb-current');

  const cart = Cart.load();
  let quantity = 1;

  function showError(title, text) {
    skeleton.hidden = true;
    content.hidden = true;
    errorTitle.textContent = title;
    errorText.textContent = text;
    errorBlock.hidden = false;
    breadcrumbCurrent.textContent = 'Ошибка';
  }

  function renderProduct(product) {
    const title = escapeHtml(product.title);
    const rate = product.rating ? product.rating.rate.toFixed(1) : '—';
    const count = product.rating ? product.rating.count : 0;

    breadcrumbCurrent.textContent = product.title;
    document.title = `${product.title} — NOVA STORE`;

    const priceBlock = product.oldPrice && product.oldPrice > product.price
      ? `<p class="product-price">$${product.price.toFixed(2)}
           <s class="price-old">$${product.oldPrice.toFixed(2)}</s>
           <span class="discount-badge discount-inline">−${product.discount}%</span></p>`
      : `<p class="product-price">$${product.price.toFixed(2)}</p>`;

    const shopLine = product.shopName
      ? `<p class="card-shop">Продавец: ${escapeHtml(product.shopName)}</p>`
      : '';

    content.innerHTML = `
      <div class="product-photo" id="productPhoto">
        <img
          src="${product.image}"
          alt="${title}"
          loading="eager"
          width="500"
          height="500"
          onerror="handleImgError(this)">
      </div>

      <div class="product-info">
        <span class="category-tag">${escapeHtml(getCategoryLabel(product.category))}</span>
        <h1 class="product-title">${title}</h1>
        <div class="product-rating">
          <span class="stars" aria-hidden="true">${product.getStars()}</span>
          <span class="rating-value">${rate}</span>
          <span class="rating-count">(${count} оценок)</span>
        </div>
        ${priceBlock}
        ${shopLine}
        <p class="product-description">${escapeHtml(product.description)}</p>

        <div class="product-actions">
          <div class="qty-stepper" aria-label="Количество">
            <button type="button" class="qty-btn" id="qtyMinus" aria-label="Уменьшить">−</button>
            <span class="qty-value" id="qtyValue">1</span>
            <button type="button" class="qty-btn" id="qtyPlus" aria-label="Увеличить">+</button>
          </div>
          <button type="button" class="btn btn-primary" id="addToCartBtn">Добавить в корзину</button>
        </div>

        <div class="product-links">
          <a href="index.html" class="btn btn-ghost">← В каталог</a>
          <a href="cart.html" class="btn btn-ghost">Перейти в корзину →</a>
        </div>
      </div>
    `;

    skeleton.hidden = true;
    content.hidden = false;

    // Счётчик количества
    const qtyValue = document.getElementById('qtyValue');
    document.getElementById('qtyMinus').addEventListener('click', () => {
      quantity = Math.max(1, quantity - 1);
      qtyValue.textContent = quantity;
    });
    document.getElementById('qtyPlus').addEventListener('click', () => {
      quantity = Math.min(99, quantity + 1);
      qtyValue.textContent = quantity;
    });

    // Добавление в корзину: pulse + toast + bounce badge.
    // product.image сохраняется в LocalStorage внутри CartItem (см. Cart.toJSON).
    const addBtn = document.getElementById('addToCartBtn');
    addBtn.addEventListener('click', () => {
      if (!requireAuth('Войдите, чтобы добавлять товары в корзину')) return;
      cart.addProduct(product, quantity);
      updateCartIcon(true);
      addBtn.classList.remove('pulse-once');
      void addBtn.offsetWidth;
      addBtn.classList.add('pulse-once');
      showToast(
        quantity === 1
          ? 'Товар добавлен в корзину'
          : `Добавлено в корзину: ${quantity} шт.`,
        'success'
      );
      quantity = 1;
      qtyValue.textContent = '1';
    });
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const id = Number.parseInt(params.get('id'), 10);

    if (!id || Number.isNaN(id) || id < 1) {
      showError('Неверная ссылка', 'В адресе страницы не указан корректный ID товара');
      return;
    }

    try {
      const product = await API.getProductById(id);
      renderProduct(product);
    } catch (err) {
      // Fake Store API на несуществующий id возвращает пустой ответ
      if (String(err.message).includes('пустой')) {
        showError('Товар не найден', 'Возможно, ссылка устарела или товар был удалён');
      } else {
        showError('Не удалось загрузить товар', 'Проверьте подключение к интернету и обновите страницу');
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
