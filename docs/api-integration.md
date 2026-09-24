# Интеграция с бэкендом (API)

---

## 1. Генерация клиента

Для общения с бэкендом используется **NSwag** — инструмент, генерирующий
TypeScript-клиент по OpenAPI-спецификации (файл `swagger.json`).

### 1.1. Команда генерации

```bash
npm run generate-api
```

Конфигурация — в `nswag.json`. Ключевые параметры:

- **`typeStyle: "Interface"`** — DTO генерируются как интерфейсы,
  а не классы. Это позволяет передавать обычные объекты
  (`{ email, password }`) без создания экземпляров.
- **`dateTimeType: "string"`** — даты приходят строками в формате
  ISO 8601. При необходимости парсятся на месте через `new Date()`.
- **`useSingletonProvider: true`** — клиент регистрируется как
  singleton в DI.
- **`enumStyle: "Enum"`** — C#-enum'ы превращаются в TS-enum
  (`ErrorCodes` и другие).

### 1.2. Что генерируется

- **Интерфейсы** для всех DTO (запросы, ответы, `WmsProblemDetails`).
- **TS-enum `ErrorCodes`** — совпадает с бэкендом один-в-один.
- **Класс `Service`** — единый клиент со всеми методами.
  Имя неинтуитивное, но так настроен `className` в `nswag.json`.
- Все методы возвращают `Observable<T>`.

### 1.3. Правила работы с клиентом

- Файл `src/app/core/api/wms-api.ts` **не редактируется вручную** —
  при повторной генерации все правки теряются.
- В компонентах **не инжектится `Service as ApiClient` напрямую**.
  Вместо этого — **сервис-обёртка**, которая инкапсулирует знание
  об URL и параметрах конкретного домена.
- Обёртки бывают двух видов:
  - **`core/`** (`AuthService`) — добавляет бизнес-логику
    (localStorage, парсинг ответа, доменные проверки).
  - **`features/**/xxx.service.ts`** (`ProductService`,
    `WarehouseService` и т. д.) — типобезопасная обёртка над
    сгенерированным клиентом для конкретной фичи. Включает и
    GET-методы, и мутации.
- После обновления `swagger.json` нужно прогнать
  `npm run generate-api`. Если бэкенд добавил новые DTO/enum'ы,
  компилятор TypeScript подскажет места, где их нужно использовать.

---

## 2. HTTP-интерсепторы

Регистрируются в `app.config.ts` через `provideHttpClient(withInterceptors([...]))`.

### 2.1. JWT-интерсептор

Файл: `src/app/core/interceptors/jwt.interceptor.ts`.

- Функциональный (`HttpInterceptorFn`).
- Добавляет заголовок `Authorization: Bearer <token>` ко всем
  запросам.
- **Единственное исключение — `POST /api/Auth/login`** — иначе для логина нужен токен, а токен получается логином.
- Токен читается через `AuthService.getToken()`.
- Если токена нет, запрос уходит без заголовка (защита от
  случайной отправки `Bearer undefined`).

### 2.2. Интерсептор ошибок

Файл: `src/app/core/interceptors/error.interceptor.ts`.

- Функциональный.
- Перехватывает все ответы с 4xx/5xx, парсит `WmsProblemDetails`
  (единый формат ошибок, RFC 7807).
- **401 / `UNAUTHORIZED`** → вызывает `AuthService.logout()` +
  редирект на `/login` (пропускает редирект, если пользователь
  уже на `/login`).
- **5xx и сетевые сбои** → показывает SnackBar через
  `MatSnackBar`.
- **4xx (кроме 401)** → **не показывает** SnackBar; пробрасывает
  ошибку дальше, чтобы форма или стор могли обработать её
  контекстно.

**Полное описание стратегии, справочник `ErrorCodes` и паттерны
раскладки ошибок по полям формы — в [error-handling.md](./error-handling.md).**

---

## 3. Работа с ресурсами (`rxResource`)

Все GET-запросы проходят через сервис-обёртку (`XxxService`) и
**`rxResource`** в компоненте. Это даёт:

