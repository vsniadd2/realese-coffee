const { pool, initDatabase } = require('./database');

function asInt(v) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

async function upsertCategory({ name, color = '#000000', icon = null, displayOrder = 0, trackCharts = false }) {
  const res = await pool.query(
    `
      INSERT INTO product_categories (name, color, icon, display_order, track_charts)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name) DO UPDATE SET
        color = EXCLUDED.color,
        icon = EXCLUDED.icon,
        display_order = EXCLUDED.display_order,
        track_charts = EXCLUDED.track_charts,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `,
    [name, color, icon, displayOrder, !!trackCharts]
  );
  return res.rows[0].id;
}

async function upsertSubcategory({ categoryId, name, displayOrder = 0 }) {
  const res = await pool.query(
    `
      INSERT INTO product_subcategories (category_id, name, display_order)
      VALUES ($1, $2, $3)
      ON CONFLICT (category_id, name) DO UPDATE SET
        display_order = EXCLUDED.display_order,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `,
    [categoryId, name, displayOrder]
  );
  return res.rows[0].id;
}

async function upsertProduct({
  subcategoryId,
  name,
  price,
  description = null,
  imageData = null,
  displayOrder = 0,
  tags = []
}) {
  const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
  const res = await pool.query(
    `
      INSERT INTO products (subcategory_id, name, price, description, image_data, display_order, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (subcategory_id, name) DO UPDATE SET
        price = EXCLUDED.price,
        description = EXCLUDED.description,
        image_data = EXCLUDED.image_data,
        display_order = EXCLUDED.display_order,
        tags = EXCLUDED.tags,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `,
    [subcategoryId, name, Number.parseFloat(price) || 0, description, imageData, asInt(displayOrder) ?? 0, tagsStr]
  );
  return res.rows[0].id;
}

async function seed() {
  await initDatabase();

  // Уникальные индексы для идемпотентных UPSERT-ов
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_product_categories_name ON product_categories(name)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_product_subcategories_cat_name ON product_subcategories(category_id, name)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_products_subcat_name ON products(subcategory_id, name)`);

  // Минимальный набор, чтобы приложение было работоспособно и графики имели что считать
  const drinksCatId = await upsertCategory({
    name: 'Напитки',
    color: '#3b82f6',
    icon: '☕',
    displayOrder: 10,
    trackCharts: true
  });
  const dessertsCatId = await upsertCategory({
    name: 'Десерты',
    color: '#f59e0b',
    icon: '🍰',
    displayOrder: 20,
    trackCharts: true
  });
  const retailCatId = await upsertCategory({
    name: 'Розница',
    color: '#22c55e',
    icon: '🛍️',
    displayOrder: 30,
    trackCharts: false
  });

  const espressoSubId = await upsertSubcategory({ categoryId: drinksCatId, name: 'Эспрессо', displayOrder: 10 });
  const milkCoffeeSubId = await upsertSubcategory({ categoryId: drinksCatId, name: 'Кофе с молоком', displayOrder: 20 });
  const teaSubId = await upsertSubcategory({ categoryId: drinksCatId, name: 'Чай', displayOrder: 30 });

  const cakesSubId = await upsertSubcategory({ categoryId: dessertsCatId, name: 'Десерты', displayOrder: 10 });

  const beansSubId = await upsertSubcategory({ categoryId: retailCatId, name: 'Кофе в зернах', displayOrder: 10 });
  const merchSubId = await upsertSubcategory({ categoryId: retailCatId, name: 'Мерч', displayOrder: 20 });

  await upsertProduct({ subcategoryId: espressoSubId, name: 'Эспрессо', price: 4.0, displayOrder: 10, tags: ['кофе'] });
  await upsertProduct({ subcategoryId: espressoSubId, name: 'Американо', price: 4.5, displayOrder: 20, tags: ['кофе'] });
  await upsertProduct({ subcategoryId: milkCoffeeSubId, name: 'Капучино', price: 5.5, displayOrder: 10, tags: ['кофе'] });
  await upsertProduct({ subcategoryId: milkCoffeeSubId, name: 'Латте', price: 6.0, displayOrder: 20, tags: ['кофе'] });
  await upsertProduct({ subcategoryId: teaSubId, name: 'Чай чёрный', price: 3.5, displayOrder: 10, tags: ['чай'] });
  await upsertProduct({ subcategoryId: teaSubId, name: 'Чай зелёный', price: 3.5, displayOrder: 20, tags: ['чай'] });

  await upsertProduct({ subcategoryId: cakesSubId, name: 'Чизкейк', price: 8.0, displayOrder: 10, tags: ['десерт'] });
  await upsertProduct({ subcategoryId: cakesSubId, name: 'Брауни', price: 6.5, displayOrder: 20, tags: ['десерт'] });

  await upsertProduct({ subcategoryId: beansSubId, name: 'Кофе в зернах 250 г', price: 25.0, displayOrder: 10, tags: ['зерно'] });
  await upsertProduct({ subcategoryId: beansSubId, name: 'Кофе в зернах 1 кг', price: 80.0, displayOrder: 20, tags: ['зерно'] });

  await upsertProduct({ subcategoryId: merchSubId, name: 'Термокружка', price: 35.0, displayOrder: 10, tags: ['мерч'] });

  const summary = await pool.query(
    `
      SELECT
        (SELECT COUNT(*)::int FROM product_categories) AS categories,
        (SELECT COUNT(*)::int FROM product_subcategories) AS subcategories,
        (SELECT COUNT(*)::int FROM products) AS products
    `
  );

  const s = summary.rows[0];
  console.log(`✓ Товары/категории готовы. Категорий: ${s.categories}, подкатегорий: ${s.subcategories}, товаров: ${s.products}`);
}

seed()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('Критическая ошибка seed товаров:', e);
    await pool.end().catch(() => {});
    process.exit(1);
  });

