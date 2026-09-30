# Обработка ошибок API

Единая точка входа по теме ошибок на фронтенде WMS. Здесь собрано всё,
что нужно фронтендеру: формат ответа, справочник кодов, стратегия по
уровням, паттерны Signal Forms и антипаттерны.

**Связанные документы:**
- [Интеграция с бэкендом (API)](./api-integration.md) — интерсепторы,
  генерация NSwag-клиента
- [Управление состоянием](./state-management.md) — AuthStore, `error`
- [Архитектура фронтенда](./architecture.md) — общая структура

---

## 1. Общая модель

Все ответы с ошибками (4xx, 5xx) приходят с `Content-Type: application/json`
и **единым форматом** — `WmsProblemDetails` (расширение RFC 7807).
TypeScript-интерфейс генерируется NSwag в `src/app/core/api/wms-api.ts`,
править вручную не нужно.

Такой подход даёт:

- **Обработку по коду** (`ErrorCodes`), а не по тексту сообщения —
  устойчиво к изменениям формулировок и локализации.
- **Раскладку серверных ошибок валидации по полям формы** через
  стандартный механизм Signal Forms.
- **Авто-logout** при истёкшем токене (401).
- **Корреляцию с логами** бэкенда через `traceId`.

---

## 2. Формат `WmsProblemDetails`

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `type` | `string` | да | Имя C#-класса исключения (например, `BusinessRuleException`). Полезно для отладки, не для логики UI. |
| `title` | `string` | да | Краткое сообщение об ошибке на русском. **Показывать пользователю.** |
| `status` | `number` | да | HTTP-статус. |
| `instance` | `string` | да | Путь запроса (`/api/Product`). |
| `detail` | `string` | нет | Детали (только в dev-окружении для 500). |
| `code` | `ErrorCodes` | да | Машиночитаемый код ошибки. Ветвление логики UI — по нему. |
| `traceId` | `string` | да | Идентификатор запроса. Для корреляции с логами сервера. |
| `errors` | `Record<string, string[]>` | нет | Ошибки валидации по полям. Только для `VALIDATION_FAILED`. |

### 2.1. Примеры ответов

**Ошибка валидации (400)** — с полями:

```json
{
  "type": "ModelValidationException",
  "title": "Некорректный запрос.",
  "status": 400,
  "instance": "/api/Product",
  "code": "VALIDATION_FAILED",
  "traceId": "0HLO1K7ABCDEF:00000001",
  "errors": {
    "Name": ["'Название' не должно быть пустым."],
    "MinStockThreshold": ["Порог не может быть отрицательным."]
  }
}
```

**Бизнес-ошибка (400)** — без `errors`:

```json
{
  "type": "BusinessRuleException",
  "title": "Целевая ячейка уже занята.",
  "status": 400,
  "instance": "/api/Batch/1/move",
  "code": "TARGET_CELL_OCCUPIED",
  "traceId": "0HLO1K8ABCDEF:00000002"
}
```

**Ошибка авторизации (401)**:

```json
{
  "type": "UnauthorizedException",
  "title": "Неверный email или пароль.",
  "status": 401,
  "instance": "/api/auth/login",
  "code": "UNAUTHORIZED",
  "traceId": "0HLO1K9ABCDEF:00000003"
}
```

**Не найдено (404)**:

```json
{
  "type": "NotFoundException",
  "title": "Партия с идентификатором 999 не найдена.",
  "status": 404,
  "instance": "/api/Batch/999",
  "code": "NOT_FOUND",
  "traceId": "0HLO1KAABCDEF:00000004"
}
```

**Ошибка сервера (500)** — в dev может быть `detail`:

```json
{
  "type": "Exception",
  "title": "Внутренняя ошибка сервера.",
  "status": 500,
  "instance": "/api/Product",
  "code": "INTERNAL_ERROR",
  "traceId": "0HLO1KBABCDEF:00000005",
  "detail": "Duplicate key value violates unique constraint..."
}
```

**Ошибка Identity при регистрации (400)**:

```json
{
  "type": "ModelValidationException",
  "title": "Не удалось создать пользователя.",
  "status": 400,
  "instance": "/api/auth/register",
  "code": "VALIDATION_FAILED",
  "traceId": "0HLO1KCABCDEF:00000006",
  "errors": {
    "PasswordTooShort": ["Пароль должен содержать минимум 6 символов."],
    "PasswordRequiresDigit": ["Пароль должен содержать хотя бы одну цифру ('0'-'9')."]
  }
}
```

