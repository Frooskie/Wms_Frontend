# Архитектура фронтенда WMS

---

## 1. Общие принципы

Клиентская часть WMS построена на **Angular 22.1.0** с использованием
**строгого режима TypeScript** и всех современных подходов: сигналы,
функциональные интерсепторы и гарды, автономные компоненты, ленивая
загрузка, Zoneless change detection. Приложение следует
**feature-first** организации кода.

Приложение — SPA, взаимодействует с бэкендом через REST API. Вся
бизнес-логика, связанная с работой с данными, делегируется серверу;
клиент отвечает за UI, маршрутизацию, кэширование и реактивное
управление состоянием.

---

## 2. Технологический стек

| Компонент | Технология                                              |
|-----------|---------------------------------------------------------|
| Фреймворк | Angular 22.1.0+                                         |
| Язык | TypeScript 6.0+                                         |
| Change Detection | **Zoneless** (`provideZonelessChangeDetection`)         |
| Управление состоянием | NgRx SignalStore (глобальное), сигналы (локальное)      |
| Формы | **Signal Forms** (`@angular/forms/signals`)             |
| HTTP-клиент | `@angular/common/http` с функциональными интерсепторами |
| Генерация клиента | NSwag (OpenAPI → TypeScript, `typeStyle: "Interface"`)  |
| UI-компоненты | **Angular Material 22 + CDK**                           |
| Стили | SCSS + M3 design tokens (`--mat-sys-*`)                 |
| Шрифты | Roboto + Material Icons                                 |
| Сборка | Angular CLI                                             |
| Тестирование | Vitest (по умолчанию в v22)                             |

---

## 3. Принципы проектирования

### 3.1. Standalone-компоненты

Все компоненты, директивы и пайпы объявляются автономно (без
`NgModule`). Это стандарт Angular 22, который упрощает структуру и
ускоряет загрузку.

### 3.2. Change Detection Strategy — Zoneless

Приложение работает **без Zone.js** через
`provideZonelessChangeDetection()`. Стратегия `OnPush` является
значением по умолчанию — указывать её явно не нужно.

Следствия:

- **Не использовать `NgZone.run`** — он не обновит UI.
- **Не полагаться на Zone.js** для отслеживания асинхронных
  операций — все изменения проходят через сигналы.
- **Материал полностью Zoneless-совместим** — не нужно вручную
  вызывать `ChangeDetectorRef.detectChanges()`.

### 3.3. Строгая типизация

Включён `strict` режим TypeScript. Запрещено использование `any` —
допускается только `unknown` в крайних случаях.

### 3.4. Реактивность

Состояние компонентов управляется сигналами (`signal`, `computed`).
Асинхронные данные загружаются через `httpResource` / `rxResource`.
Формы — Signal Forms.

### 3.5. Ленивая загрузка

Все фичи загружаются по требованию через `loadComponent` в роутинге.
Это уменьшает начальный размер бандла.

### 3.6. Новый синтаксис шаблонов

Используются управляющие конструкции `@if`, `@for` (с обязательным
`track`), `@switch`. Старые структурные директивы (`*ngIf` и др.)
запрещены.

### 3.7. Функциональные гарды и интерсепторы

Вместо классовых — функциональные версии (`CanActivateFn`,
`HttpInterceptorFn`). Это упрощает тестирование и уменьшает
шаблонный код.

### 3.8. Инъекция зависимостей

Внедрение через `inject()` — не через конструктор.

### 3.9. Material — standalone-импорты

Импортируются **отдельные классы** (`MatButton`, `MatFormField`,
`MatInput`), **не модули** (`MatButtonModule`). См. [`material_rules.xml`](../../material_rules.xml).

---

## 4. Структура каталогов

