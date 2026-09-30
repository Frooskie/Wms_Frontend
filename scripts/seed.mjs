#!/usr/bin/env node
/**
 * Seed WMS: заполнение dev-БД реалистичными данными.
 *
 * Запуск:  node scripts/seed.mjs
 *          npm run seed
 *
 * Требует: бэкенд WMS запущен на BASE_URL (по умолчанию http://localhost:5091)
 *          Chief-пользователь создан DbInitializer (chief@wms.com / Chief@123)
 *
 *  Скрипт НЕ идемпотентен. Перед повторным запуском сбросьте БД:
 *     dotnet ef database drop
 *     dotnet ef database update
 */

// ============================================================
// CONFIG
// ============================================================

const BASE_URL = process.env.WMS_API_URL ?? 'http://localhost:5091';
const CHIEF_EMAIL = 'chief@wms.com';
const CHIEF_PASSWORD = 'Chief@123';
const PRNG_SEED = 42;

const CONFIG = {
  warehouses: 2,
  zonesPerWarehouse: 4,
  racksPerZone: 3,
  shelvesPerRack: 4,
  cellsPerShelf: 3,
  products: 240,
  batches: 100,
  expiryDistribution: {
    soonExpiring: 30, // +1..+7 дней (для теста «истекает скоро»)
    future: 70,       // +30..+730 дней
  },
  logEvery: 10,
};

// ============================================================
// PRNG (mulberry32) — детерминированный
// ============================================================

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(PRNG_SEED);
const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ============================================================
// Даты
// ============================================================

const DAY_MS = 24 * 60 * 60 * 1000;

const today = new Date();
today.setUTCHours(0, 0, 0, 0);

const daysFromToday = (days) => new Date(today.getTime() + days * DAY_MS);
const isoDate = (d) => d.toISOString();

// ============================================================
// API client
// ============================================================

