// === COMMON.JS ===
// Общие функции: шапка, badge корзины, toast, ripple, reveal-анимации,
// авторизация-гейт, банковские карты, заказы, утилиты.

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

// Русские названия категорий Fake Store API
const CATEGORY_LABELS = {
  electronics: 'Электроника',
  jewelery: 'Украшения',
  "men's clothing": 'Мужская одежда',
  "women's clothing": 'Женская одежда',
};

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

// Глобальный onerror-обработчик для всех img:
// убираем битый src, прячем картинку, контейнер показывает SVG-заглушку через ::after
function handleImgError(img) {
  img.onerror = null;
  img.removeAttribute('src');
  img.style.display = 'none';
  if (img.parentElement) {
    img.parentElement.classList.add('img-fallback');
  }
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

// Гейт: без входа покупки недоступны. Показывает toast и уводит на auth.html.
function requireAuth(message = 'Войдите, чтобы продолжить') {
  if (isLoggedIn()) return true;
  showToast(message, 'error');
  setTimeout(() => {
    window.location.href = 'auth.html';
  }, 1200);
  return false;
}

// Ключ в LocalStorage, привязанный к email текущего пользователя
function userStorageKey(prefix) {
  const user = getStoredUser();
  return user ? `${prefix}_${user.email.toLowerCase()}` : null;
}

// ---------- Банковские карты пользователя ----------
// Учебная имитация: полный номер и CVC НЕ сохраняются —
// только бренд, последние 4 цифры, срок и имя держателя.

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

// Валидация формы карты. Возвращает { errors: {...}, card } —
// card заполнена только если ошибок нет.
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

// Автоформат полей карты: номер группами по 4, срок ММ/ГГ
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

// ---------- Количество товаров в корзине ----------

function getCartCount() {
  try {
    const data = JSON.parse(localStorage.getItem('novastore_cart')) || [];
    return data.reduce((sum, item) => sum + (item.quantity || 0), 0);
  } catch {
    return 0;
  }
}

// Обновить badge на иконке корзины; animate=true — bounce-анимация
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

// ---------- Шапка ----------

function renderHeader() {
  const root = document.getElementById('app-header');
  if (!root) return;

  const page = window.location.pathname.split('/').pop() || 'index.html';
  const user = getStoredUser();

  const authPart = user
    ? `<a href="profile.html" class="${page === 'profile.html' ? 'active' : ''}">Профиль</a>
       <a href="profile.html" class="nav-user">👤 ${escapeHtml(user.name)}</a>
       <button type="button" class="btn-logout" id="logoutBtn">Выйти</button>`
    : `<a href="auth.html" class="${page === 'auth.html' ? 'active' : ''}">Войти</a>`;

  root.innerHTML = `
    <header class="site-header" id="siteHeader">
      <div class="container header-inner">
        <a href="index.html" class="logo">NOVA<span>STORE</span></a>

        <nav class="nav" id="mainNav">
          <a href="index.html" class="${page === 'index.html' || page === '' ? 'active' : ''}">Каталог</a>
          <a href="cart.html" class="${page === 'cart.html' ? 'active' : ''}">Корзина</a>
          ${authPart}
        </nav>

        <div class="header-actions">
          <a href="cart.html" class="cart-icon-link" aria-label="Корзина">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
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

  // Изменение фона шапки при скролле
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Гамбургер-меню на мобиле
  const hamburger = document.getElementById('hamburgerBtn');
  hamburger.addEventListener('click', () => {
    const open = header.classList.toggle('nav-open');
    hamburger.setAttribute('aria-expanded', String(open));
  });
  document.getElementById('mainNav').addEventListener('click', (e) => {
    if (e.target.closest('a')) header.classList.remove('nav-open');
  });

  // Выход
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('novastore_current_user');
      showToast('Вы вышли из аккаунта', 'info');
      const protectedPages = ['profile.html'];
      if (protectedPages.includes(page)) {
        setTimeout(() => { window.location.href = 'index.html'; }, 600);
      } else {
        renderHeader();
        updateCartIcon();
      }
    });
  }

  updateCartIcon();
}

// ---------- Toast-уведомления ----------
// showToast('Товар добавлен', 'success' | 'error' | 'info'), auto-dismiss 3s

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

// ---------- Ripple-эффект на кнопках ----------

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

// ---------- Reveal-анимация через IntersectionObserver ----------

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

// Наблюдать за всеми .reveal внутри контейнера со stagger-задержкой +0.08s
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

// ---------- Инициализация на каждой странице ----------

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
});