```
src/app/
├── core/ # Синглтоны и общие механизмы
│ ├── api/ # Сгенерированный клиент (NSwag)
│ ├── auth/ # Сервис аутентификации, гарды
│ ├── interceptors/ # HTTP-интерсепторы (JWT, ошибки)
│ ├── store/ # Глобальные SignalStore (Auth, Notifications)
│ ├── services/ # Вспомогательные сервисы
│ └── utils/ # Чистые утилиты (problem-details, form-errors)
├── shared/ # Переиспользуемые компоненты, директивы, пайпы
│ ├── components/
│ ├── directives/
│ └── pipes/
├── features/ # Ленивые фичи (каждая — самостоятельный роут)
│ ├── auth/ # Логин / регистрация
│ ├── dashboard/ # Главная панель
│ ├── products/ # Управление товарами
│ ├── warehouse/ # Склады, зоны, стеллажи, полки, ячейки
│ ├── batches/ # Партии и перемещение
│ ├── receipts/ # Приёмка
│ ├── supply-requests/ # Заявки магазина
│ ├── supply-orders/ # Отгрузки
│ ├── audit/ # Журнал транзакций
│ └── notifications/ # Уведомления
├── app.ts # Корневой компонент
├── app.config.ts # Конфигурация приложения (провайдеры)
└── app.routes.ts # Маршрутизация
```

---

## 5. Модульность и маршрутизация

- Маршруты определяются в `app.routes.ts` с `loadComponent` для
  каждой фичи.
- Все защищённые маршруты обёрнуты в функциональные гарды.
- После входа пользователь перенаправляется на `/dashboard`.
- Для каждой фичи — отдельная папка внутри `features/`.

### 5.1. Гарды

| Гард | Файл | Назначение |
|------|------|------------|
| `authGuard` | `core/auth/auth.guard.ts` | Пропускает только аутентифицированных (по наличию токена). Иначе — редирект на `/login` с сохранением `returnUrl`. |
| `chiefGuard` | `core/auth/chief.guard.ts` | Пропускает только пользователей с ролью `Chief`. Иначе — редирект на `/dashboard`. |

### 5.2. Композиция гардов

Порядок в массиве `canActivate` **важен** — Angular исполняет гарды
слева направо, останавливаясь на первом `false` / `UrlTree`:

```typescript
{
  path: 'register',
  loadComponent: () => import('./features/auth/register/register')
    .then((m) => m.Register),
  canActivate: [authGuard, chiefGuard],
}
```

**Почему такой порядок:**

- `authGuard` первым — если пользователь не аутентифицирован,
  редирект на `/login?returnUrl=/register` (правильное поведение
  для анонима).
- `chiefGuard` вторым — если аутентифицирован, но не Chief,
  редирект на `/dashboard` (не на `/login` — пользователь уже в
  системе, просто без прав).

---

## 6. Управление данными

- **Глобальное состояние** (пользователь, уведомления) — в
  `SignalStore`.
- **Локальное состояние** (фильтры, пагинация, состояние формы) —
  сигналы компонента.
- **Запросы к API** — через `httpResource` / `rxResource` с
  автоматической реактивностью.
- **Мутации** — через методы API-клиента; после успеха вызывается
  `reload()` / `refetch()` зависимого ресурса.

**Signal Forms `submission.action`** принимает два аргумента —
`(field, detail)` — и возвращает `TreeValidationResult`. Это
позволяет раскладывать серверные ошибки валидации по конкретным
полям формы (см. [error-handling.md](./error-handling.md) §6).

---

## 7. Безопасность

### 7.1. Хранение токена

JWT хранится в `localStorage` под ключом `access_token`; данные
пользователя — под `user_data` (`{ email, fullName, roles }`).
Запись/чтение — через `AuthService`. `AuthStore` синхронизирован с
`localStorage` через метод `loadUserFromStorage()`, вызываемый в
конструкторе `App`.

### 7.2. Интерсептор

`jwtInterceptor` добавляет `Authorization: Bearer <token>` ко всем
запросам, **кроме `POST /api/Auth/login`** (единственный публичный
эндпоинт). `/register` защищён ролью Chief — токен для него
обязателен.

`errorInterceptor` при **401 / `UNAUTHORIZED`** выполняет авто-logout:
очищает токен и редиректит на `/login` (пропускает редирект, если
пользователь уже на `/login` — иначе бесконечный цикл при неверном
пароле).