> **Важно:** ключи в `errors` — это **C#-имена свойств DTO**
> (`Email`, `Password`, `FullName`, `Name`, `MinStockThreshold` и т.д.),
> а не имена полей формы. Маппинг — на стороне фронта, см. §6.

---

## 3. Справочник `ErrorCodes`

Бэкенд определяет коды как C#-enum `Wms.Core.Constants.ErrorCodes`.
NSwag генерирует соответствующий **TS-enum** `ErrorCodes` в `wms-api.ts`.
Компилятор ловит опечатки; при добавлении новых кодов достаточно
выполнить `npm run generate-api`.

Ниже — **полный справочник** с рекомендованными реакциями фронта.
Ветвление в коде — по коду, не по тексту.

| Код | HTTP | Что означает | Рекомендуемая реакция фронта |
|-----|:----:|--------------|------------------------------|
| `UNAUTHORIZED` | 401 | Неверные учётные данные, отсутствует токен. | **Авто-logout** + редирект на `/login` (интерсептор). |
| `FORBIDDEN` | 403 | Недостаточно прав для операции. | SnackBar «Недостаточно прав». Идеально — заранее скрывать кнопку по роли. |
| `NOT_FOUND` | 404 | Запрошенный ресурс не существует. | SnackBar или inline-сообщение по контексту. |
| `VALIDATION_FAILED` | 400 | Ошибки валидации входных данных (FluentValidation, ModelState, Identity). | Разложить `errors` по полям формы (см. §6). Баннер сверху не показывать. |
| `CELL_OCCUPIED` | 400 | Ячейка уже занята другой партией. | Подсветить ячейку в UI или SnackBar `problem.title`. |
| `TARGET_CELL_OCCUPIED` | 400 | Целевая ячейка занята при перемещении. | То же, что `CELL_OCCUPIED`. |
| `RECEIPT_ALREADY_PROCESSED` | 400 | Приёмка уже подтверждена или отклонена. | Обновить страницу приёмки, SnackBar. |
| `ORDER_NOT_DRAFT` | 400 | Подтверждение заказа, не находящегося в статусе Draft. | Обновить состояние заказа, SnackBar. |
| `ORDER_NOT_CONFIRMED` | 400 | Отгрузка заказа, не находящегося в статусе Confirmed. | Обновить состояние заказа, SnackBar. |
| `ORDER_HAS_NO_RESERVATIONS` | 400 | Отгрузка заказа без резервов. | SnackBar «Нет резервов для отгрузки». |
| `NOT_ENOUGH_STOCK` | 400 | Недостаточно остатков для подтверждения заказа. | SnackBar + подсветка дефицитных позиций. |
| `REQUEST_NOT_DRAFT` | 400 | Отправка заявки не из Draft. | Обновить статус, SnackBar. |
| `REQUEST_NOT_SUBMITTED` | 400 | Одобрение заявки не из Submitted. | Обновить статус, SnackBar. |
| `REQUEST_NOT_REJECTABLE` | 400 | Отклонение заявки в неподходящем статусе. | Обновить статус, SnackBar. |
| `ROLE_NOT_FOUND` | 400 | Указана несуществующая роль. | Подсветить поле `role` в форме. |
| `INVALID_STATUS` | 400 | Недопустимое значение статуса в query-параметре. | Техническая ошибка — SnackBar + логирование. |
| `INVALID_TRANSACTION_TYPE` | 400 | Недопустимое значение типа транзакции. | Техническая ошибка — SnackBar + логирование. |
| `BUSINESS_RULE_VIOLATION` | 400 | Общее нарушение бизнес-правила (fallback). | SnackBar с `problem.title`. |
| `INTERNAL_ERROR` | 500 | Непредвиденная ошибка сервера. | SnackBar «Внутренняя ошибка сервера». `traceId` — в консоль. |
| `CANNOT_DELETE_REFERENCED` | 400 | Удаление объекта, на который ссылаются связанные записи (FK RESTRICT). | SnackBar `problem.title` из локального `catch` операции удаления. Идеально — заранее прятать кнопку по флагу «есть зависимости» в DTO. |

### Точечная обработка 4xx в операциях без формы

