# NOVA STORE

Интернет-магазин на чистом HTML, CSS и JavaScript — без фреймворков и сборщиков.
Товары, фото и категории загружаются из [Fake Store API](https://fakestoreapi.com).

**Демо:** https://magazin-noxqd.vercel.app

## Возможности

- Каталог товаров с фильтрами по категориям, живым поиском (debounce 300 мс) и сортировкой по цене и названию
- Страница товара: zoom фото при наведении, рейтинг, счётчик количества
- Корзина с хранением в LocalStorage: изменение количества, удаление с анимацией, оформление заказа через модальное окно
- Регистрация и вход: валидация форм, floating labels, показ/скрытие пароля
- Тёмная тема в стиле Apple: glassmorphism, градиенты, skeleton-загрузка с shimmer-эффектом
- Анимации: появление карточек при скролле (IntersectionObserver), ripple на кнопках, toast-уведомления, bounce badge корзины
- Адаптивная вёрстка mobile-first: 1 / 2 / 3 / 4 колонки, гамбургер-меню на мобильных

## Структура проекта

```
├── index.html       # Главная + каталог
├── product.html     # Страница товара
├── cart.html        # Корзина
├── auth.html        # Вход / регистрация
├── css/
│   └── style.css    # Все стили
└── js/
    ├── api.js       # Работа с Fake Store API (кэширование в Map)
    ├── models.js    # Классы: User, Product, Cart, CartItem
    ├── catalog.js   # Логика главной страницы
    ├── product.js   # Логика страницы товара
    ├── cart.js      # Логика корзины
    ├── auth.js      # Логика входа/регистрации
    └── common.js    # Общие функции: шапка, toast, анимации
```

## Запуск

Сборка не нужна. Достаточно открыть `index.html` в браузере —
или поднять любой статический сервер:

```bash
python -m http.server 8000
```

Нужен доступ в интернет: данные и фотографии товаров грузятся с fakestoreapi.com.

## Технологии

- HTML5, CSS3 (Custom Properties, Grid, clamp, backdrop-filter)
- JavaScript ES6+ (классы, async/await, fetch, LocalStorage, IntersectionObserver)
- [Fake Store API](https://fakestoreapi.com)
- Хостинг: [Vercel](https://vercel.com)
