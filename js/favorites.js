// === FAVORITES.JS ===
// Избранное: грид сохранённых товаров, синхронизация с сердечками на карточках.

(() => {
  const authGate = document.getElementById('favAuthGate');
  const grid = document.getElementById('favGrid');
  const emptyBlock = document.getElementById('favEmpty');
  const errorBlock = document.getElementById('favError');

  const cart = Cart.load();
  let allProducts = [];

  function renderFavorites() {
    const ids = loadFavorites();
    const favorites = allProducts.filter((p) => ids.includes(p.id));

    emptyBlock.hidden = favorites.length > 0;
    grid.innerHTML = favorites
      .map((p, i) => p.renderCard(i, cart.getQuantity(p.id)))
      .join('');
    observeReveal(grid);
  }

  // Снятое сердечко убирает карточку со страницы
  window.__onFavoritesChanged = renderFavorites;

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
    }

    const box = grid.querySelector(`.card-buy[data-id="${id}"]`);
    if (box) box.innerHTML = buyControlsHtml(id, cart.getQuantity(id));
    updateCartIcon(true);
  });

  document.addEventListener('DOMContentLoaded', async () => {
    if (!isLoggedIn()) {
      authGate.hidden = false;
      return;
    }
    authGate.hidden = true;

    try {
      allProducts = await API.getProducts();
      renderFavorites();
    } catch {
      errorBlock.hidden = false;
    }
  });
})();
