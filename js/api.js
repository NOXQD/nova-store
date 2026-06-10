// === API.JS ===
// Каталог собирается из трёх источников:
//  1. Fake Store API (https://fakestoreapi.com) — id 1..20
//  2. DummyJSON (https://dummyjson.com) — id со сдвигом +1000
//  3. Товары продавцов маркетплейса из LocalStorage — id от 2 000 000
// Все сетевые ответы кэшируются в Map.

const API = {
  fakeStoreUrl: 'https://fakestoreapi.com',
  dummyJsonUrl: 'https://dummyjson.com',
  cache: new Map(),

  DUMMY_OFFSET: 1000,
  SELLER_OFFSET: 2000000,

  async _fetchJson(url) {
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Ошибка API: HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data === null || data === undefined || data === '') {
        throw new Error('API вернул пустой ответ');
      }
      this.cache.set(url, data);
      return data;
    } catch (err) {
      console.error(`[API] ${url}:`, err.message);
      throw err;
    }
  },

  _normalizeFakeStore(item) {
    return Product.fromData(item);
  },

  _normalizeDummy(item) {
    const discount = item.discountPercentage || 0;
    const oldPrice = discount >= 1 ? item.price / (1 - discount / 100) : null;
    return new Product(
      item.id + this.DUMMY_OFFSET,
      item.title,
      item.price,
      item.description,
      item.thumbnail,
      item.category,
      { rate: item.rating || 0, count: item.stock || 0 },
      { oldPrice, discount }
    );
  },

  _sellerProducts() {
    return loadSellerProducts().map((item) => Product.fromData(item));
  },

  // Весь каталог: оба API параллельно + товары продавцов.
  // Если один источник недоступен — работаем с остальными.
  async getProducts() {
    const [fakeStore, dummy] = await Promise.allSettled([
      this._fetchJson(`${this.fakeStoreUrl}/products`),
      this._fetchJson(`${this.dummyJsonUrl}/products?limit=100`),
    ]);

    const products = [];

    if (fakeStore.status === 'fulfilled') {
      products.push(...fakeStore.value.map((item) => this._normalizeFakeStore(item)));
    }
    if (dummy.status === 'fulfilled') {
      products.push(...dummy.value.products.map((item) => this._normalizeDummy(item)));
    }

    if (products.length === 0) {
      throw new Error('Каталог недоступен: не ответил ни один источник');
    }

    products.push(...this._sellerProducts());
    return products;
  },

  // Один товар по id — источник определяется диапазоном id
  async getProductById(id) {
    if (id >= this.SELLER_OFFSET) {
      const product = this._sellerProducts().find((p) => p.id === id);
      if (!product) throw new Error('Товар продавца не найден');
      return product;
    }
    if (id > this.DUMMY_OFFSET) {
      const data = await this._fetchJson(`${this.dummyJsonUrl}/products/${id - this.DUMMY_OFFSET}`);
      return this._normalizeDummy(data);
    }
    const data = await this._fetchJson(`${this.fakeStoreUrl}/products/${id}`);
    return this._normalizeFakeStore(data);
  },

  // Уникальные категории из собранного каталога
  async getCategories() {
    const products = await this.getProducts();
    return [...new Set(products.map((p) => p.category))];
  },

  async getProductsByCategory(category) {
    const products = await this.getProducts();
    return products.filter((p) => p.category === category);
  },
};
