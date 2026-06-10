// === COMMON.JS ===
// Общие функции: шапка, нижняя мобильная навигация, toast, ripple, reveal,
// безопасность данных (хэширование паролей, минимизация хранимого),
// избранное, сравнение, купоны, мок платёжного шлюза, карты, заказы, продавцы.

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

function handleImgError(img) {
  img.onerror = null;
  img.removeAttribute('src');
  img.style.display = 'none';
  if (img.parentElement) {
    img.parentElement.classList.add('img-fallback');
  }
}

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

// ---------- Безопасность: хэширование паролей (Web Crypto, SHA-256 + соль) ----------
// Пароли никогда не хранятся в открытом виде. В сессии (currentUser)
// хранятся только имя и email — никаких паролей, карт и документов.

function randomSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
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

// ---------- Избранное (Wishlist) ----------

function loadFavorites() {
  const key = userStorageKey('novastore_favorites');
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function saveFavorites(ids) {
  const key = userStorageKey('novastore_favorites');
  if (key) localStorage.setItem(key, JSON.stringify(ids));
}

function isFavorite(id) {
  return loadFavorites().includes(id);
}

function toggleFavorite(id) {
  let favorites = loadFavorites();
  const added = !favorites.includes(id);
  favorites = added ? [...favorites, id] : favorites.filter((f) => f !== id);
  saveFavorites(favorites);
  updateFavIcon();
  return added;
}

function updateFavIcon() {
  const count = isLoggedIn() ? loadFavorites().length : 0;
  document.querySelectorAll('.fav-badge').forEach((badge) => {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  });
}

// ---------- Сравнение товаров ----------

const COMPARE_LIMIT = 4;

function loadCompare() {
  try {
    return JSON.parse(localStorage.getItem('novastore_compare')) || [];
  } catch {
    return [];
  }
}

function saveCompare(ids) {
  localStorage.setItem('novastore_compare', JSON.stringify(ids));
}

function inCompare(id) {
  return loadCompare().includes(id);
}

function toggleCompare(id) {
  let list = loadCompare();
  if (list.includes(id)) {
    list = list.filter((c) => c !== id);
    saveCompare(list);
    return { added: false };
  }
  if (list.length >= COMPARE_LIMIT) {
    return { added: false, full: true };
  }
  saveCompare([...list, id]);
  return { added: true };
}

// Глобальные клики по сердечку и весам на карточках
document.addEventListener('click', (e) => {
  const favBtn = e.target.closest('[data-fav]');
  const cmpBtn = e.target.closest('[data-cmp]');
  if (!favBtn && !cmpBtn) return;
  e.preventDefault();
  e.stopPropagation();

  if (favBtn) {
    if (!requireAuth('Войдите, чтобы добавлять в избранное')) return;
    const added = toggleFavorite(Number(favBtn.dataset.fav));
    favBtn.classList.toggle('active', added);
    showToast(added ? 'Добавлено в избранное' : 'Удалено из избранного', added ? 'success' : 'info');
    if (typeof window.__onFavoritesChanged === 'function') window.__onFavoritesChanged();
  }

  if (cmpBtn) {
    const result = toggleCompare(Number(cmpBtn.dataset.cmp));
    if (result.full) {
      showToast(`В сравнении максимум ${COMPARE_LIMIT} товара`, 'error');
      return;
    }
    cmpBtn.classList.toggle('active', result.added);
    showToast(
      result.added ? 'Добавлено к сравнению — откройте «Сравнение» в меню' : 'Убрано из сравнения',
      result.added ? 'success' : 'info'
    );
    if (typeof window.__onCompareChanged === 'function') window.__onCompareChanged();
  }
});

// ---------- Купоны и промокоды ----------

const COUPONS = {
  NOVA10: { type: 'percent', value: 10, min: 0, label: '−10% на всё' },
  SALE20: { type: 'percent', value: 20, min: 50, label: '−20% при заказе от $50' },
  FIRST5: { type: 'fixed', value: 5, min: 20, label: '−$5 при заказе от $20' },
};

function validateCoupon(code, total) {
  const coupon = COUPONS[code.trim().toUpperCase()];
  if (!coupon) return { error: 'Такого промокода нет' };
  if (total < coupon.min) return { error: `Промокод действует от $${coupon.min}` };
  const amount = coupon.type === 'percent' ? (total * coupon.value) / 100 : coupon.value;
  return { code: code.trim().toUpperCase(), amount: Math.min(amount, total), label: coupon.label };
}

// ---------- Мок платёжного шлюза ----------
// Имитация реальной интеграции: интент → подтверждение, тестовая карта
// с last4 = 0002 всегда отклоняется (как в песочницах платёжных систем).

const PaymentGateway = {
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  async createIntent(amountUsd) {
    await this._delay(500);
    return {
      intentId: `pi_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      amount: amountUsd,
      currency: 'USD',
      status: 'requires_confirmation',
    };
  },

  async confirm(intent, card) {
    await this._delay(1500);
    if (card.last4 === '0002') {
      return { status: 'declined', error: 'Платёж отклонён банком: недостаточно средств' };
    }
    return {
      status: 'succeeded',
      receiptId: `re_${Date.now().toString(36)}`,
      intentId: intent.intentId,
    };
  },
};

// ---------- Банковские карты (хранятся только бренд, last4, срок) ----------

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

// ---------- Заказы ----------

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

function createOrder(cart, card, extras = {}) {
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
    subtotal: cart.getTotal(),
    coupon: extras.coupon || null,
    discountAmount: extras.discountAmount || 0,
    deliveryFee: extras.deliveryFee || 0,
    deliveryMethod: extras.deliveryMethod || null,
    address: extras.address || null,
    total: extras.finalTotal !== undefined ? extras.finalTotal : cart.getTotal(),
    receiptId: extras.receiptId || null,
    cardLast4: card.last4,
    cardBrand: card.brand,
    status: 'Оплачен',
  };
  const orders = loadOrders();
  orders.unshift(order);
  saveOrders(orders);
  return order;
}

// ---------- Отзывы + ИИ-модерация ----------

function loadAllReviews() {
  try {
    return JSON.parse(localStorage.getItem('novastore_reviews')) || {};
  } catch {
    return {};
  }
}

function loadReviews(productId) {
  return loadAllReviews()[productId] || [];
}

function saveReview(productId, review) {
  const all = loadAllReviews();
  if (!all[productId]) all[productId] = [];
  all[productId].unshift(review);
  localStorage.setItem('novastore_reviews', JSON.stringify(all));
}

// ИИ-модерация отзывов: эвристический фильтр спама, ссылок,
// капса и оскорблений — отзыв публикуется только после проверки.
function aiModerateReview(text) {
  const reasons = [];
  const lower = text.toLowerCase();

  if (text.trim().length < 10) reasons.push('отзыв слишком короткий');
  if (/(https?:\/\/|www\.|t\.me\/)/i.test(text)) reasons.push('ссылки в отзывах запрещены');

  const letters = text.replace(/[^a-zа-яё]/gi, '');
  const upper = text.replace(/[^A-ZА-ЯЁ]/g, '');
  if (letters.length > 10 && upper.length / letters.length > 0.6) {
    reasons.push('текст написан сплошным капсом');
  }

  const spamWords = ['заработок', 'крипта', 'казино', 'пиши в телеграм', 'whatsapp', 'дешевле тут', 'переходи по'];
  if (spamWords.some((w) => lower.includes(w))) reasons.push('похоже на спам или рекламу');

  const insults = ['дурак', 'идиот', 'лох', 'мошенник', 'кидалово'];
  if (insults.some((w) => lower.includes(w))) reasons.push('оскорбительная или бездоказательная лексика');

  return { ok: reasons.length === 0, reasons };
}

function starsHtml(rate) {
  const full = Math.max(0, Math.min(5, Math.round(rate)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

// ---------- Кабинет продавца ----------
// Безопасность: полный ИИН/БИН НЕ хранится — после проверки контрольного
// разряда сохраняется только маскированная версия.

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

function maskIdNumber(id) {
  return `${id.slice(0, 4)} **** ${id.slice(-4)}`;
}

// ---------- Корзина: счётчик ----------

function getCartCount() {
  try {
    const data = JSON.parse(localStorage.getItem('novastore_cart')) || [];
    return data.reduce((sum, item) => sum + (item.quantity || 0), 0);
  } catch {
    return 0;
  }
}

function updateCartIcon(animate = false) {
  const count = getCartCount();
  document.querySelectorAll('.cart-count-badge').forEach((badge) => {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
    if (animate && count > 0) {
      badge.classList.remove('bounce');
      void badge.offsetWidth;
      badge.classList.add('bounce');
    }
  });
}

// ---------- Шапка ----------

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
            <a href="compare.html">Сравнение</a>
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
          <a href="favorites.html" class="${page === 'favorites.html' ? 'active' : ''}">Избранное</a>
          <a href="compare.html" class="${page === 'compare.html' ? 'active' : ''}">Сравнение</a>
          <a href="cart.html" class="${page === 'cart.html' ? 'active' : ''}">Корзина</a>
          ${navAuthPart}
        </nav>

        <div class="header-actions">
          ${profileIcon}
          <a href="favorites.html" class="header-icon-link" aria-label="Избранное">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <span class="header-icon-label">Избранное</span>
            <span class="cart-badge fav-badge hidden">0</span>
          </a>
          <a href="cart.html" class="header-icon-link" aria-label="Корзина">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <span class="header-icon-label">Корзина</span>
            <span class="cart-badge cart-count-badge hidden">0</span>
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
      const protectedPages = ['profile.html', 'seller.html', 'favorites.html'];
      if (protectedPages.includes(page)) {
        setTimeout(() => { window.location.href = 'index.html'; }, 600);
      } else {
        renderHeader();
        renderBottomNav();
        updateCartIcon();
        updateFavIcon();
      }
    });
  }

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
  updateFavIcon();
}

// ---------- Нижняя мобильная навигация (как у маркетплейсов) ----------

function renderBottomNav() {
  let nav = document.getElementById('bottomNav');
  if (nav) nav.remove();

  const page = window.location.pathname.split('/').pop() || 'index.html';
  nav = document.createElement('nav');
  nav.id = 'bottomNav';
  nav.className = 'bottom-nav';
  nav.innerHTML = `
    <a href="index.html" class="bottom-nav-item ${page === 'index.html' || page === '' ? 'active' : ''}">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
      <span>Главная</span>
    </a>
    <a href="favorites.html" class="bottom-nav-item ${page === 'favorites.html' ? 'active' : ''}">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
      <span>Избранное</span>
      <span class="cart-badge fav-badge hidden">0</span>
    </a>
    <a href="cart.html" class="bottom-nav-item ${page === 'cart.html' ? 'active' : ''}">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
      <span>Корзина</span>
      <span class="cart-badge cart-count-badge hidden">0</span>
    </a>
    <a href="profile.html" class="bottom-nav-item ${page === 'profile.html' ? 'active' : ''}">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
      <span>Профиль</span>
    </a>
  `;
  document.body.appendChild(nav);
  updateCartIcon();
  updateFavIcon();
}

// ---------- Toast ----------

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

// ---------- Ripple ----------

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

// ---------- Reveal ----------

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
  renderBottomNav();
});
