// === COMPARE.JS ===
// Сравнение товаров side-by-side: до 4 товаров в таблице характеристик.

(() => {
  const wrap = document.getElementById('compareWrap');
  const table = document.getElementById('compareTable');
  const emptyBlock = document.getElementById('compareEmpty');
  const errorBlock = document.getElementById('compareError');

  const cart = Cart.load();
  let allProducts = [];

  function bestValueId(products, getter, mode = 'min') {
    let best = null;
    for (const p of products) {
      const value = getter(p);
      if (value === null || value === undefined) continue;
      if (best === null) best = p;
      else {
        const bestValue = getter(best);
        if ((mode === 'min' && value < bestValue) || (mode === 'max' && value > bestValue)) {
          best = p;
        }
      }
    }
    return best ? best.id : null;
  }

  function renderCompare() {
    const ids = loadCompare();
    const products = allProducts.filter((p) => ids.includes(p.id));

    if (products.length === 0) {
      wrap.hidden = true;
      emptyBlock.hidden = false;
      return;
    }
    wrap.hidden = false;
    emptyBlock.hidden = true;

    const cheapestId = bestValueId(products, (p) => p.price, 'min');
    const topRatedId = bestValueId(products, (p) => (p.rating ? p.rating.rate : null), 'max');

    const row = (label, cellFn) =>
      `<tr><th>${label}</th>${products.map((p) => `<td>${cellFn(p)}</td>`).join('')}</tr>`;

    table.innerHTML = `
      <tbody>
        ${row('', (p) => `
          <div class="compare-head">
            <button type="button" class="compare-remove" data-remove="${p.id}" aria-label="Убрать из сравнения">✕</button>
            <a href="product.html?id=${p.id}" class="compare-photo">
              <img src="${p.image}" alt="${escapeHtml(p.title)}" loading="lazy" width="120" height="120" onerror="handleImgError(this)">
            </a>
            <a href="product.html?id=${p.id}" class="compare-title">${escapeHtml(p.title)}</a>
          </div>`)}
        ${row('Цена', (p) => `
          <span class="compare-price ${p.id === cheapestId ? 'compare-best' : ''}">
            $${p.price.toFixed(2)} ${p.id === cheapestId ? '· выгоднее' : ''}
          </span>
          ${p.oldPrice ? `<s class="price-old">$${p.oldPrice.toFixed(2)}</s>` : ''}`)}
        ${row('Скидка', (p) => (p.discount >= 5 ? `−${p.discount}%` : '—'))}
        ${row('Рейтинг', (p) => `
          <span class="stars">${p.getStars()}</span>
          <span class="${p.id === topRatedId ? 'compare-best' : ''}">
            ${p.rating ? Number(p.rating.rate).toFixed(1) : '—'} (${p.rating ? p.rating.count : 0})
          </span>`)}
        ${row('Категория', (p) => escapeHtml(getCategoryLabel(p.category)))}
        ${row('Продавец', (p) => (p.shopName ? escapeHtml(p.shopName) : 'NOVA STORE'))}
        ${row('Описание', (p) => `<span class="compare-desc">${escapeHtml(p.description.slice(0, 140))}${p.description.length > 140 ? '…' : ''}</span>`)}
        ${row('', (p) => `<div class="card-buy" data-id="${p.id}">${buyControlsHtml(p.id, cart.getQuantity(p.id))}</div>`)}
      </tbody>
    `;
  }

  window.__onCompareChanged = renderCompare;

  table.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove]');
    if (removeBtn) {
      toggleCompare(Number(removeBtn.dataset.remove));
      renderCompare();
      return;
    }

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

    const box = table.querySelector(`.card-buy[data-id="${id}"]`);
    if (box) box.innerHTML = buyControlsHtml(id, cart.getQuantity(id));
    updateCartIcon(true);
  });

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      allProducts = await API.getProducts();
      renderCompare();
    } catch {
      errorBlock.hidden = false;
    }
  });
})();
