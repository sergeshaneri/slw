# Структура проекта Socionics Wheel Balance

## 📁 Корневая директория

```
wheel-balance/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions для автодеплоя
├── public/                     # Статические файлы
├── source_idea/                # Исходный файл для референса
│   └── socionics-wheel.tsx
├── src/
│   ├── components/             # React компоненты
│   │   ├── Header/
│   │   │   ├── Header.jsx
│   │   │   └── Header.module.css
│   │   ├── LoadingScreen/
│   │   │   ├── LoadingScreen.jsx
│   │   │   └── LoadingScreen.module.css
│   │   ├── WheelView/
│   │   │   ├── WheelView.jsx
│   │   │   └── WheelView.module.css
│   │   ├── AspectsView/
│   │   │   ├── AspectsView.jsx
│   │   │   └── AspectsView.module.css
│   │   ├── DiaryView/
│   │   │   ├── DiaryView.jsx
│   │   │   └── DiaryView.module.css
│   │   └── ProgressView/
│   │       ├── ProgressView.jsx
│   │       └── ProgressView.module.css
│   ├── data/
│   │   └── aspects.js          # Данные всех 8 аспектов
│   ├── locales/
│   │   └── ru.js               # Русская локализация
│   ├── App.jsx                 # Главный компонент
│   ├── App.module.css          # Стили главного компонента
│   ├── main.jsx                # Точка входа
│   └── index.css               # Глобальные стили
├── .gitignore
├── DEPLOY.md                   # Инструкция по деплою
├── index.html                  # HTML шаблон
├── package.json                # Зависимости и скрипты
├── PROJECT_STRUCTURE.md        # Этот файл
├── README.md                   # Документация проекта
└── vite.config.js              # Конфигурация Vite

```

## 🎯 Основные компоненты

### App.jsx
Главный компонент приложения, управляет:
- Состоянием (scores, history, diary)
- Переключением между view
- Сохранением/загрузкой данных из localStorage

### Header
- Навигация между разделами
- Отображение названия приложения

### WheelView
- Радар-диаграмма текущего баланса
- Слайдеры для оценки аспектов
- Сетка карточек аспектов
- Сохранение в историю

### AspectsView
- Сетка всех аспектов (если не выбран)
- Детальная информация по выбранному аспекту
- Теория, самооценка, цели, дневник

### DiaryView
- Форма добавления записи
- Фильтрация по аспектам
- Список записей с возможностью удаления

### ProgressView
- График изменения оценок во времени
- Статистика по каждому аспекту
- Разница между первой и последней оценкой

## 🎨 CSS Modules

Каждый компонент имеет свой `.module.css` файл для изоляции стилей.

Преимущества:
- Нет конфликтов имён классов
- Локальная область видимости
- Автоматическая генерация уникальных имён

## 🌐 Локализация

Все тексты вынесены в `src/locales/ru.js`:
- Навигация
- Заголовки разделов
- Кнопки и действия
- Сообщения

Легко добавить другие языки, создав файлы `en.js`, `uk.js` и т.д.

## 📊 Данные аспектов

Файл `src/data/aspects.js` содержит:
- `ASPECT_COLORS` - цвета для каждого аспекта
- `ASPECT_KEYS` - массив ключей аспектов
- `ASPECT_DATA` - полная информация по каждому аспекту:
  - name, sub, metaphor
  - essence, superpower
  - dilemmas, archetypes
  - redFlags, fears, defenses
  - coachTips, selfAssessment
  - goals, resources

## 💾 Хранение данных

Используется localStorage API:
- `whl_scores` - текущие оценки
- `whl_history` - история сохранений (макс 30)
- `whl_diary` - записи дневника

## 🚀 Скрипты

```bash
npm run dev      # Запуск dev сервера (http://localhost:5173)
npm run build    # Сборка для production
npm run preview  # Предпросмотр production сборки
npm run deploy   # Деплой на GitHub Pages (через gh-pages)
```

## 🔧 Технологии

- **React 18** - UI библиотека
- **Vite** - сборщик и dev сервер
- **CSS Modules** - изоляция стилей
- **Recharts** - графики и диаграммы
- **localStorage** - хранение данных
- **GitHub Actions** - CI/CD

## 📱 Адаптивность

Проект адаптирован для мобильных устройств:
- Сетки переключаются на 1-2 колонки
- Навигация остаётся доступной
- Графики масштабируются

## 🎨 Дизайн

Тёмная тема с акцентами:
- Основной фон: `#0A0A0F`
- Карточки: `#0d0d1a`
- Границы: `#1a1a2e`
- Акцент: `#9d4edd` (фиолетовый)
- Каждый аспект имеет свой цвет

## ✅ Готово к деплою

Проект полностью готов к деплою на GitHub Pages:
1. Настроен `vite.config.js` с правильным `base`
2. Создан workflow для GitHub Actions
3. Добавлен скрипт `npm run deploy`
4. Написана документация

Следуйте инструкциям в `DEPLOY.md` для деплоя.
