# Инструкция по деплою на GitHub Pages

## Шаг 1: Настройка репозитория

1. Убедитесь, что вы находитесь в репозитории `slw` на GitHub
2. Откройте `vite.config.js` и проверьте, что `base` соответствует названию репозитория:

```js
export default defineConfig({
  plugins: [react()],
  base: '/slw/'  // Должно совпадать с названием репозитория
})
```

## Шаг 2: Первый коммит

```bash
git add .
git commit -m "Initial commit: Socionics Wheel Balance App"
git push origin main
```

## Шаг 3: Настройка GitHub Pages

1. Перейдите в Settings репозитория на GitHub
2. В разделе "Pages" выберите:
   - Source: "GitHub Actions"
3. Workflow автоматически запустится при следующем push

## Шаг 4: Деплой

После push в main ветку, GitHub Actions автоматически:
- Установит зависимости
- Соберёт проект
- Задеплоит на GitHub Pages

Ваше приложение будет доступно по адресу:
`https://shaneriser-gif.github.io/slw/`

## Альтернативный метод (через gh-pages)

Если хотите использовать пакет gh-pages:

```bash
npm run deploy
```

Это создаст ветку `gh-pages` и задеплоит туда собранное приложение.

## Локальная разработка

```bash
# Запуск dev сервера
npm run dev

# Сборка для production
npm run build

# Предпросмотр production сборки
npm run preview
```

## Структура проекта

- `src/components/` - React компоненты с CSS модулями
- `src/data/` - Данные аспектов соционики
- `src/locales/` - Файлы локализации (русский язык)
- `src/App.jsx` - Главный компонент приложения
- `src/main.jsx` - Точка входа

## Особенности

- ✅ CSS Modules для изоляции стилей
- ✅ Разделение на компоненты
- ✅ Локализация вынесена в отдельные файлы
- ✅ Данные аспектов структурированы
- ✅ Автосохранение в localStorage
- ✅ Адаптивный дизайн
- ✅ GitHub Actions для автодеплоя
