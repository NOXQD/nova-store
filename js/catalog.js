// === CATALOG.JS ===
// Логика главной страницы: skeleton → загрузка API → фильтры, поиск, сортировка.

(() => {
  const grid = document.getElementById('productsGrid');
  const filtersBox = document.getElementById('categoryFilters');
  const filterIndicator = document.getElementById('filterIndicator');
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const emptyBlock = document.getElementById('catalogEmpty');
  const errorBlock = document.getElementById('catalogError');
  const retryBtn = document.getElementById('retryBtn');

  const cart = Cart.load();

  let allProducts = [];
  let currentCategory = 'all';
  let searchQuery = '';
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
          p.description.toLowerCase().includes(q)
      );
    }

    switch (sortMode) {
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
    grid.innerHTML = products.map((p, i) => p.renderCard(i)).join('');
    observeReveal(grid);
    bindAddButtons();
  }

  // Fade-переход при смене фильтра/поиска
  function renderWithFade() {
    grid.classList.add('fading');
    setTimeout(() => {
      renderCatalog();
      grid.classList.remove('fading');
    }, 250);
  }

  function bindAddButtons() {
    grid.querySelectorAll('.btn-add').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = Number(btn.dataset.id);
        const product = allProducts.find((p) => p.id === id);
        if (!product) return;
        cart.addProduct(product);
        updateCartIcon(true);
        btn.classList.remove('pulse-once');
        void btn.offsetWidth;
        btn.classList.add('pulse-once');
        showToast('Товар добавлен в корзину', 'success');
      });
    });
  }

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

  // ---------- Поиск (debounce 300ms) ----------

  function setupSearch() {
    searchInput.addEventListener(
      'input',
      debounce(() => {
        searchQuery = searchInput.value.trim();
        renderWithFade();
      }, 300)
    );
  }

  // ---------- Сортировка ----------

  function setupSort() {
    sortSelect.addEventListener('change', () => {
      sortMode = sortSelect.value;
      renderWithFade();
    });
  }

  // ---------- Инициализация ----------

  async function init() {
    errorBlock.hidden = true;
    emptyBlock.hidden = true;
    renderSkeletons(8);

    try {
      const [products, categories] = await Promise.all([
        API.getProducts(),
        API.getCategories(),
      ]);
      allProducts = products;
      if (!filtersBox.querySelector('[data-category]:not([data-category="all"])')) {
        setupCategoryFilter(categories);
      }
      renderCatalog();
    } catch {
      grid.innerHTML = '';
      errorBlock.hidden = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    setupSort();
    retryBtn.addEventListener('click', init);
    init();
  });
})();
