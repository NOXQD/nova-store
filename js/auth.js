// === AUTH.JS ===
// Вход / регистрация: вкладки, floating labels, валидация с shake-анимацией,
// показ/скрытие пароля, loader на кнопке, success checkmark.
// Учебный проект: пользователи хранятся в LocalStorage в открытом виде —
// в реальных приложениях так делать нельзя.

(() => {
  const USERS_KEY = 'novastore_users';
  const CURRENT_USER_KEY = 'novastore_current_user';

  const authCard = document.getElementById('authCard');
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const tabIndicator = document.getElementById('authTabIndicator');
  const panelLogin = document.getElementById('panelLogin');
  const panelRegister = document.getElementById('panelRegister');
  const authSuccess = document.getElementById('authSuccess');

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // ---------- Хранилище пользователей ----------

  function loadUsers() {
    try {
      const data = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
      return data.map((u) => new User(u.name, u.email, u.password));
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(
      USERS_KEY,
      JSON.stringify(users.map((u) => ({ name: u.name, email: u.email, password: u.password })))
    );
  }

  function getCurrentUser() {
    const data = getStoredUser();
    return data ? new User(data.name, data.email, data.password) : null;
  }

  function setCurrentUser(user) {
    localStorage.setItem(
      CURRENT_USER_KEY,
      JSON.stringify({ name: user.name, email: user.email, password: user.password })
    );
  }

  function logoutUser() {
    localStorage.removeItem(CURRENT_USER_KEY);
  }

  // ---------- Вкладки ----------

  function switchTab(tab) {
    const isLogin = tab === 'login';
    tabLogin.classList.toggle('active', isLogin);
    tabRegister.classList.toggle('active', !isLogin);
    tabLogin.setAttribute('aria-selected', String(isLogin));
    tabRegister.setAttribute('aria-selected', String(!isLogin));
    tabIndicator.classList.toggle('right', !isLogin);

    authSuccess.hidden = true;
    // Перезапуск slide-анимации панели
    panelLogin.classList.remove('active');
    panelRegister.classList.remove('active');
    void panelLogin.offsetWidth;
    (isLogin ? panelLogin : panelRegister).classList.add('active');
  }

  tabLogin.addEventListener('click', () => switchTab('login'));
  tabRegister.addEventListener('click', () => switchTab('register'));

  // ---------- Показать / скрыть пароль ----------

  document.querySelectorAll('.toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.classList.toggle('visible', show);
      btn.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
    });
  });

  // ---------- Валидация ----------

  function setFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(`${inputId}Error`);
    input.classList.toggle('invalid', Boolean(message));
    if (errorEl) errorEl.textContent = message || '';
  }

  function shakeForm(form) {
    form.classList.remove('shake');
    void form.offsetWidth;
    form.classList.add('shake');
  }

  function setLoading(btn, loading) {
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
  }

  // Имитация сетевой задержки, чтобы был виден loader на кнопке
  const fakeDelay = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));

  // ---------- Регистрация ----------

  async function registerUser(name, email, password, passwordConfirm) {
    let valid = true;

    if (name.length < 2) {
      setFieldError('regName', 'Имя должно быть не короче 2 символов');
      valid = false;
    } else setFieldError('regName', '');

    if (!EMAIL_RE.test(email)) {
      setFieldError('regEmail', 'Введите корректный email');
      valid = false;
    } else setFieldError('regEmail', '');

    if (password.length < 6) {
      setFieldError('regPassword', 'Пароль должен быть не короче 6 символов');
      valid = false;
    } else setFieldError('regPassword', '');

    if (password !== passwordConfirm) {
      setFieldError('regPasswordConfirm', 'Пароли не совпадают');
      valid = false;
    } else setFieldError('regPasswordConfirm', '');

    if (!valid) return false;

    const users = loadUsers();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      setFieldError('regEmail', 'Пользователь с таким email уже существует');
      return false;
    }

    users.push(new User(name, email, password));
    saveUsers(users);
    return true;
  }

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('registerSubmit');
    setLoading(submitBtn, true);
    await fakeDelay();

    const ok = await registerUser(
      document.getElementById('regName').value.trim(),
      document.getElementById('regEmail').value.trim(),
      document.getElementById('regPassword').value,
      document.getElementById('regPasswordConfirm').value
    );

    setLoading(submitBtn, false);

    if (!ok) {
      shakeForm(registerForm);
      showToast('Проверьте правильность заполнения формы', 'error');
      return;
    }

    // Success checkmark, затем переключение на вход
    registerForm.reset();
    panelRegister.classList.remove('active');
    authSuccess.hidden = false;
    showToast('Аккаунт успешно создан', 'success');

    setTimeout(() => {
      switchTab('login');
    }, 2000);
  });

  // ---------- Вход ----------

  async function loginUser(email, password) {
    let valid = true;

    if (!EMAIL_RE.test(email)) {
      setFieldError('loginEmail', 'Введите корректный email');
      valid = false;
    } else setFieldError('loginEmail', '');

    if (!password) {
      setFieldError('loginPassword', 'Введите пароль');
      valid = false;
    } else setFieldError('loginPassword', '');

    if (!valid) return null;

    const users = loadUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      setFieldError('loginEmail', 'Пользователь с таким email не найден');
      return null;
    }
    if (!user.checkPassword(password)) {
      setFieldError('loginPassword', 'Неверный пароль');
      return null;
    }

    setCurrentUser(user);
    return user;
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('loginSubmit');
    setLoading(submitBtn, true);
    await fakeDelay();

    const user = await loginUser(
      document.getElementById('loginEmail').value.trim(),
      document.getElementById('loginPassword').value
    );

    setLoading(submitBtn, false);

    if (!user) {
      shakeForm(loginForm);
      showToast('Не удалось войти', 'error');
      return;
    }

    showToast(`Добро пожаловать, ${user.name}!`, 'success');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 900);
  });

  // ---------- Сброс ошибок при вводе ----------

  document.querySelectorAll('.form-field input').forEach((input) => {
    input.addEventListener('input', () => setFieldError(input.id, ''));
  });

  // ---------- Если уже вошли — сообщаем ----------

  document.addEventListener('DOMContentLoaded', () => {
    const current = getCurrentUser();
    if (current) {
      showToast(`Вы уже вошли как ${current.name}`, 'info');
    }
  });

  // Экспорт для использования из консоли / других страниц
  window.authApi = { registerUser, loginUser, logoutUser, getCurrentUser };
})();
