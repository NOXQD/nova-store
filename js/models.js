// === MODELS.JS ===
// ООП-классы предметной области: User, Product, CartItem, Cart

class User {
  constructor(name, email, password) {
    this.name = name;
    this.email = email;
    this.password = password;
  }

  checkPassword(password) {
    return this.password === password;
  }
}

class Product {
  constructor(id, title, price, description, image, category, rating = null, extra = {}) {
    this.id = id;
    this.title = title;
    this.price = price;
    this.description = description;
    this.image = image;
    this.category = category;
    this.rating = rating; // { rate, count }
    this.oldPrice = extra.oldPrice || null;       // цена до скидки
    this.discount = Math.round(extra.discount || 0); // процент скидки
    this.shopName = extra.shopName || null;       // товар продавца маркетплейса
  }

  // Создание из сырого объекта API / LocalStorage
  static fromData(data) {
    return new Product(
      data.id,
      data.title,
      data.price,
      data.description,
      data.image,
      data.category,
      data.rating || null,
      { oldPrice: data.oldPrice, discount: data.discount, shopName: data.shopName }
    );
  }

  getStars() {
    const rate = this.rating ? this.rating.rate : 0;
    const full = Math.max(0, Math.min(5, Math.round(rate)));
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  priceHtml() {
    const current = `$${this.price.toFixed(2)}`;
    if (this.oldPrice && this.oldPrice > this.price) {
      return `<span class="price-new">${current}</span> <s class="price-old">$${this.oldPrice.toFixed(2)}</s>`;
    }
    return `<span class="price-new">${current}</span>`;
  }

  // Готовая HTML-строка карточки каталога.
  // index — для loading="eager" у первых 4 карточек (above the fold),
  // cartQty — текущее количество в корзине (рендерит степпер вместо кнопки).
  renderCard(index = 0, cartQty = 0) {
    const loadingAttr = index < 4 ? 'eager' : 'lazy';
    const rate = this.rating ? Number(this.rating.rate).toFixed(1) : '—';
    const count = this.rating ? this.rating.count : 0;
    const title = escapeHtml(this.title);
    const categoryLabel = escapeHtml(getCategoryLabel(this.category));
    const discountBadge = this.discount >= 20
      ? `<span class="discount-badge superprice">Суперцена −${this.discount}%</span>`
      : this.discount >= 5
        ? `<span class="discount-badge">−${this.discount}%</span>`
        : '';
    const shopLine = this.shopName
      ? `<span class="card-shop">Магазин: ${escapeHtml(this.shopName)}</span>`
      : '';
    const favActive = typeof isFavorite === 'function' && isLoggedIn() && isFavorite(this.id);
    const cmpActive = typeof inCompare === 'function' && inCompare(this.id);

    return `
      <article class="product-card reveal" data-id="${this.id}">
        <a href="product.html?id=${this.id}" aria-label="${title}">
          <div class="card-image">
            ${discountBadge}
            <div class="card-actions">
              <button type="button" class="card-action-btn ${favActive ? 'active' : ''}" data-fav="${this.id}" aria-label="В избранное">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
              </button>
              <button type="button" class="card-action-btn ${cmpActive ? 'active' : ''}" data-cmp="${this.id}" aria-label="Сравнить">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
              </button>
            </div>
            <img
              src="${this.image}"
              alt="${title}"
              loading="${loadingAttr}"
              width="200"
              height="200"
              onerror="handleImgError(this)">
          </div>
        </a>
        <div class="card-body">
          <span class="card-category">${categoryLabel}</span>
          <h3 class="card-title"><a href="product.html?id=${this.id}">${title}</a></h3>
          ${shopLine}
          <div class="card-rating">
            <span class="stars" aria-hidden="true">${this.getStars()}</span>
            <span class="rating-value">${rate}</span>
            <span class="rating-count">(${count})</span>
          </div>
          <div class="card-footer">
            <span class="card-price">${this.priceHtml()}</span>
            <div class="card-buy" data-id="${this.id}">${buyControlsHtml(this.id, cartQty)}</div>
          </div>
        </div>
      </article>
    `;
  }
}

class CartItem {
  constructor(product, quantity = 1) {
    this.product = product;
    this.quantity = quantity;
  }

  getTotalPrice() {
    return this.product.price * this.quantity;
  }
}

class Cart {
  static STORAGE_KEY = 'novastore_cart';

  constructor() {
    this.items = [];
  }

  // Добавить товар; если уже есть — увеличить количество
  addProduct(product, quantity = 1) {
    const existing = this.items.find((item) => item.product.id === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.items.push(new CartItem(product, quantity));
    }
    this.save();
  }

  removeProduct(productId) {
    this.items = this.items.filter((item) => item.product.id !== productId);
    this.save();
  }

  // delta = +1 / -1; при количестве 0 товар удаляется
  updateQuantity(productId, delta) {
    const item = this.items.find((i) => i.product.id === productId);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
      this.removeProduct(productId);
    } else {
      this.save();
    }
  }

  getQuantity(productId) {
    const item = this.items.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  }

  getTotal() {
    return this.items.reduce((sum, item) => sum + item.getTotalPrice(), 0);
  }

  getCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  clear() {
    this.items = [];
    this.save();
  }

  // Сериализация для LocalStorage — image сохраняется вместе с товаром,
  // поэтому фото в корзине всегда отображаются без повторного запроса к API
  toJSON() {
    return this.items.map((item) => ({
      product: {
        id: item.product.id,
        title: item.product.title,
        price: item.product.price,
        description: item.product.description,
        image: item.product.image,
        category: item.product.category,
        rating: item.product.rating,
        oldPrice: item.product.oldPrice,
        discount: item.product.discount,
        shopName: item.product.shopName,
      },
      quantity: item.quantity,
    }));
  }

  fromJSON(data) {
    if (!Array.isArray(data)) return;
    this.items = data
      .filter((entry) => entry && entry.product && typeof entry.quantity === 'number')
      .map((entry) => new CartItem(Product.fromData(entry.product), entry.quantity));
  }

  save() {
    try {
      localStorage.setItem(Cart.STORAGE_KEY, JSON.stringify(this.toJSON()));
    } catch (err) {
      console.error('Не удалось сохранить корзину:', err);
    }
  }

  static load() {
    const cart = new Cart();
    try {
      const raw = localStorage.getItem(Cart.STORAGE_KEY);
      if (raw) cart.fromJSON(JSON.parse(raw));
    } catch (err) {
      console.error('Не удалось загрузить корзину:', err);
    }
    return cart;
  }
}