### 7.3. Гарды

- `authGuard` — проверяет наличие токена.
- `chiefGuard` — проверяет роль `Chief` для админских маршрутов.
- Композиция — см. §5.2.

### 7.4. Ролевая модель

Четыре роли: `Chief`, `Manager`, `Worker`, `StoreDirector`.
UI-логика (видимость кнопок) строится на `computed`-селекторах
поверх `authStore.user()?.roles`. Пример — `isChief` в `Dashboard`.

---

## 8. Стилизация

### 8.1. Тема

Глобальная тема Material 22 подключается через **`mat.theme()`** с
M3-палитрами в `styles.scss`:

```scss
@use '@angular/material' as mat;

html {
  @include mat.theme((
    color: (
      primary: mat.$azure-palette,
      tertiary: mat.$blue-palette,
    ),
    typography: Roboto,
    density: 0,
  ));
}
```

Все компоненты автоматически получают токены `--mat-sys-*`.

### 8.2. Design tokens

Кастомные стили пишутся на **design tokens**:

- `--mat-sys-surface`, `--mat-sys-on-surface` — цвета поверхностей.
- `--mat-sys-primary`, `--mat-sys-error` — акценты.
- `--mat-sys-corner-large`, `--mat-sys-level2` — радиусы и тени.
- `--mat-sys-headline-small`, `--mat-sys-body-medium` — типографика.

Хардкод цветов (`#fff`, `rgb(...)`) — **запрещён** (ломает dark
mode).

### 8.3. Правила

- **`::ng-deep` запрещён.** Кастомизация — через `mat.theme-overrides()`
  или scoped-стили компонента.
- **Переопределение `.mat-mdc-*` классов запрещено** — только токены.
- **`ngClass` / `ngStyle` запрещены** — используются `class` и
  `style` bindings.

---

## 9. Обработка ошибок

Все ошибки API — единый формат `WmsProblemDetails` с полями
`code`, `traceId`, `errors`. Обработка построена на трёх уровнях:

1. **HTTP-интерсептор** — глобальные правила (401 → logout, 5xx →
   SnackBar).
2. **SignalStore** — разделение полевых и общих ошибок (полевые
   ошибки в `error()` не попадают, чтобы не дублировать
   `<mat-error>`).
3. **Signal Forms `submission.action`** — раскладка серверных
   `errors` по полям формы через `buildServerFieldErrors`.

Полное описание, справочник `ErrorCodes` и паттерны — в
[error-handling.md](./error-handling.md).

---

## 10. Тестирование

- Основное внимание — бизнес-логике в сторах и сервисах.
- Чистые утилиты (`extractErrorMessage`, `buildServerFieldErrors`)
  тестируются без `TestBed`.
- HTTP-сценарии — через `HttpTestingController`.
- Standalone-компоненты — в `TestBed.configureTestingModule({ imports: [...] })`.

---

## 11. Дополнительные инструменты

- **NSwag** — генерация клиента (`npm run generate-api`).
  Конфиг — `nswag.json` (`typeStyle: "Interface"`).
- **Proxy** — `proxy.conf.json` (порт 5091) для обхода CORS.
- **Angular CLI** — все артефакты создаются через `npx ng generate`.

---

## 12. Заключение

Архитектура обеспечивает чистоту, тестируемость и гибкость.
Ключевые решения:

- **Zoneless + Signals** — предсказуемая реактивность.
- **Standalone + lazy loading** — быстрая загрузка.
- **Signal Forms + `submission.action`** — единый подход к формам
  и валидации.
- **Material 22 + M3-токены** — консистентный UI.
- **Три уровня обработки ошибок** — глобальные правила отделены
  от контекстных.
- **Функциональные гарды с композицией** — гибкая защита
  маршрутов.

**Связанные документы:**
- [Интеграция с бэкендом (API)](./api-integration.md)
- [Управление состоянием](./state-management.md)
- [Обработка ошибок API](./error-handling.md)