- **Автоматическое управление состояниями**: `value`, `error`,
  `isLoading`.
- **Реактивную перезагрузку** при изменении сигналов в `params`.
- **Интеграцию с шаблонами** напрямую через сигналы.

**Пример — список с пагинацией:**

```typescript
protected readonly productsResource = rxResource({
  params: () => ({
    pageNumber: this.pageNumber(),
    pageSize: this.pageSize(),
  }),
  stream: ({ params }) =>
    this.productService.getPaged(params.pageNumber, params.pageSize),
});
```

**Пример — справочник без реактивных параметров:**

```typescript
protected readonly warehousesResource = rxResource({
  stream: () => this.warehouseService.getAll(),
});
```

`rxResource` возвращает объект с полями `value()`, `error()`,
`isLoading()` и методом `reload()`. Никаких ручных подписок и
`subscribe` — всё реактивно.

### 3.1. Почему `rxResource`, а не `httpResource`

`httpResource` **тоже реактивен**, но принимает **URL строкой**:

```typescript
// ❌ Не для нашего проекта
httpResource<ProductDtoPagedResult>(() => ({
  url: '/api/Product/paged',
  params: { PageNumber: this.pageNumber() },
}));
```

Это **дублирует знание об API**: URL и query-параметры (в PascalCase)
живут и в `wms-api.ts`, и в компоненте. Теряется компайл-тайм проверка
параметров, а при регенерации клиента легко забыть синхронизировать.

**Правило:** `httpResource` допустим только для запросов **вне
OpenAPI-спецификации** (статические ассеты `/assets/...`, сторонние
REST API, конфиги). Для всех эндпоинтов из `wms-api.ts` — `rxResource`
через сервис-обёртку.

### 3.2. Актуальная сигнатура `rxResource`

В Angular 20+ сигнатура изменилась (было `request`/`loader`):

| Параметр | Назначение |
|----------|-----------|
| `params` | Функция, возвращающая объект-параметры. Реактивна — при изменении сигналов внутри `stream` перезапускается. Опционален. |
| `stream` | Функция `({ params }) => Observable<T>`. Возвращает Observable с данными. |

Без `params` `rxResource` запускается один раз и не следит за
сигналами.

---

## 4. Мутации (POST, PUT, DELETE)

Для операций изменения данных вызываются методы сервиса-обёртки
через `firstValueFrom` (Observable → Promise) внутри
`submission.action` Signal Forms:

```typescript
submission: {
  action: async (field, detail) => {
    this.error.set(null);
    const value = field().value();
    const p = this.product();

    try {
      if (p?.id != null) {
        await firstValueFrom(this.productService.update(p.id, value));
      } else {
        await firstValueFrom(this.productService.create(value));
      }

      this.saved.emit();
      this.dialogRef.close();
      return undefined;
    } catch (raw: unknown) {
      const problem = toWmsProblemDetails(raw);
      if (!hasFieldErrors(problem)) {
        this.error.set(extractErrorMessage(raw, 'Ошибка сохранения'));
      }
      if (problem) {
        return buildServerFieldErrors(
          problem,
          PRODUCT_FIELD_MAP,
          (name) => detail.root[name],
        );
      }
      return undefined;
    }
  },
},
```

**После успешной мутации**:

- **Обновить список** — вызвать `reload()` у зависимого `rxResource`.
- **Закрыть диалог** — `dialogRef.close()` и (опционально)
  эмитировать `saved` для родителя.

**Почему `firstValueFrom`.** Signal Forms `submission.action` —
`async`-функция. Внутри неё `await` работает с Promise, а сервис
возвращает `Observable`. `firstValueFrom` — идиоматичный мост (см.
`state-management.md` §6.2).

---

## 5. Типизация ответов и запросов

Все DTO экспортируются из `wms-api.ts` (интерфейсы — см. §1.1).
Используйте их для типизации переменных и аргументов.

- **Производные типы** (например, объединение нескольких DTO для
  отображения) — создавайте локально через `interface` в
  соответствующем фичевом модуле.
