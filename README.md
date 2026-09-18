# WMS Frontend (Angular 22)

## 📚 Документация

Подробное описание архитектуры, управления состоянием, API-интеграции и
обработки ошибок находится в папке [`/docs`](docs/). В ней содержатся:

| Файл | Описание |
|------|----------|
| [`architecture.md`](docs/architecture.md) | Общая архитектура, технологический стек, принципы проектирования, структура каталогов, безопасность, стилизация. |
| [`state-management.md`](docs/state-management.md) | Управление состоянием: глобальные SignalStore, локальные сигналы, Resource API, правила работы со стором. |
| [`api-integration.md`](docs/api-integration.md) | Интеграция с бэкендом: генерация NSwag-клиента, HTTP-интерсепторы, `httpResource`, мутации, прокси. |
| [`error-handling.md`](docs/error-handling.md) | Единый формат ошибок `WmsProblemDetails`, справочник `ErrorCodes`, стратегия по уровням, раскладка серверных ошибок по полям формы. |

Для ознакомления с API бэкенда доступна интерактивная документация
через Swagger UI при запущенном бэкенде:

```
https://localhost:7275/swagger
```

(порт может отличаться в зависимости от настроек запуска)

---

## 📋 Требования

- **Node.js** >= v22.22.0
- **npm** (или yarn/pnpm)
- **Angular CLI** — устанавливается локально, вызов через `npx ng`

---

## 🚀 Быстрый старт

### 1. Клонирование репозитория

```bash
git clone <url-репозитория>
cd wms-frontend
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Генерация API-клиента

Выполняется один раз при первом запуске, а также после каждого
обновления `swagger.json`:

```bash
npm run generate-api
```

Файл `swagger.json` должен лежать в корне проекта. Клиент генерируется
в `src/app/core/api/wms-api.ts` (не редактируется вручную).

### 4. Запуск сервера разработки

```bash
ng serve
```

Приложение — [http://localhost:4200](http://localhost:4200). Запросы на
`/api/*` проксируются на бэкенд (`http://localhost:5091`) через
`proxy.conf.json` — CORS не мешает.

> **Порт бэкенда.** HTTP-профиль — `5091`, HTTPS — `7275`. Прокси
> использует HTTP, чтобы не возиться с dev-сертификатами. Если порт
> бэкенда у тебя другой — поправь `proxy.conf.json` и **перезапусти
> `ng serve`** (Angular CLI не подхватывает правки прокси на лету).

### 5. Сборка для production

```bash
ng build
```

Результат — в папке `dist/`.

---

## 📁 Структура проекта

- **`src/app/core/`** — общие механизмы: API-клиент, аутентификация,
  интерсепторы, глобальные сторы, утилиты.
- **`src/app/features/`** — функциональные модули (auth, dashboard,
  products, warehouse, batches, receipts, supply-requests,
  supply-orders, audit, notifications).
- **`src/app/shared/`** — переиспользуемые компоненты, директивы,
  пайпы.
- **`src/app/app.ts`** — корневой компонент.
- **`src/app/app.config.ts`** — конфигурация приложения (провайдеры).
- **`src/app/app.routes.ts`** — маршрутизация.

Подробное описание — в [`docs/architecture.md`](docs/architecture.md).

---

## 🧩 Технологический стек

| Компонент | Технология |
|-----------|------------|
| Фреймворк | Angular 22.1.0 |
| Язык | TypeScript 6.0+ |
| Change Detection | **Zoneless** |
| Управление состоянием | NgRx SignalStore (глобальное), сигналы (локальное) |
| Формы | **Signal Forms** (`@angular/forms/signals`) |
| HTTP-клиент | `@angular/common/http` с функциональными интерсепторами |
| Генерация клиента | NSwag (OpenAPI → TypeScript, интерфейсы) |
| UI-компоненты | **Angular Material 22 + CDK** |
| Стили | SCSS + M3 design tokens (`--mat-sys-*`) |
| Сборка | Angular CLI |
| Тестирование | Vitest |

---

## 🔐 Аутентификация и безопасность

- **JWT-токен** хранится в `localStorage` под ключом `access_token`;
  данные пользователя — под `user_data` (`{ email, fullName, roles }`).
- **`jwtInterceptor`** добавляет `Authorization: Bearer <token>` ко
  всем запросам, **кроме `POST /api/Auth/login`** (единственный
  публичный эндпоинт).
- **`errorInterceptor`** при **401 / `UNAUTHORIZED`** выполняет
  авто-logout: чистит токен и редиректит на `/login`. Для 5xx и
  сетевых сбоев — SnackBar. Ошибки 4xx оставляет форме/стору (чтобы
  не дублировать сообщения).
- **Гарды:**
  - `authGuard` — пропускает только аутентифицированных;
  - `chiefGuard` — пропускает только роль `Chief` (для `/register`).
- **Ролевая модель:** `Chief`, `Manager`, `Worker`, `StoreDirector`.
  UI-логика строится на `computed`-селекторах поверх
  `authStore.user()?.roles`.
- **Глобальное состояние пользователя** — `AuthStore` (SignalStore).

Подробности — в [`docs/error-handling.md`](docs/error-handling.md) и
[`docs/architecture.md`](docs/architecture.md) §7.

---

## 📦 Команды

| Команда | Описание |
|---------|----------|
| `npm start` или `ng serve` | Запуск сервера разработки |
| `npm run build` | Сборка production-версии |
| `npm run generate-api` | Генерация TypeScript-клиента по `swagger.json` |
| `ng test` | Запуск тестов (Vitest) |

---

## 📝 Соглашения по коду

- **Standalone-компоненты**, без `NgModule`.
- **`inject()`** вместо конструкторного DI.
- **Signal Forms** для новых форм — не `ngModel`, не `FormControl`.
- **`httpResource` / `rxResource`** для GET-запросов.
- **`@if` / `@for` / `@switch`** в шаблонах — старые структурные
  директивы запрещены.
- **Design tokens Material** (`--mat-sys-*`) вместо хардкода цветов.
- **`::ng-deep`** и переопределение `.mat-mdc-*` запрещены.
- **Ошибки API** — обрабатываются по `ErrorCodes`, а не по тексту
  сообщения. См. [`docs/error-handling.md`](docs/error-handling.md).

Полный свод правил — в `angular_rules.xml` и `material_rules.xml` в
корне проекта.
