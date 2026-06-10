// === API.JS ===
// Работа с Fake Store API: https://fakestoreapi.com
// Все результаты кэшируются в Map — повторные запросы не уходят в сеть.

const API = {
  baseUrl: 'https://fakestoreapi.com',
  cache: new Map(),

  async _fetch(endpoint) {
    if (this.cache.has(endpoint)) {
      return this.cache.get(endpoint);
    }
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`);
      if (!response.ok) {
        throw new Error(`Ошибка API: HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data === null || data === undefined || data === '') {
        throw new Error('API вернул пустой ответ');
      }
      this.cache.set(endpoint, data);
      return data;
    } catch (err) {
      console.error(`[API] ${endpoint}:`, err.message);
      throw err;
    }
  },

  // Все товары → массив экземпляров Product
  async getProducts() {
    const data = await this._fetch('/products');
    return data.map((item) => Product.fromData(item));
  },

  // Один товар по id → Product
  async getProductById(id) {
    const data = await this._fetch(`/products/${id}`);
    return Product.fromData(data);
  },

  // Список категорий → массив строк
  async getCategories() {
    return this._fetch('/products/categories');
  },

  // Товары категории → массив Product
  async getProductsByCategory(category) {
    const data = await this._fetch(`/products/category/${encodeURIComponent(category)}`);
    return data.map((item) => Product.fromData(item));
  },
};