class ApiError extends Error {
  constructor(method, path, status, body) {
    super(`${method} ${path} → HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new ApiError(method, path, res.status, text);
  }

  return text ? JSON.parse(text) : null;
}

// ============================================================
// Данные
// ============================================================

const PRODUCT_CATEGORIES = [
  {
    name: 'Молочные',
    unit: 'шт',
    bases: [
      'Молоко 3,2%', 'Молоко 2,5%', 'Кефир 1%', 'Ряженка 4%', 'Сметана 20%',
      'Творог 5%', 'Йогурт натуральный', 'Масло сливочное 82,5%',
      'Сыр Российский', 'Сыр Гауда',
    ],
    brands: ['Простоквашино', 'Домик в деревне', 'Вкуснотеево', 'Брест-Литовск'],
  },
  {
    name: 'Хлебобулочные',
    unit: 'шт',
    bases: [
      'Хлеб Бородинский', 'Хлеб Белый', 'Хлеб Ржаной', 'Батон Нарезной',
      'Лаваш', 'Пита', 'Круассан', 'Булочка с маком', 'Пирог с яблоками',
      'Кекс столичный',
    ],
    brands: ['Хлебный дом', 'Каравай', 'БКХ', 'Рижский хлеб'],
  },
  {
    name: 'Мясные',
    unit: 'кг',
    bases: [
      'Куриное филе', 'Куриные бёдра', 'Свинина шея', 'Свинина лопатка',
      'Говядина вырезка', 'Говядина лопатка', 'Фарш свино-говяжий',
      'Колбаса докторская', 'Сосиски молочные', 'Бекон',
    ],
    brands: ['Мираторг', 'Черкизово', 'Останкино', 'Ремит'],
  },
  {
    name: 'Бакалея',
    unit: 'кг',
    bases: [
      'Рис длиннозёрный', 'Рис круглозёрный', 'Гречка', 'Пшено',
      'Макароны спагетти', 'Макароны пенне', 'Мука пшеничная',
      'Сахар', 'Соль', 'Масло растительное',
    ],
    brands: ['Макфа', 'Увелка', 'Мистраль', 'Красная цена'],
  },
  {
    name: 'Консервы',
    unit: 'шт',
    bases: [
      'Горошек зелёный', 'Кукуруза', 'Фасоль', 'Томаты в собственном соку',
      'Огурцы', 'Шпроты', 'Сайра', 'Тунец', 'Сгущённое молоко', 'Паштет',
    ],
    brands: ['Бондюэль', 'Дядя Ваня', 'Главпродукт', 'Магнолия'],
  },
  {
    name: 'Напитки',
    unit: 'л',
    bases: [
      'Вода минеральная', 'Вода питьевая', 'Сок яблочный', 'Сок апельсиновый',
      'Кола', 'Лимонад', 'Чай чёрный', 'Чай зелёный', 'Кофе молотый',
      'Кофе в зёрнах',
    ],
    brands: ['Боржоми', 'Сады Придонья', 'Rich', 'J7'],
  },
];

const MANUFACTURERS = [
  'ООО «ПродТорг»', 'ООО «АгроПром»', 'АО «ТоргСнаб»',
  'ООО «ФудЛогистик»', 'ЗАО «ОптТорг»', 'ООО «Мясокомбинат № 1»',
  'ООО «Хлебозавод № 5»', 'АО «Молпром»',
];

const SUPPLIERS = [
  'ООО «ОптПоставка»', 'АО «РегионТорг»', 'ООО «ЮгСнаб»',
  'ЗАО «СеверТрейд»', 'ООО «ЦентрОпт»',
];

function* productGenerator() {
  for (const cat of PRODUCT_CATEGORIES) {
    for (const base of cat.bases) {
      for (const brand of cat.brands) {
        yield {
          name: `${base} (${brand})`,
          manufacturer: pick(MANUFACTURERS),
          supplier: pick(SUPPLIERS),
          category: cat.name,
          unit: cat.unit,
          minStockThreshold: randInt(10, 100),
        };
      }
    }
  }
}

// ============================================================
// Прогресс
// ============================================================

function progress(label, current, total) {
  if (current % CONFIG.logEvery === 0 || current === total) {
    console.log(`  ${label}: ${current} / ${total}`);
  }
}

function heading(step, title) {
  console.log(`\n[${step}] ${title}`);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log(`WMS Seed → ${BASE_URL}`);
  console.log(`PRNG seed: ${PRNG_SEED}`);
  console.log('⚠️  Скрипт не идемпотентен. Убедись, что БД чистая.\n');

  // 1. Login
  heading('1/8', 'Логин Chief');
  const auth = await request('POST', '/api/Auth/login', {
    email: CHIEF_EMAIL,
    password: CHIEF_PASSWORD,
  });
  const token = auth.token;
  console.log(`  ✓ ${auth.email} (${auth.roles?.join(', ')})`);

  // 2. Warehouses
  heading('2/8', `Склады (${CONFIG.warehouses})`);
  const warehouseMeta = [
    { name: 'Главный склад (Москва)', address: 'г. Москва, ул. Складская, 1' },
    { name: 'Северный склад (СПб)', address: 'г. Санкт-Петербург, пр. Логистов, 42' },
  ];
  const warehouses = [];
  for (let i = 0; i < CONFIG.warehouses; i++) {
    const meta = warehouseMeta[i] ?? { name: `Склад № ${i + 1}`, address: '' };
    const w = await request('POST', '/api/Warehouse', {
      name: meta.name,
      address: meta.address,
      contactPhone: `+7 (495) 111-22-${String(i + 1).padStart(2, '0')}`,
    }, token);
    warehouses.push(w);
    progress('Склады', i + 1, CONFIG.warehouses);
  }

  // 3. Zones (4 на склад: Normal, Fridge, Freezer, Normal-дубль)
  heading('3/8', `Зоны (${CONFIG.warehouses * CONFIG.zonesPerWarehouse})`);
  const zonePlan = ['Normal', 'Fridge', 'Freezer', 'Normal'];
  const zones = [];
  const zoneTotal = CONFIG.warehouses * CONFIG.zonesPerWarehouse;
  for (const w of warehouses) {
    for (let i = 0; i < CONFIG.zonesPerWarehouse; i++) {
      const type = zonePlan[i] ?? 'Normal';
      const z = await request('POST', '/api/Zone', {
        name: `${type}-${i + 1}`,
        type,
        warehouseId: w.id,
      }, token);
      zones.push(z);
      progress('Зоны', zones.length, zoneTotal);
    }
  }

  // 4. Racks
  heading('4/8', `Стеллажи (${zones.length * CONFIG.racksPerZone})`);
  const rackCodes = ['A', 'B', 'C'];
  const racks = [];
  const rackTotal = zones.length * CONFIG.racksPerZone;
  for (const zone of zones) {
    for (let i = 0; i < CONFIG.racksPerZone; i++) {
      const r = await request('POST', '/api/Rack', {
        code: rackCodes[i] ?? String.fromCharCode(65 + i),
        zoneId: zone.id,
      }, token);
      racks.push(r);
      progress('Стеллажи', racks.length, rackTotal);
    }
  }

  // 5. Shelves
  heading('5/8', `Полки (${racks.length * CONFIG.shelvesPerRack})`);
  const shelves = [];
  const shelfTotal = racks.length * CONFIG.shelvesPerRack;
  for (const rack of racks) {
    for (let n = 1; n <= CONFIG.shelvesPerRack; n++) {
      const s = await request('POST', '/api/Shelf', {
        number: n,
        rackId: rack.id,
      }, token);
      shelves.push(s);
      progress('Полки', shelves.length, shelfTotal);
    }
  }

  // 6. Cells
  heading('6/8', `Ячейки (${shelves.length * CONFIG.cellsPerShelf})`);
  const rackById = new Map(racks.map((r) => [r.id, r]));
  const cells = [];
  const cellTotal = shelves.length * CONFIG.cellsPerShelf;
  for (const shelf of shelves) {
    const rack = rackById.get(shelf.rackId);
    for (let i = 1; i <= CONFIG.cellsPerShelf; i++) {
      const c = await request('POST', '/api/Cell', {
        code: `${rack.code}-${shelf.number}-${i}`,
        shelfId: shelf.id,
      }, token);
      cells.push(c);
      progress('Ячейки', cells.length, cellTotal);
    }
  }

  // 7. Products
  heading('7/8', `Товары (${CONFIG.products})`);
  const products = [];
  for (const body of productGenerator()) {
    const p = await request('POST', '/api/Product', body, token);
    products.push(p);
    progress('Товары', products.length, CONFIG.products);
    if (products.length >= CONFIG.products) break;
  }

  // 8. Batches
  heading('8/8', `Партии (${CONFIG.batches})`);
  const expiryBuckets = [
    ...Array(CONFIG.expiryDistribution.soonExpiring).fill('soon'),
    ...Array(CONFIG.expiryDistribution.future).fill('future'),
  ];
  shuffle(expiryBuckets);

  const batchesCreated = [];
  for (let i = 0; i < CONFIG.batches; i++) {
    const product = pick(products);
    const cell = cells[i];
    const bucket = expiryBuckets[i];

    const expiryOffset = bucket === 'soon' ? randInt(1, 7) : randInt(30, 730);

    const expiry = daysFromToday(expiryOffset);
    const production = new Date(today.getTime() - randInt(30, 365) * DAY_MS);
    const purchasePrice = Number((randInt(1000, 200000) / 100).toFixed(2));
    const quantity = randInt(5, 500);

    await request('POST', '/api/Batch', {
      productId: product.id,
      cellId: cell.id,
      quantity,
      purchasePrice,
      productionDate: isoDate(production),
      expiryDate: isoDate(expiry),
    }, token);

    batchesCreated.push(i + 1);
    progress('Партии', i + 1, CONFIG.batches);
  }

  console.log('\n✓ Готово.');
  console.log(
    `  ${warehouses.length} складов, ${zones.length} зон, ${racks.length} стеллажей, ` +
    `${shelves.length} полок, ${cells.length} ячеек, ${products.length} товаров, ` +
    `${batchesCreated.length} партий.`
  );
  console.log(
    `  Свободных ячеек: ${cells.length - batchesCreated.length} ` +
    `(занято партиями: ${batchesCreated.length}).`
  );
}

// ============================================================
// ENTRY
// ============================================================

main().catch((err) => {
  console.error('\n✗ Ошибка seed-скрипта:');
  if (err instanceof ApiError) {
    console.error(`  ${err.message}`);
    try {
      const problem = JSON.parse(err.body);
      if (problem.title) console.error(`  title:   ${problem.title}`);
      if (problem.code) console.error(`  code:    ${problem.code}`);
      if (problem.traceId) console.error(`  traceId: ${problem.traceId}`);
      if (problem.errors) {
        console.error('  errors:');
        for (const [field, msgs] of Object.entries(problem.errors)) {
          console.error(`    ${field}: ${msgs.join('; ')}`);
        }
      }
    } catch {
      console.error(`  body: ${err.body}`);
    }
  } else {
    console.error(err);
  }
  process.exit(1);
});