- **Не дублируйте** DTO вручную: если данных не хватает, лучше
  расширить бэкенд-схему.
- **Enum `ErrorCodes`** используйте из сгенерированного клиента,
  не заводите свой — иначе потеряете синхронизацию с бэком.

### 5.1. Модели форм

Signal Forms требует, чтобы модель формы содержала **обязательные
поля** — иначе `required(schema.name)` и `detail.root[name]` не
проходят по типам.

**Правило вывода модели из DTO:**

```typescript
// Все поля DTO — примитивы без FK:
type ProductFormModel = Required<CreateProductRequest>;
```

`Required<T>` убирает `?` и `| undefined` со всех свойств.

**Если есть FK-поле** (в форме — `MatSelect`, до выбора пользователя
значение `null`):

```typescript
type ZoneFormModel = Omit<Required<CreateZoneRequest>, 'warehouseId'> & {
  warehouseId: number | null;
};
```

`Omit` убирает поле из `Required<T>`, а `&` добавляет его обратно
с типом `number | null`. В `submission.action` значение сужается
проверкой:

```typescript
if (value.warehouseId == null) {
  return undefined;
}
const payload: CreateZoneRequest = {
  name: value.name,
  type: value.type,
  warehouseId: value.warehouseId,  // теперь number, не number | null
};
```

### 5.2. Чего не делать

- **Не дублировать DTO** вручную через `interface` — если полей не
  хватает, расширяйте бэкенд-схему.
- **Не использовать `Partial<T>`** — Signal Forms не примет
  опциональные поля.
- **Не строить `payload` явно**, если модель структурно совпадает
  с DTO — присваивание пройдёт автоматически. `payload` нужен только
  для сужения `null → number` (случай с FK).

---

## 6. Прокси для разработки

Для локальной разработки настроен прокси-сервер `proxy.conf.json`,
который перенаправляет запросы на бэкенд и обходит CORS.

```json
{
  "/api": {
    "target": "http://localhost:5091",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
```

- **HTTP** (`5091`) используется для прокси, чтобы не возиться с
  dev-сертификатами. HTTPS-профиль бэкенда слушает на `7275`.
- `secure: false` отключает проверку SSL для локальной разработки.
- `changeOrigin: true` подменяет `Origin`, что позволяет ASP.NET
  Core не отклонять запрос по CORS.

Запуск с прокси происходит автоматически через `ng serve` — конфиг
прописан в `angular.json` в секции `serve.options.proxyConfig`.

---

## 7. Обработка ошибок

Все ошибки API приходят в едином формате `WmsProblemDetails`
(RFC 7807) с полями `code`, `traceId`, `errors`. На фронте они
обрабатываются на трёх уровнях: HTTP-интерсептор (глобальные
правила), SignalStore (разделение полевых и общих ошибок),
Signal Forms `submission.action` (раскладка по полям).

**Подробности, справочник кодов и паттерны — в
[error-handling.md](./error-handling.md).**

---

## 8. Планы по улучшению

- **Кеширование ответов** для редко изменяемых данных (справочники)
  через `transferCache` или локальный кеш.
- **WebSocket** для получения уведомлений в реальном времени
  (сейчас — polling через `httpResource`).
- **Retry logic** для идемпотентных GET-запросов при сетевых
  сбоях.
- **Sentry** — проброс `traceId` в отчёты об ошибках.

---

## 9. Заключение

Интеграция построена на генерации клиента по OpenAPI: единый источник
типов и кодов ошибок — `swagger.json`. Обёртки в `core/` добавляют
бизнес-логику (localStorage, парсинг, доменные проверки). Функциональные
интерсепторы решают глобальные задачи (JWT, авто-logout, SnackBar для
5xx), а `httpResource` / Signal Forms — контекстные (загрузка списков,
раскладка серверных ошибок по полям).

**Связанные документы:**
- [Архитектура фронтенда](./architecture.md)
- [Управление состоянием](./state-management.md)
- [Обработка ошибок API](./error-handling.md)
