// === CATALOG.JS ===
// Главная: карусель акций, каталог из двух API + товаров продавцов,
// фильтры, поиск из шапки, сортировка, степпер количества прямо в карточке.

(() => {
  const grid = document.getElementById('productsGrid');
  const filtersBox = document.getElementById('categoryFilters');
  const filterIndicator = document.getElementById('filterIndicator');
  const sortSelect = document.getElementById('sortSelect');
  const emptyBlock = document.getElementById('catalogEmpty');
  const errorBlock = document.getElementById('catalogError');
  const retryBtn = document.getElementById('retryBtn');

  const carousel = document.getElementById('heroCarousel');
  const carouselTrack = document.getElementById('carouselTrack');
  const carouselDots = document.getElementById('carouselDots');
  const carouselPrev = document.getElementById('carouselPrev');
  const carouselNext = document.getElementById('carouselNext');
  const carouselSkeleton = document.getElementById('carouselSkeleton');

  const cart = Cart.load();

  let allProducts = [];
  let currentCategory = 'all';
  let searchQuery = new URLSearchParams(window.location.search).get('search') || '';
  let sortMode = 'default';

  // ---------- Skeleton ----------

  function renderSkeletons(count = 8) {
    grid.innerHTML = Array.from({ length: count }, () => `
      <div class="skeleton-card">
        <div class="skeleton skeleton-image"></div>
        <div class="skeleton-body">
          <div class="skeleton skeleton-line w-30"></div>
          <div class="skeleton skeleton-line w-90"></div>
          <div class="skeleton skeleton-line w-60"></div>
          <div class="skeleton skeleton-btn"></div>
        </div>
      </div>
    `).join('');
  }

  // ---------- Карусель акций ----------

  let slideIndex = 0;
  let slideCount = 0;
  let autoplayTimer = null;

  function slideHtml(product) {
    const title = escapeHtml(product.title);
    return `
      <div class="carousel-slide">
        <div class="slide-info">
          <span class="slide-badge">Акция · −${product.discount}%</span>
          <h2 class="slide-title">${title}</h2>
          <div class="slide-prices">
            <span class="slide-price">$${product.price.toFixed(2)}</span>
            <s class="slide-old-price">$${product.oldPrice.toFixed(2)}</s>
          </div>
          <a href="product.html?id=${product.id}" class="btn btn-primary">Смотреть товар</a>
        </div>
        <a href="product.html?id=${product.id}" class="slide-photo" aria-label="${title}">
          <img src="${product.image}" alt="${title}" loading="eager" width="280" height="280" onerror="handleImgError(this)">
        </a>
      </div>
    `;
  }

  function goToSlide(i) {
    slideIndex = (i + slideCount) % slideCount;
    carouselTrack.style.transform = `translateX(-${slideIndex * 100}%)`;
    carouselDots.querySelectorAll('.carousel-dot').forEach((dot, n) => {
      dot.classList.toggle('active', n === slideIndex);
    });
  }

  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(() => goToSlide(slideIndex + 1), 4500);
  }

  function stopAutoplay() {
    if (autoplayTimer) clearInterval(autoplayTimer);
  }

  function renderHeroCarousel() {
    const deals = allProducts
      .filter((p) => p.discount >= 10 && p.oldPrice)
      .sort((a, b) => b.discount - a.discount)
      .slice(0, 6);

    carouselSkeleton.hidden = true;
    if (deals.length === 0) {
      carousel.hidden = true;
      return;
    }

    slideCount = deals.length;
    carouselTrack.innerHTML = deals.map(slideHtml).join('');
    carouselDots.innerHTML = deals
      .map((_, i) => `<button type="button" class="carousel-dot${i === 0 ? ' active' : ''}" data-slide="${i}" aria-label="Слайд ${i + 1}"></button>`)
      .join('');

    carousel.hidden = false;
    goToSlide(0);
    startAutoplay();

    carouselPrev.addEventListener('click', () => { goToSlide(slideIndex - 1); startAutoplay(); });
    carouselNext.addEventListener('click', () => { goToSlide(slideIndex + 1); startAutoplay(); });
    carouselDots.addEventListener('click', (e) => {
      const dot = e.target.closest('.carousel-dot');
      if (dot) { goToSlide(Number(dot.dataset.slide)); startAutoplay(); }
    });
    carousel.addEventListener('mouseenter', stopAutoplay);
    carousel.addEventListener('mouseleave', startAutoplay);
  }

  // ---------- Фильтрация / сортировка ----------

  function getVisibleProducts() {
    let list = [...allProducts];

    if (currentCategory !== 'all') {
      list = list.filter((p) => p.category === currentCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          getCategoryLabel(p.category).toLowerCase().includes(q)
      );
    }

    switch (sortMode) {
      case 'discount':
        list.sort((a, b) => b.discount - a.discount);
        break;
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'name-asc':
        list.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
        break;
      case 'name-desc':
        list.sort((a, b) => b.title.localeCompare(a.title, 'ru'));
        break;
    }

    return list;
  }

  // ---------- Рендер ----------

  function renderCatalog() {
    const products = getVisibleProducts();
    emptyBlock.hidden = products.length > 0;
    grid.innerHTML = products
      .map((p, i) => p.renderCard(i, cart.getQuantity(p.id)))
      .join('');
    observeReveal(grid);
  }

  function renderWithFade() {
    grid.classList.add('fading');
    setTimeout(() => {
      renderCatalog();
      grid.classList.remove('fading');
    }, 250);
  }

  // ---------- Корзина из карточки: кнопка → степпер +/- ----------

  function refreshCardControls(productId) {
    const box = grid.querySelector(`.card-buy[data-id="${productId}"]`);
    if (box) box.innerHTML = buyControlsHtml(productId, cart.getQuantity(productId));
  }

  grid.addEventListener('click', (e) => {
    const addBtn = e.target.closest('.btn-add');
    const qtyBtn = e.target.closest('[data-action="card-inc"], [data-action="card-dec"]');
    if (!addBtn && !qtyBtn) return;
    e.preventDefault();

    if (!requireAuth('Войдите, чтобы добавлять товары в корзину')) return;

    const id = Number((addBtn || qtyBtn).dataset.id);
    const product = allProducts.find((p) => p.id === id);
    if (!product) return;

    if (addBtn) {
      cart.addProduct(product);
      showToast('Товар добавлен в корзину', 'success');
    } else if (qtyBtn.dataset.action === 'card-inc') {
      cart.updateQuantity(id, 1);
    } else {
      cart.updateQuantity(id, -1);
      if (cart.getQuantity(id) === 0) showToast('Товар удалён из корзины', 'info');
    }

    refreshCardControls(id);
    updateCartIcon(true);
  });

  // ---------- Фильтры категорий ----------

  function positionIndicator(activeBtn) {
    if (!activeBtn) return;
    filterIndicator.style.left = `${activeBtn.offsetLeft}px`;
    filterIndicator.style.width = `${activeBtn.offsetWidth}px`;
  }

  function setupCategoryFilter(categories) {
    const pills = categories
      .map(
        (cat) => `
        <button type="button" class="filter-pill" data-category="${escapeHtml(cat)}">
          ${escapeHtml(getCategoryLabel(cat))}
        </button>`
      )
      .join('');
    filtersBox.insertAdjacentHTML('beforeend', pills);

    filtersBox.addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill');
      if (!pill) return;
      filtersBox.querySelectorAll('.filter-pill').forEach((b) => b.classList.remove('active'));
      pill.classList.add('active');
      positionIndicator(pill);
      currentCategory = pill.dataset.category;
      renderWithFade();
    });

    positionIndicator(filtersBox.querySelector('.filter-pill.active'));
    window.addEventListener('resize', () =>
      positionIndicator(filtersBox.querySelector('.filter-pill.active'))
    );
  }

  // ---------- Поиск (вызывается из строки поиска в шапке) ----------

  window.__onCatalogSearch = (query) => {
    searchQuery = query;
    renderWithFade();
  };

  // ---------- Сортировка ----------

  sortSelect.addEventListener('change', () => {
    sortMode = sortSelect.value;
    renderWithFade();
  });

  // ---------- Инициализация ----------

  async function init() {
    errorBlock.hidden = true;
    emptyBlock.hidden = true;
    renderSkeletons(8);

    try {
      allProducts = await API.getProducts();

      if (!filtersBox.querySelector('[data-category]:not([data-category="all"])')) {
        const categories = [...new Set(allProducts.map((p) => p.category))];
        setupCategoryFilter(categories);
      }

      renderHeroCarousel();
      renderCatalog();
    } catch {
      grid.innerHTML = '';
      carouselSkeleton.hidden = true;
      errorBlock.hidden = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    retryBtn.addEventListener('click', init);
    init();
  });
})();