Не все 4xx-ошибки могут быть обработаны формой или стором.
**Операции удаления из списка** (и любые мутации без `submission.action`)
имеют только два участника: HTTP-интерсептор (глобально) и локальный
`catch`. Интерсептор 4xx намеренно пропускает — значит, локальный
`catch` **обязан** показать сообщение.

Единый способ — утилита `showMutationError(snackBar, raw, fallback)`
в `core/utils/mutation-errors.ts`. Параметры SnackBar синхронизированы
с `errorInterceptor` — единый визуальный стиль.

**Правило:** пустой `catch { }` в операции удаления — антипаттерн.
Если ошибку не обрабатывает форма и не обрабатывает стор, это
ответственность вызывающего кода.

---

## 4. Стратегия по уровням

Ошибки обрабатываются на **трёх уровнях** — от общего к частному.
Уровни не дублируют друг друга: каждый берёт на себя свою категорию.

### Уровень 1 — HTTP-интерсептор

Файл: `src/app/core/interceptors/error.interceptor.ts`.

Обязанности:

- **401 / `UNAUTHORIZED`** → очистка токена + редирект на `/login`.
- **5xx и сетевые сбои** (`status === 0`) → SnackBar.
- **4xx (кроме 401)** → **не показывает SnackBar** — иначе
  будет дублировать сообщения формы и баннера.

Интерсептор не знает про специфику конкретных экранов — только
глобальные правила. Он **пробрасывает ошибку дальше** (`throwError`),
чтобы её мог обработать стор или форма.

### Уровень 2 — SignalStore

Файлы: `src/app/core/store/*.store.ts`.

Обязанности:

- Решить, **есть ли у ошибки полевые данные** (`problem.errors`).
- Если есть → **не заполнять** общий `error` (иначе баннер
  продублирует `<mat-error>`), но **вернуть problem** вызывающему
  компоненту.
- Если нет → заполнить `error` через `extractErrorMessage`, вернуть
  `problem` для дополнительной логики.

Так стор становится единым местом, где принимается решение о UX.

### Уровень 3 — Signal Forms `submission.action`

Файлы: `features/**/*.ts`.

Обязанности:

- Разложить `problem.errors` по полям формы через утилиту
  `buildServerFieldErrors` (см. §6).
- Вернуть `undefined` при успехе; массив `ValidationError` при
  серверных ошибках валидации.

`FormRoot` сам подсветит поля и очистит ошибки при редактировании.

### 4.1. Как это выглядит в связке

```
Запрос → 400 VALIDATION_FAILED (errors: { Email: [...] })
   ↓
Интерсептор: 4xx → не показывает SnackBar, пробрасывает дальше
   ↓
Store: видит errors → error() = null, возвращает problem
   ↓
Форма submission.action: раскладывает по полю email → <mat-error>
   ↓
Пользователь видит подсветку под полем email, без баннера сверху
```

```
Запрос → 401 UNAUTHORIZED
   ↓
Интерсептор: 401 → logout + redirect, пробрасывает дальше
   ↓
Store: ловит ошибку, но пользователь уже редиректится
```

```
Запрос → 500 INTERNAL_ERROR
   ↓
Интерсептор: 5xx → SnackBar
   ↓
Store: error() = problem.title → баннер в форме (если форма открыта)
```

---

## 5. Обработка по типам ошибок

### 5.1. Ошибки аутентификации (401)

Обрабатываются **только** интерсептором. Никогда не пишите логику
401 в компонентах.

- Токен очищается через `AuthService.logout()`.
- Если пользователь не на `/login` — редирект на `/login`.
- Если он **уже** на `/login` — редиректа нет (иначе цикл при
  повторной отправке формы с неверным паролем; в этом случае
  `UNAUTHORIZED` с логина приходит как обычная ошибка формы).

### 5.2. Ошибки валидации (400 `VALIDATION_FAILED`)

- Разложить по полям формы (см. §6).
- Баннер сверху **не показывать** — иначе двойное уведомление.

