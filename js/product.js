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

  // ---------- Отзывы + ИИ-модерация ----------

  let selectedRate = 0;

  function combinedRating(product) {
    const reviews = loadReviews(product.id);
    const apiRate = product.rating ? Number(product.rating.rate) : 0;
    const apiCount = product.rating ? Number(product.rating.count) : 0;
    const userSum = reviews.reduce((sum, r) => sum + r.rate, 0);
    const totalCount = apiCount + reviews.length;
    if (totalCount === 0) return { rate: 0, count: 0 };
    return { rate: (apiRate * apiCount + userSum) / totalCount, count: totalCount };
  }

  function renderReviewsList(product) {
    const reviewsList = document.getElementById('reviewsList');
    const reviewsCount = document.getElementById('reviewsCount');
    const reviews = loadReviews(product.id);

    const combined = combinedRating(product);
    reviewsCount.textContent = `· ${starsHtml(combined.rate)} ${combined.rate.toFixed(1)} (${combined.count})`;

    if (reviews.length === 0) {
      reviewsList.innerHTML = `<p class="card-list-empty">Отзывов на сайте пока нет — будьте первым</p>`;
      return;
    }

    reviewsList.innerHTML = reviews
      .map(
        (r) => `
        <article class="review-item">
          <header class="review-item-head">
            <strong>${escapeHtml(r.name)}</strong>
            <span class="stars">${starsHtml(r.rate)}</span>
            <span class="review-date">${new Date(r.date).toLocaleDateString('ru-RU')}</span>
            <span class="ai-badge ai-badge-sm" title="Отзыв прошёл автоматическую проверку">🛡 проверен</span>
          </header>
          <p>${escapeHtml(r.text)}</p>
        </article>`
      )
      .join('');
  }

  function initReviews(product) {
    const section = document.getElementById('reviewsSection');
    const form = document.getElementById('reviewForm');
    const starsInput = document.getElementById('reviewStarsInput');
    const reviewText = document.getElementById('reviewText');
    const reviewError = document.getElementById('reviewError');

    section.hidden = false;
    renderReviewsList(product);

    starsInput.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-rate]');
      if (!btn) return;
      selectedRate = Number(btn.dataset.rate);
      starsInput.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('active', Number(b.dataset.rate) <= selectedRate);
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      reviewError.textContent = '';

      if (!requireAuth('Войдите, чтобы оставить отзыв')) return;
      if (selectedRate === 0) {
        reviewError.textContent = 'Поставьте оценку — от 1 до 5 звёзд';
        return;
      }

      const text = reviewText.value.trim();
      const verdict = aiModerateReview(text);
      if (!verdict.ok) {
        reviewError.textContent = `Отзыв отклонён ИИ-модерацией: ${verdict.reasons.join('; ')}`;
        form.classList.remove('shake');
        void form.offsetWidth;
        form.classList.add('shake');
        return;
      }

      const user = getStoredUser();
      saveReview(product.id, {
        name: user.name,
        rate: selectedRate,
        text,
        date: new Date().toISOString(),
      });

      form.reset();
      selectedRate = 0;
      starsInput.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      renderReviewsList(product);
      showToast('Отзыв прошёл ИИ-модерацию и опубликован', 'success');
    });
  }

  // ---------- Рекомендации ----------

  function recCardHtml(p) {
    return `
      <a href="product.html?id=${p.id}" class="rec-card">
        <span class="rec-photo">
          <img src="${p.image}" alt="${escapeHtml(p.title)}" loading="lazy" width="120" height="120" onerror="handleImgError(this)">
        </span>
        <span class="rec-title">${escapeHtml(p.title)}</span>
        <span class="rec-rating stars">${p.getStars()}</span>
        <span class="rec-price">${p.priceHtml()}</span>
      </a>`;
  }

  async function renderRecommendations(product) {
    try {
      const all = await API.getProducts();

      const similar = all
        .filter((p) => p.category === product.category && p.id !== product.id)
        .slice(0, 6);
      if (similar.length > 0) {
        document.getElementById('similarSection').hidden = false;
        document.getElementById('similarRow').innerHTML = similar.map(recCardHtml).join('');
      }

      const alsoBuy = all
        .filter(
          (p) =>
            p.category !== product.category &&
            p.id !== product.id &&
            p.price <= product.price * 1.5 &&
            p.rating && p.rating.rate >= 4
        )
        .sort((a, b) => b.rating.rate - a.rating.rate)
        .slice(0, 6);
      if (alsoBuy.length > 0) {
        document.getElementById('alsoBuySection').hidden = false;
        document.getElementById('alsoBuyRow').innerHTML = alsoBuy.map(recCardHtml).join('');
      }
    } catch {
      // рекомендации не критичны — страница работает и без них
    }
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
      initReviews(product);
      renderRecommendations(product);
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
