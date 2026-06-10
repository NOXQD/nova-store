// === COMMON.JS ===
// Общие функции: шапка (топ-бар, поиск, иконки), badge корзины, toast, ripple,
// reveal-анимации, авторизация-гейт, банковские карты, заказы,
// кабинет продавца (ИП/ИИН), утилиты.

// ---------- Утилиты ----------

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function debounce(fn, ms = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Русские названия категорий обоих API
const CATEGORY_LABELS = {
  electronics: 'Электроника',
  jewelery: 'Украшения',
  "men's clothing": 'Мужская одежда',
  "women's clothing": 'Женская одежда',
  smartphones: 'Смартфоны',
  laptops: 'Ноутбуки',
  tablets: 'Планшеты',
  fragrances: 'Парфюмерия',
  skincare: 'Уход за кожей',
  'skin-care': 'Уход за кожей',
  beauty: 'Красота',
  groceries: 'Продукты',
  'home-decoration': 'Декор для дома',
  furniture: 'Мебель',
  lighting: 'Освещение',
  tops: 'Топы',
  'womens-dresses': 'Платья',
  'womens-shoes': 'Женская обувь',
  'womens-bags': 'Сумки',
  'womens-jewellery': 'Бижутерия',
  'womens-watches': 'Женские часы',
  'mens-shirts': 'Мужские рубашки',
  'mens-shoes': 'Мужская обувь',
  'mens-watches': 'Мужские часы',
  sunglasses: 'Очки',
  automotive: 'Авто',
  vehicle: 'Транспорт',
  motorcycle: 'Мото',
  'kitchen-accessories': 'Для кухни',
  'mobile-accessories': 'Аксессуары',
  'sports-accessories': 'Спорт',
};

function getCategoryLabel(category) {
  if (CATEGORY_LABELS[category]) return CATEGORY_LABELS[category];
  const readable = String(category).replace(/-/g, ' ');
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

// Глобальный onerror-обработчик для всех img
function handleImgError(img) {
  img.onerror = null;
  img.removeAttribute('src');
  img.style.display = 'none';
  if (img.parentElement) {
    img.parentElement.classList.add('img-fallback');
  }
}

// Кнопка «В корзину» или степпер количества — для карточек каталога
function buyControlsHtml(productId, qty = 0) {
  if (qty <= 0) {
    return `<button type="button" class="btn btn-primary btn-add" data-id="${productId}">В корзину</button>`;
  }
  return `
    <div class="qty-stepper qty-stepper-sm" aria-label="Количество в корзине">
      <button type="button" class="qty-btn" data-action="card-dec" data-id="${productId}" aria-label="Уменьшить">−</button>
      <span class="qty-value">${qty}</span>
      <button type="button" class="qty-btn" data-action="card-inc" data-id="${productId}" aria-label="Увеличить">+</button>
    </div>`;
}

// ---------- Текущий пользователь ----------

function getStoredUser() {
  try {
    const raw = localStorage.getItem('novastore_current_user');
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.email ? data : null;
  } catch {
    return null;
  }
}

function isLoggedIn() {
  return Boolean(getStoredUser());
}

// Гейт: без входа покупки недоступны
function requireAuth(message = 'Войдите, чтобы продолжить') {
  if (isLoggedIn()) return true;
  showToast(message, 'error');
  setTimeout(() => {
    window.location.href = 'auth.html';
  }, 1200);
  return false;
}

function userStorageKey(prefix) {
  const user = getStoredUser();
  return user ? `${prefix}_${user.email.toLowerCase()}` : null;
}

// ---------- Банковские карты пользователя ----------
// Учебная имитация: полный номер и CVC НЕ сохраняются.

function loadCards() {
  const key = userStorageKey('novastore_cards');
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function saveCards(cards) {
  const key = userStorageKey('novastore_cards');
  if (key) localStorage.setItem(key, JSON.stringify(cards));
}

function luhnCheck(digits) {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (alternate) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function detectCardBrand(digits) {
  if (/^220[0-4]/.test(digits)) return 'МИР';
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  return 'Карта';
}

function validateCardForm({ number, holder, exp, cvc }) {
  const errors = {};
  const digits = number.replace(/\D/g, '');

  if (digits.length !== 16) {
    errors.number = 'Номер карты — 16 цифр';
  } else if (!luhnCheck(digits)) {
    errors.number = 'Неверный номер карты';
  }

  if (holder.trim().length < 3) {
    errors.holder = 'Укажите имя, как на карте';
  }

  const expMatch = exp.match(/^(\d{2})\/(\d{2})$/);
  if (!expMatch) {
    errors.exp = 'Формат: ММ/ГГ';
  } else {
    const month = Number(expMatch[1]);
    const year = 2000 + Number(expMatch[2]);
    const now = new Date();
    if (month < 1 || month > 12) {
      errors.exp = 'Неверный месяц';
    } else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
      errors.exp = 'Срок действия карты истёк';
    }
  }

  if (!/^\d{3,4}$/.test(cvc)) {
    errors.cvc = 'CVC — 3 цифры';
  }

  if (Object.keys(errors).length > 0) return { errors, card: null };

  return {
    errors,
    card: {
      id: `card_${Date.now()}`,
      brand: detectCardBrand(digits),
      last4: digits.slice(-4),
      holder: holder.trim().toUpperCase(),
      exp,
    },
  };
}

function attachCardInputMasks(numberInput, expInput, cvcInput) {
  numberInput.addEventListener('input', () => {
    const digits = numberInput.value.replace(/\D/g, '').slice(0, 16);
    numberInput.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  });
  expInput.addEventListener('input', () => {
    let digits = expInput.value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) digits = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    expInput.value = digits;
  });
  cvcInput.addEventListener('input', () => {
    cvcInput.value = cvcInput.value.replace(/\D/g, '').slice(0, 4);
  });
}

// ---------- Заказы пользователя ----------

function loadOrders() {
  const key = userStorageKey('novastore_orders');
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  const key = userStorageKey('novastore_orders');
  if (key) localStorage.setItem(key, JSON.stringify(orders));
}

function createOrder(cart, card) {
  const order = {
    id: `NS-${Date.now().toString().slice(-8)}`,
    date: new Date().toISOString(),
    items: cart.items.map((item) => ({
      id: item.product.id,
      title: item.product.title,
      price: item.product.price,
      image: item.product.image,
      quantity: item.quantity,
    })),
    total: cart.getTotal(),
    cardLast4: card.last4,
    cardBrand: card.brand,
    status: 'Оплачен',
  };
  const orders = loadOrders();
  orders.unshift(order);
  saveOrders(orders);
  return order;
}

// ---------- Кабинет продавца ----------
// Профиль продавца привязан к покупателю (email), товары продавцов — общие
// для всего «маркетплейса» (один ключ LocalStorage).

function getSellerProfile() {
  const key = userStorageKey('novastore_seller');
  if (!key) return null;
  try {
    return JSON.parse(localStorage.getItem(key)) || null;
  } catch {
    return null;
  }
}

function saveSellerProfile(profile) {
  const key = userStorageKey('novastore_seller');
  if (key) localStorage.setItem(key, JSON.stringify(profile));
}

function loadSellerProducts() {
  try {
    return JSON.parse(localStorage.getItem('novastore_seller_products')) || [];
  } catch {
    return [];
  }
}

function saveSellerProducts(products) {
  localStorage.setItem('novastore_seller_products', JSON.stringify(products));
}

// Проверка ИИН/БИН (Казахстан): 12 цифр + контрольный разряд.
// Алгоритм: свёртка по весам 1..11 (mod 11); если результат 10 —
// повторная свёртка по весам 3,4,…,11,1,2.
function validateIdNumber(value) {
  if (!/^\d{12}$/.test(value)) return false;
  const d = value.split('').map(Number);
  const w1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const w2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];

  let control = d.slice(0, 11).reduce((sum, digit, i) => sum + digit * w1[i], 0) % 11;
  if (control === 10) {
    control = d.slice(0, 11).reduce((sum, digit, i) => sum + digit * w2[i], 0) % 11;
    if (control === 10) return false;
  }
  return control === d[11];
}

// ---------- Количество товаров в корзине ----------

function getCartCount() {
  try {
    const data = JSON.parse(localStorage.getItem('novastore_cart')) || [];
    return data.reduce((sum, item) => sum + (item.quantity || 0), 0);
  } catch {
    return 0;
  }
}

function updateCartIcon(animate = false) {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const count = getCartCount();
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
  if (animate && count > 0) {
    badge.classList.remove('bounce');
    void badge.offsetWidth;
    badge.classList.add('bounce');
  }
}

// ---------- Шапка (стиль маркетплейса: топ-бар, поиск, иконки) ----------

function renderHeader() {
  const root = document.getElementById('app-header');
  if (!root) return;

  const page = window.location.pathname.split('/').pop() || 'index.html';
  const user = getStoredUser();

  const profileIcon = user
    ? `<a href="profile.html" class="header-icon-link" aria-label="Профиль">
         <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
           <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
           <circle cx="12" cy="7" r="4"></circle>
         </svg>
         <span class="header-icon-label">${escapeHtml(user.name.split(' ')[0])}</span>
       </a>`
    : `<a href="auth.html" class="header-icon-link" aria-label="Войти">
         <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
           <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
           <circle cx="12" cy="7" r="4"></circle>
         </svg>
         <span class="header-icon-label">Войти</span>
       </a>`;

  const navAuthPart = user
    ? `<a href="profile.html" class="${page === 'profile.html' ? 'active' : ''}">Профиль</a>
       <a href="seller.html" class="${page === 'seller.html' ? 'active' : ''}">Продавать</a>
       <button type="button" class="btn-logout" id="logoutBtn">Выйти</button>`
    : `<a href="seller.html" class="${page === 'seller.html' ? 'active' : ''}">Продавать</a>
       <a href="auth.html" class="${page === 'auth.html' ? 'active' : ''}">Войти</a>`;

  root.innerHTML = `
    <header class="site-header" id="siteHeader">
      <div class="header-top">
        <div class="container header-top-inner">
          <span class="header-city">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            Астана
          </span>
          <nav class="header-top-links">
            <a href="index.html#deals">Акции</a>
            <a href="seller.html">Продавать на NOVA</a>
            <a href="profile.html">Мои заказы</a>
          </nav>
        </div>
      </div>

      <div class="container header-inner">
        <a href="index.html" class="logo">NOVA<span>STORE</span></a>

        <form class="header-search" id="headerSearchForm" role="search">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="search" id="headerSearchInput" class="header-search-input"
                 placeholder="Найти на NOVA STORE" autocomplete="off" aria-label="Поиск товаров">
        </form>

        <nav class="nav" id="mainNav">
          <a href="index.html" class="${page === 'index.html' || page === '' ? 'active' : ''}">Каталог</a>
          <a href="cart.html" class="${page === 'cart.html' ? 'active' : ''}">Корзина</a>
          ${navAuthPart}
        </nav>

        <div class="header-actions">
          ${profileIcon}
          <a href="cart.html" class="cart-icon-link header-icon-link" aria-label="Корзина">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <span class="header-icon-label">Корзина</span>
            <span class="cart-badge hidden" id="cartBadge">0</span>
          </a>
          <button type="button" class="hamburger" id="hamburgerBtn" aria-label="Меню" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>
  `;

  const header = document.getElementById('siteHeader');

  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const hamburger = document.getElementById('hamburgerBtn');
  hamburger.addEventListener('click', () => {
    const open = header.classList.toggle('nav-open');
    hamburger.setAttribute('aria-expanded', String(open));
  });
  document.getElementById('mainNav').addEventListener('click', (e) => {
    if (e.target.closest('a')) header.classList.remove('nav-open');
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('novastore_current_user');
      showToast('Вы вышли из аккаунта', 'info');
      const protectedPages = ['profile.html', 'seller.html'];
      if (protectedPages.includes(page)) {
        setTimeout(() => { window.location.href = 'index.html'; }, 600);
      } else {
        renderHeader();
        updateCartIcon();
      }
    });
  }

  // Поиск из шапки: на главной фильтрует каталог напрямую
  // (catalog.js выставляет window.__onCatalogSearch), с других страниц — редирект
  const searchForm = document.getElementById('headerSearchForm');
  const searchInput = document.getElementById('headerSearchInput');

  const urlSearch = new URLSearchParams(window.location.search).get('search');
  if (urlSearch) searchInput.value = urlSearch;

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (typeof window.__onCatalogSearch === 'function') {
      window.__onCatalogSearch(query);
    } else {
      window.location.href = `index.html?search=${encodeURIComponent(query)}`;
    }
  });

  searchInput.addEventListener(
    'input',
    debounce(() => {
      if (typeof window.__onCatalogSearch === 'function') {
        window.__onCatalogSearch(searchInput.value.trim());
      }
    }, 300)
  );

  updateCartIcon();
}

// ---------- Toast-уведомления ----------

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3000);
}

// ---------- Ripple-эффект ----------

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn, .filter-pill, .auth-tab');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const circle = document.createElement('span');
  circle.className = 'ripple';
  circle.style.width = circle.style.height = `${size}px`;
  circle.style.left = `${e.clientX - rect.left - size / 2}px`;
  circle.style.top = `${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(circle);
  setTimeout(() => circle.remove(), 600);
});

// ---------- Reveal-анимация ----------

const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            entry.target.addEventListener(
              'animationend',
              () => entry.target.classList.add('done'),
              { once: true }
            );
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    )
  : null;

function observeReveal(container) {
  const elements = container.querySelectorAll('.reveal');
  elements.forEach((el, i) => {
    el.style.setProperty('--d', `${(i % 8) * 0.08}s`);
    if (revealObserver) {
      revealObserver.observe(el);
    } else {
      el.classList.add('visible', 'done');
    }
  });
}

// ---------- Инициализация ----------

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
});