> ⚠️ **Известное ограничение (в плане).** Если сервер вернул `errors`
> с ключами, не сматчившимися ни с одним полем формы (например,
> добавили новое поле на бэке), `buildServerFieldErrors` вернёт
> `undefined`, а баннер мы не покажем — ошибка «потеряется».
>
> **Временное решение** (пока не реализовано): в `submission.action`
> добавить проверку:
>
> ```typescript
> if (problem) {
>   const fieldErrors = buildServerFieldErrors(
>     problem,
>     PRODUCT_FIELD_MAP,
>     (name) => detail.root[name],
>   );
>   if (!fieldErrors && !hasFieldErrors(problem)) {
>     this.error.set(problem.title ?? 'Ошибка валидации');
>   }
>   return fieldErrors;
> }
> ```

### 5.3. Бизнес-ошибки (400 без `errors`)

- Показать `problem.title` через SnackBar или баннер — в зависимости
  от контекста.
- Для известных кодов (`NOT_ENOUGH_STOCK`, `CELL_OCCUPIED`) —
  добавить контекстное поведение (подсветка ячейки, дефицит по позициям).
- Не разбирать текст — только `code`.

### 5.4. Ошибки доступа (403 `FORBIDDEN`)

- SnackBar «Недостаточно прав».
- Идеально — **не доводить** до 403: скрывать кнопки и роуты по
  ролям заранее (см. `chiefGuard`, ролевые условия в шаблонах).
- 403 — сигнал, что UI-логика где-то не учла роль.

### 5.5. Серверные ошибки (5xx) и сетевые сбои

- SnackBar с общим сообщением.
- `traceId` — в консоль (в prod) для поддержки.
- Форма получает `undefined` от `action` → никаких полевых
  ошибок; пользователь видит только SnackBar.

### 5.6. Таймауты

`HttpErrorResponse` со `status === 0` — это сетевой сбой или таймаут.
Интерсептор обрабатывает так же, как 5xx.

---

## 6. Раскладка серверных `errors` по полям формы

