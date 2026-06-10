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
  constructor(id, title, price, description, image, category, rating = null) {
    this.id = id;
    this.title = title;
    this.price = price;
    this.description = description;
    this.image = image;
    this.category = category;
    this.rating = rating; // { rate, count } из Fake Store API
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
      data.rating || null
    );
  }

  getStars() {
    const rate = this.rating ? this.rating.rate : 0;
    const full = Math.max(0, Math.min(5, Math.round(rate)));
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  // Готовая HTML-строка карточки каталога.
  // index нужен для loading="eager" у первых 4 карточек (above the fold).
  renderCard(index = 0) {
    const loadingAttr = index < 4 ? 'eager' : 'lazy';
    const rate = this.rating ? this.rating.rate.toFixed(1) : '—';
    const count = this.rating ? this.rating.count : 0;
    const title = escapeHtml(this.title);
    const categoryLabel = escapeHtml(getCategoryLabel(this.category));

    return `
      <article class="product-card reveal" data-id="${this.id}">
        <a href="product.html?id=${this.id}" aria-label="${title}">
          <div class="card-image">
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
          <div class="card-rating">
            <span class="stars" aria-hidden="true">${this.getStars()}</span>
            <span class="rating-value">${rate}</span>
            <span class="rating-count">(${count})</span>
          </div>
          <div class="card-footer">
            <span class="card-price">$${this.price.toFixed(2)}</span>
            <button type="button" class="btn btn-primary btn-add" data-id="${this.id}">В корзину</button>
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
