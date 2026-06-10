// === AUTH.JS ===
// Вход / регистрация. Безопасность:
//  - пароли хранятся ТОЛЬКО в виде SHA-256 хэша с индивидуальной солью;
//  - в сессии (novastore_current_user) — только имя и email, без пароля;
//  - старые учётные записи с открытым паролем мигрируются на хэш при входе.

(() => {
  const USERS_KEY = 'novastore_users';
  const CURRENT_USER_KEY = 'novastore_current_user';

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

  function loadUserRecords() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveUserRecords(records) {
    localStorage.setItem(USERS_KEY, JSON.stringify(records));
  }

  function setCurrentUser(record) {
    // В сессию попадают только имя и email — никаких паролей и хэшей
    localStorage.setItem(
      CURRENT_USER_KEY,
      JSON.stringify({ name: record.name, email: record.email })
    );
  }

  function logoutUser() {
    localStorage.removeItem(CURRENT_USER_KEY);
  }

  function getCurrentUser() {
    return getStoredUser();
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

    if (!valid) return null;

    const records = loadUserRecords();
    if (records.some((r) => r.email.toLowerCase() === email.toLowerCase())) {
      setFieldError('regEmail', 'Пользователь с таким email уже существует');
      return null;
    }

    const salt = randomSalt();
    const passwordHash = await hashPassword(password, salt);
    const record = { name, email, salt, passwordHash };
    records.push(record);
    saveUserRecords(records);
    return record;
  }

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('registerSubmit');
    setLoading(submitBtn, true);

    const record = await registerUser(
      document.getElementById('regName').value.trim(),
      document.getElementById('regEmail').value.trim(),
      document.getElementById('regPassword').value,
      document.getElementById('regPasswordConfirm').value
    );

    setLoading(submitBtn, false);

    if (!record) {
      shakeForm(registerForm);
      showToast('Проверьте правильность заполнения формы', 'error');
      return;
    }

    setCurrentUser(record);
    registerForm.reset();
    panelRegister.classList.remove('active');
    authSuccess.hidden = false;
    showToast(`Добро пожаловать, ${record.name}!`, 'success');

    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1800);
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

    const records = loadUserRecords();
    const record = records.find((r) => r.email.toLowerCase() === email.toLowerCase());

    if (!record) {
      setFieldError('loginEmail', 'Пользователь с таким email не найден');
      return null;
    }

    let passwordOk = false;
    if (record.passwordHash) {
      passwordOk = (await hashPassword(password, record.salt)) === record.passwordHash;
    } else if (record.password) {
      // Миграция старой записи: проверяем открытый пароль через класс User
      // и сразу заменяем его на хэш с солью
      const legacy = new User(record.name, record.email, record.password);
      passwordOk = legacy.checkPassword(password);
      if (passwordOk) {
        record.salt = randomSalt();
        record.passwordHash = await hashPassword(password, record.salt);
        delete record.password;
        saveUserRecords(records);
      }
    }

    if (!passwordOk) {
      setFieldError('loginPassword', 'Неверный пароль');
      return null;
    }

    setCurrentUser(record);
    return record;
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('loginSubmit');
    setLoading(submitBtn, true);

    const record = await loginUser(
      document.getElementById('loginEmail').value.trim(),
      document.getElementById('loginPassword').value
    );

    setLoading(submitBtn, false);

    if (!record) {
      shakeForm(loginForm);
      showToast('Не удалось войти', 'error');
      return;
    }

    showToast(`Добро пожаловать, ${record.name}!`, 'success');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 900);
  });

  // ---------- Сброс ошибок при вводе ----------

  document.querySelectorAll('.form-field input').forEach((input) => {
    input.addEventListener('input', () => setFieldError(input.id, ''));
  });

  document.addEventListener('DOMContentLoaded', () => {
    const current = getCurrentUser();
    if (current) {
      showToast(`Вы уже вошли как ${current.name}`, 'info');
    }
  });

  window.authApi = { registerUser, loginUser, logoutUser, getCurrentUser };
})();
