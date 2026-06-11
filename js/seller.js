// === SELLER.JS ===
// Кабинет продавца: онбординг (форма бизнеса: ИП/ТОО/самозанятый, ИИН/БИН
// с проверкой контрольного разряда, оферта) и дашборд управления товарами.

(() => {
  const authGate = document.getElementById('sellerAuthGate');
  const onboarding = document.getElementById('sellerOnboarding');
  const dashboard = document.getElementById('sellerDashboard');

  const sellerForm = document.getElementById('sellerForm');
  const bizType = document.getElementById('bizType');
  const bizId = document.getElementById('bizId');
  const bizIdLabel = document.getElementById('bizIdLabel');
  const shopName = document.getElementById('shopName');
  const bizPhone = document.getElementById('bizPhone');
  const agreeOffer = document.getElementById('agreeOffer');
  const agreeData = document.getElementById('agreeData');

  const dashShopName = document.getElementById('dashShopName');
  const dashMeta = document.getElementById('dashMeta');

  const productForm = document.getElementById('productForm');
  const pTitle = document.getElementById('pTitle');
  const pPrice = document.getElementById('pPrice');
  const pCategory = document.getElementById('pCategory');
  const pImage = document.getElementById('pImage');
  const pImageFile = document.getElementById('pImageFile');
  const photoPreview = document.getElementById('photoPreview');
  const photoPreviewImg = document.getElementById('photoPreviewImg');
  const pDescription = document.getElementById('pDescription');
  const sellerProductsList = document.getElementById('sellerProductsList');

  // Фото товара: либо загруженный файл (base64 dataURL), либо https-ссылка
  let uploadedImage = null;

  function showPreview(src) {
    photoPreviewImg.src = src;
    photoPreviewImg.hidden = false;
    photoPreview.classList.add('has-photo');
  }

  function clearPreview() {
    uploadedImage = null;
    photoPreviewImg.removeAttribute('src');
    photoPreviewImg.hidden = true;
    photoPreview.classList.remove('has-photo');
  }

  pImageFile.addEventListener('change', () => {
    const file = pImageFile.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFieldError(pImage, 'pImageError', 'Выберите файл изображения');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFieldError(pImage, 'pImageError', 'Файл больше 2 МБ — выберите фото поменьше');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      uploadedImage = reader.result; // data:image/...;base64,...
      pImage.value = '';
      showPreview(uploadedImage);
      setFieldError(pImage, 'pImageError', '');
    };
    reader.readAsDataURL(file);
  });

  // Превью https-ссылки по мере ввода
  pImage.addEventListener('input', () => {
    uploadedImage = null;
    const value = pImage.value.trim();
    if (/^https:\/\/.+/i.test(value)) {
      showPreview(value);
    } else {
      clearPreview();
    }
  });

  const BIZ_LABELS = { ip: 'ИП', too: 'ТОО', self: 'Самозанятый' };

  function setFieldError(input, errorId, message) {
    input.classList.toggle('invalid', Boolean(message));
    const el = document.getElementById(errorId);
    if (el) el.textContent = message || '';
  }

  function shake(form) {
    form.classList.remove('shake');
    void form.offsetWidth;
    form.classList.add('shake');
  }

  // ---------- Онбординг ----------

  bizType.addEventListener('change', () => {
    bizIdLabel.textContent = bizType.value === 'too' ? 'БИН (12 цифр)' : 'ИИН (12 цифр)';
  });

  bizId.addEventListener('input', () => {
    bizId.value = bizId.value.replace(/\D/g, '').slice(0, 12);
  });

  bizPhone.addEventListener('input', () => {
    bizPhone.value = bizPhone.value.replace(/[^\d+\s()-]/g, '');
  });

  sellerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let valid = true;

    const idLabel = bizType.value === 'too' ? 'БИН' : 'ИИН';
    if (!/^\d{12}$/.test(bizId.value)) {
      setFieldError(bizId, 'bizIdError', `${idLabel} состоит из 12 цифр`);
      valid = false;
    } else if (!validateIdNumber(bizId.value)) {
      setFieldError(bizId, 'bizIdError', `Неверный ${idLabel}: не сходится контрольный разряд`);
      valid = false;
    } else {
      setFieldError(bizId, 'bizIdError', '');
    }

    if (shopName.value.trim().length < 3) {
      setFieldError(shopName, 'shopNameError', 'Название магазина — минимум 3 символа');
      valid = false;
    } else {
      setFieldError(shopName, 'shopNameError', '');
    }

    const phoneDigits = bizPhone.value.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 12) {
      setFieldError(bizPhone, 'bizPhoneError', 'Укажите корректный номер телефона');
      valid = false;
    } else {
      setFieldError(bizPhone, 'bizPhoneError', '');
    }

    const agreeError = document.getElementById('agreeError');
    if (!agreeOffer.checked || !agreeData.checked) {
      agreeError.textContent = 'Необходимо принять оферту и согласие на обработку данных';
      valid = false;
    } else {
      agreeError.textContent = '';
    }

    if (!valid) {
      shake(sellerForm);
      showToast('Проверьте правильность заполнения формы', 'error');
      return;
    }

    const submitBtn = sellerForm.querySelector('button[type="submit"]');
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    await new Promise((resolve) => setTimeout(resolve, 900));

    // Безопасность: полный ИИН/БИН не сохраняется — только маска.
    // Контрольный разряд уже проверен, дальше документ не нужен.
    saveSellerProfile({
      type: bizType.value,
      idNumberMasked: maskIdNumber(bizId.value),
      shopName: shopName.value.trim(),
      phone: bizPhone.value.trim(),
      registeredAt: new Date().toISOString(),
    });

    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
    showToast(`Магазин «${shopName.value.trim()}» зарегистрирован!`, 'success');
    renderState();
  });

  // ---------- Дашборд ----------

  // Рейтинг магазина: средняя оценка по отзывам на товары продавца
  function shopRating() {
    const productIds = myProducts().map((p) => p.id);
    const rates = [];
    for (const id of productIds) {
      loadReviews(id).forEach((r) => rates.push(r.rate));
    }
    if (rates.length === 0) return null;
    return { rate: rates.reduce((s, r) => s + r, 0) / rates.length, count: rates.length };
  }

  function renderDashboard(profile) {
    dashShopName.textContent = `«${profile.shopName}»`;
    const registered = new Date(profile.registeredAt).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const idLabel = profile.type === 'too' ? 'БИН' : 'ИИН';
    const masked = profile.idNumberMasked || (profile.idNumber ? maskIdNumber(profile.idNumber) : '—');
    const rating = shopRating();
    dashMeta.innerHTML = `
      <div class="seller-meta-row"><span>Форма бизнеса</span><span>${BIZ_LABELS[profile.type] || profile.type}</span></div>
      <div class="seller-meta-row"><span>${idLabel}</span><span>${masked}</span></div>
      <div class="seller-meta-row"><span>Телефон</span><span>${escapeHtml(profile.phone)}</span></div>
      <div class="seller-meta-row"><span>Дата регистрации</span><span>${registered}</span></div>
      <div class="seller-meta-row"><span>Рейтинг магазина</span><span>${
        rating
          ? `<span class="stars">${starsHtml(rating.rate)}</span> ${rating.rate.toFixed(1)} (${rating.count})`
          : 'отзывов пока нет'
      }</span></div>
    `;
    renderMyProducts();
  }

  function myProducts() {
    const user = getStoredUser();
    return loadSellerProducts().filter((p) => p.sellerEmail === user.email.toLowerCase());
  }

  function renderMyProducts() {
    const products = myProducts();
    if (products.length === 0) {
      sellerProductsList.innerHTML = `<p class="card-list-empty">Товаров пока нет — добавьте первый через форму выше</p>`;
      return;
    }
    sellerProductsList.innerHTML = products
      .map(
        (p) => `
        <div class="seller-product-row" data-id="${p.id}">
          <span class="cart-thumb seller-product-thumb">
            <img src="${p.image}" alt="${escapeHtml(p.title)}" loading="lazy" width="48" height="48" onerror="handleImgError(this)">
          </span>
          <div class="cart-row-info">
            <a href="product.html?id=${p.id}" class="cart-row-title">${escapeHtml(p.title)}</a>
            <span class="cart-row-price">${escapeHtml(getCategoryLabel(p.category))} · $${Number(p.price).toFixed(2)}</span>
          </div>
          <button type="button" class="cart-row-remove product-delete" data-id="${p.id}" aria-label="Снять с продажи">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>`
      )
      .join('');
  }

  sellerProductsList.addEventListener('click', (e) => {
    const btn = e.target.closest('.product-delete');
    if (!btn) return;
    const all = loadSellerProducts().filter((p) => p.id !== Number(btn.dataset.id));
    saveSellerProducts(all);
    renderMyProducts();
    showToast('Товар снят с продажи', 'info');
  });

  productForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;

    if (pTitle.value.trim().length < 3) {
      setFieldError(pTitle, 'pTitleError', 'Название — минимум 3 символа');
      valid = false;
    } else setFieldError(pTitle, 'pTitleError', '');

    const price = Number(pPrice.value);
    if (!price || price <= 0) {
      setFieldError(pPrice, 'pPriceError', 'Укажите цену больше нуля');
      valid = false;
    } else setFieldError(pPrice, 'pPriceError', '');

    // Фото: либо загруженный файл, либо корректная https-ссылка
    let image = uploadedImage;
    if (!image) {
      try {
        if (new URL(pImage.value).protocol === 'https:') image = pImage.value.trim();
      } catch { /* не URL */ }
    }
    if (!image) {
      setFieldError(pImage, 'pImageError', 'Загрузите фото или вставьте https-ссылку');
      valid = false;
    } else setFieldError(pImage, 'pImageError', '');

    if (pDescription.value.trim().length < 10) {
      setFieldError(pDescription, 'pDescriptionError', 'Описание — минимум 10 символов');
      valid = false;
    } else setFieldError(pDescription, 'pDescriptionError', '');

    if (!valid) {
      shake(productForm);
      return;
    }

    const user = getStoredUser();
    const profile = getSellerProfile();
    const all = loadSellerProducts();
    all.push({
      id: API.SELLER_OFFSET + Date.now(),
      sellerEmail: user.email.toLowerCase(),
      shopName: profile.shopName,
      title: pTitle.value.trim(),
      price,
      description: pDescription.value.trim(),
      image,
      category: pCategory.value,
      rating: { rate: 0, count: 0 },
      createdAt: new Date().toISOString(),
    });
    saveSellerProducts(all);

    productForm.reset();
    clearPreview();
    renderMyProducts();
    showToast('Товар опубликован в каталоге', 'success');
  });

  // ---------- Выбор состояния страницы ----------

  function renderState() {
    if (!isLoggedIn()) {
      authGate.hidden = false;
      onboarding.hidden = true;
      dashboard.hidden = true;
      return;
    }
    authGate.hidden = true;

    const profile = getSellerProfile();
    if (!profile) {
      onboarding.hidden = false;
      dashboard.hidden = true;
    } else {
      onboarding.hidden = true;
      dashboard.hidden = false;
      renderDashboard(profile);
    }
  }

  document.addEventListener('DOMContentLoaded', renderState);
})();