Бэкенд возвращает `errors` с ключами **PascalCase** (C#-имена DTO).
Поля формы — **camelCase** (TS-модель). Утилита `buildServerFieldErrors`
маппит и формирует массив `ValidationError[]`, который понимает
`submission.action` Signal Forms.

### 6.1. Утилиты (файл `src/app/core/utils/`)

**`form-errors.ts`** экспортирует:

- `ServerValidationError` — алиас `ValidationError.WithOptionalFieldTree`.
- `ServerFieldTree` — алиас `NonNullable<ServerValidationError['fieldTree']>`.
- `buildServerFieldErrors<K extends string>(problem, serverToFormField, resolveFieldTree)`.

**`problem-details.ts`** экспортирует:

- `isWmsProblemDetails(value)` — type guard.
- `toWmsProblemDetails(error)` — нормализация любой ошибки.
- `extractErrorMessage(error, fallback)` — человекочитаемое сообщение.
- `extractErrorCode(error)` — `ErrorCodes | undefined`.
- `hasFieldErrors(problem)` — есть ли полевые ошибки.

`hasFieldErrors` используется как в сторах (`AuthStore`), так и в
диалогах форм — единая точка правды.

### 6.2. Использование в компоненте

```typescript
import { buildServerFieldErrors } from '../../../core/utils/form-errors';

const LOGIN_FIELD_MAP = {
  Email: 'email',
  Password: 'password',
} as const;

protected readonly loginForm = form(
  this.model,
  (schema) => {
    required(schema.email, { message: 'Email обязателен' });
    required(schema.password, { message: 'Пароль обязателен' });
  },
  {
    submission: {
      action: async (field, detail) => {
        const { email, password } = field().value();
        const problem = await this.authStore.login(email, password);

        return buildServerFieldErrors(
          problem,
          LOGIN_FIELD_MAP,
          (name) => detail.root[name],
        );
      },
    },
  },
);
```

### 6.3. Шаблон

`<mat-error>` сам покажет добавленную ошибку. Дополнительной логики
в шаблоне не нужно:

```html
<mat-form-field appearance="outline">
  <mat-label>Email</mat-label>
  <input matInput type="email" [formField]="loginForm.email" />
  @if (loginForm.email().touched() && loginForm.email().invalid()) {
    <mat-error>{{ loginForm.email().errors()[0]?.message }}</mat-error>
  }
</mat-form-field>
```

### 6.4. Правило дублирования

**Если у `problem` есть поле `errors`** — считайте, что полевые
ошибки разложены по форме. **Общий баннер `error()` не показываем.**

Реализуется через `hasFieldErrors` из
`src/app/core/utils/problem-details.ts`:

```typescript
if (!hasFieldErrors(problem)) {
  this.error.set(extractErrorMessage(raw, 'Ошибка сохранения'));
}
```

Это устраняет двойное уведомление: пользователь видит `<mat-error>`
под полем, а баннер сверху не показывается.

### 6.5. Маппинг для новой формы

При добавлении новой формы:

1. Создайте константу `XXX_FIELD_MAP` — соответствие C#-имён и
   полей формы.
2. Передайте её в `buildServerFieldErrors` в `submission.action`.
3. Если на бэке появятся новые поля в `errors`, а в маппинге их
   не будет — они не потеряются: сработает фоллбэк через баннер
   (см. §5.2).

---

## 7. Логирование и `traceId`

Каждый ответ об ошибке содержит `traceId` — идентификатор запроса,
связанный с записью в логах бэкенда (Serilog). Полезен для поддержки:

- Пользователь сообщает об ошибке → по `traceId` находим полный
  контекст на сервере.
- В **dev** можно показывать `traceId` в SnackBar или выводить
  в консоль.
- В **prod** — обычно скрыт от пользователя, но сохраняется в
  логах фронта (когда появится интеграция с Sentry).

Сейчас интерсептор пишет `traceId` в консоль. В будущем —
проброс в Sentry и отображение в диалоге «Сообщить о проблеме».

---

## 8. Антипаттерны

| ❌ Нельзя | ✅ Как правильно |
|----------|-----------------|
| Ветвить логику по `problem.title` | Ветвить по `problem.code` (`ErrorCodes`) |
| Показывать SnackBar на каждый 4xx | 4xx — форме/стору; 5xx и сеть — SnackBar |
| Дублировать полевые ошибки баннером сверху | В `error()` писать `null`, если есть `errors` |
| Обрабатывать 401 в компоненте или сторе | 401 — только в интерсепторе (авто-logout) |
| Писать свой `alert()` / `console.error()` для UX | `MatSnackBar` / `<mat-error>` / баннер |
| Хардкодить текст серверной ошибки на фронте | Показывать `problem.title` — источник правды на бэке |
| Забывать `throwError` в интерсепторе | Всегда пробрасывать, чтобы стор и форма получили ошибку |
| Разбирать `errors` вручную в каждом компоненте | Использовать `buildServerFieldErrors` |

---

## 9. Чек-лист для новой формы

- [ ] Создан `XXX_FIELD_MAP` — C#-имена → camelCase полей формы.
- [ ] Модель формы выведена из DTO: `Required<CreateXxxRequest>` или
  `Omit<Required<CreateXxxRequest>, 'fk'> & { fk: number | null }`.
- [ ] В `submission.action` вызван `buildServerFieldErrors`.
- [ ] Есть `<mat-error>` под каждым полем, которое может прийти
  с сервера.
- [ ] **На полях с `[formField]` нет HTML-валидации** — `required`,
  `min`, `max`, `step`, `pattern`, `minlength`, `maxlength` **запрещены**
  Angular. Вся валидация — в схеме `form(...)`.
- [ ] Баннер `error()` показывается только для не-полевых ошибок.
- [ ] SnackBar для этого эндпоинта не появится (4xx фильтруется
  интерсептором).

---

## 10. Планы по улучшению

- **Sentry**: проброс `traceId` в отчёты об ошибках.
- **Retry logic**: для идемпотентных GET-запросов.
- **Центральный сервис `errorHandler`**: единая точка «код → реакция
  UI» вместо `switch` в каждом компоненте.
- **Кастомные `ValidationError.kind`**: группировка ошибок по
  происхождению (`server`, `businessRule`, `network`) для разной
  стилизации.

---

## 11. Резюме

- Все ошибки API — единый формат `WmsProblemDetails`, TS-интерфейс
  генерируется NSwag.
- Логика UI ветвится по `ErrorCodes`, не по тексту.
- Три уровня обработки: **интерсептор → стор → форма**.
- Серверные ошибки валидации — **под полями формы** через
  `buildServerFieldErrors`, без дублирования баннером.
- 401 — **только интерсептор**; 4xx — форме/стору; 5xx и сеть —
  SnackBar.
- `traceId` — для корреляции с логами бэкенда.

**Связанные документы:**
- [Интеграция с бэкендом (API)](./api-integration.md)
- [Управление состоянием](./state-management.md)
- [Архитектура фронтенда](./architecture.md)
