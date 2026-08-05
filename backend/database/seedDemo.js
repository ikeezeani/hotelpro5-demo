/**
 * Seeds a rich, realistic demo dataset covering every module — guests,
 * live reservations, in-house stays with real folios, POS sales, paid and
 * partially-paid invoices, housekeeping tasks, inventory (including
 * intentionally low-stock items), a pending purchase order, and CRM notes.
 *
 * All dates are computed relative to "today" at run time, so the demo
 * always looks current no matter when it's run or shown to a client.
 *
 * Run with: npm run seed:demo
 * Re-run safely before a demo with: npm run seed:demo -- --reset
 *   (--reset wipes previously-seeded business data first, in FK-safe order,
 *   then reseeds — it does NOT touch hotel_settings, roles, or user accounts)
 */
require('dotenv').config();
const { pool } = require('../config/db');
const { money, generateCode, generateNumber } = require('../utils/helpers');

const RESET = process.argv.includes('--reset');

function daysFromNow(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function reset() {
  console.log('Clearing previously seeded business data (--reset)...');
  const tables = [
    'payments', 'invoices', 'folio_charges', 'folios', 'pos_order_items', 'pos_orders',
    'inventory_transactions', 'purchase_order_items', 'purchase_orders', 'housekeeping_tasks',
    'stays', 'reservations', 'guest_notes', 'guests', 'inventory_items', 'suppliers',
    'inventory_categories', 'pos_outlets', 'rooms', 'room_types'
  ];
  for (const t of tables) {
    // eslint-disable-next-line no-await-in-loop
    await pool.query(`DELETE FROM ${t}`);
  }
  console.log('Cleared.');
}

async function seed() {
  const [[existing]] = await pool.query('SELECT COUNT(*) AS count FROM room_types');
  if (existing.count > 0 && !RESET) {
    console.log('Demo data (or real data) already exists — room_types is not empty.');
    console.log('Run "npm run seed:demo -- --reset" to wipe business data and reseed fresh demo data.');
    process.exit(0);
  }
  if (RESET) await reset();

  const [[admin]] = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');
  if (!admin) {
    console.error('No user accounts found — run the installer (npm run install-wizard) first.');
    process.exit(1);
  }
  const userId = admin.id;

  const [[settingsRow]] = await pool.query('SELECT tax_percent, service_charge_percent FROM hotel_settings LIMIT 1');
  const taxPercent = Number(settingsRow?.tax_percent || 0);
  const serviceChargePercent = Number(settingsRow?.service_charge_percent || 0);

  console.log('Seeding demo data...');

  const roomTypeDefs = [
    { name: 'Standard Room', description: 'Cozy room with all essentials — queen bed, en-suite bathroom, work desk.', base_rate: 45000, max_occupancy: 2 },
    { name: 'Deluxe Room', description: 'Spacious room with premium furnishing, city view, and a seating area.', base_rate: 75000, max_occupancy: 3 },
    { name: 'Executive Suite', description: 'Suite with separate living area, king bed, and a private balcony.', base_rate: 120000, max_occupancy: 4 }
  ];
  const roomTypeIds = {};
  for (const rt of roomTypeDefs) {
    const [result] = await pool.query(
      'INSERT INTO room_types (name, description, base_rate, max_occupancy) VALUES (?,?,?,?)',
      [rt.name, rt.description, rt.base_rate, rt.max_occupancy]
    );
    roomTypeIds[rt.name] = result.insertId;
  }

  const roomDefs = [
    ...['101', '102', '103', '104', '105'].map((n) => ({ type: 'Standard Room', number: n, floor: '1' })),
    ...['201', '202', '203', '204', '205'].map((n) => ({ type: 'Deluxe Room', number: n, floor: '2' })),
    ...['301', '302', '303'].map((n) => ({ type: 'Executive Suite', number: n, floor: '3' }))
  ];
  const roomIds = {};
  for (const r of roomDefs) {
    const [result] = await pool.query(
      'INSERT INTO rooms (room_type_id, room_number, floor) VALUES (?,?,?)',
      [roomTypeIds[r.type], r.number, r.floor]
    );
    roomIds[r.number] = result.insertId;
  }

  const outletDefs = [
    { name: 'Main Restaurant', type: 'restaurant' },
    { name: 'Pool Bar', type: 'bar' },
    { name: 'Spa & Wellness', type: 'spa' },
    { name: 'Gift Shop', type: 'shop' }
  ];
  const outletIds = {};
  for (const o of outletDefs) {
    const [result] = await pool.query('INSERT INTO pos_outlets (name, type) VALUES (?,?)', [o.name, o.type]);
    outletIds[o.name] = result.insertId;
  }

  const categoryDefs = [
    { name: 'Housekeeping Supplies', department: 'housekeeping' },
    { name: 'F&B Beverages', department: 'fnb' },
    { name: 'Bar Supplies', department: 'bar' },
    { name: 'Spa Supplies', department: 'other' },
    { name: 'Front Office Supplies', department: 'front_office' }
  ];
  const categoryIds = {};
  for (const c of categoryDefs) {
    const [result] = await pool.query('INSERT INTO inventory_categories (name, department) VALUES (?,?)', [c.name, c.department]);
    categoryIds[c.name] = result.insertId;
  }

  const [supplierResult] = await pool.query(
    'INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?,?,?,?,?)',
    ['Lagos Hospitality Supplies Ltd.', 'Chika Adamu', '08023456789', 'sales@lagoshospitality.ng', '14 Adeola Odeku St, Victoria Island, Lagos']
  );
  const supplierId = supplierResult.insertId;

  const itemDefs = [
    { cat: 'Housekeeping Supplies', sku: 'HK-TOWEL-01', name: 'Bath Towel', unit: 'pcs', qty: 180, reorder: 40, cost: 3500 },
    { cat: 'Housekeeping Supplies', sku: 'HK-LINEN-01', name: 'Bedsheet Set (Queen)', unit: 'set', qty: 12, reorder: 15, cost: 8500 },
    { cat: 'Housekeeping Supplies', sku: 'HK-SOAP-01', name: 'Guest Soap Bar', unit: 'pcs', qty: 320, reorder: 100, cost: 250 },
    { cat: 'F&B Beverages', sku: 'BEV-WATER-01', name: 'Bottled Water 500ml', unit: 'bottle', qty: 210, reorder: 50, cost: 150, sellable: true, price: 800 },
    { cat: 'F&B Beverages', sku: 'BEV-JUICE-01', name: 'Fresh Orange Juice', unit: 'glass', qty: 8, reorder: 20, cost: 400, sellable: true, price: 2500 },
    { cat: 'Bar Supplies', sku: 'BAR-BEER-01', name: 'Star Lager Beer', unit: 'bottle', qty: 96, reorder: 24, cost: 500, sellable: true, price: 2000 },
    { cat: 'Bar Supplies', sku: 'BAR-COCK-01', name: 'Signature Cocktail', unit: 'glass', qty: 5, reorder: 10, cost: 1200, sellable: true, price: 6500 },
    { cat: 'Spa Supplies', sku: 'SPA-OIL-01', name: 'Aromatherapy Massage Oil', unit: 'bottle', qty: 18, reorder: 8, cost: 3000, sellable: true, price: 12000 },
    { cat: 'Spa Supplies', sku: 'SPA-TOWEL-01', name: 'Spa Wrap Towel', unit: 'pcs', qty: 30, reorder: 10, cost: 4000 },
    { cat: 'Front Office Supplies', sku: 'FO-KEYCARD-01', name: 'Key Card Blanks', unit: 'pcs', qty: 45, reorder: 50, cost: 120 }
  ];
  const itemIds = {};
  for (const it of itemDefs) {
    const [result] = await pool.query(
      `INSERT INTO inventory_items (category_id, sku, name, unit, quantity_on_hand, reorder_level, unit_cost, is_sellable, selling_price)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [categoryIds[it.cat], it.sku, it.name, it.unit, it.qty, it.reorder, it.cost, it.sellable ? 1 : 0, it.price || 0]
    );
    itemIds[it.name] = result.insertId;
    await pool.query(
      `INSERT INTO inventory_transactions (item_id, type, quantity, reference, user_id, notes) VALUES (?, 'adjustment', ?, 'Initial demo stock', ?, 'Opening balance')`,
      [result.insertId, it.qty, userId]
    );
  }

  const poNumber = generateNumber('PO');
  const poLines = [
    { item: 'Fresh Orange Juice', qty: 40, cost: 400 },
    { item: 'Signature Cocktail', qty: 20, cost: 1200 }
  ];
  const poTotal = money(poLines.reduce((sum, l) => sum + l.qty * l.cost, 0));
  const [poResult] = await pool.query(
    `INSERT INTO purchase_orders (po_number, supplier_id, status, total_amount, ordered_by) VALUES (?,?,'ordered',?,?)`,
    [poNumber, supplierId, poTotal, userId]
  );
  for (const l of poLines) {
    await pool.query(
      'INSERT INTO purchase_order_items (purchase_order_id, item_id, quantity, unit_cost) VALUES (?,?,?,?)',
      [poResult.insertId, itemIds[l.item], l.qty, l.cost]
    );
  }

  const guestDefs = [
    { first: 'Chinedu', last: 'Okafor', email: 'chinedu.okafor@example.com', phone: '08031234501' },
    { first: 'Aisha', last: 'Bello', email: 'aisha.bello@example.com', phone: '08031234502', vip: 'gold', points: 4200, note: 'Prefers a high floor room. Allergic to nuts — please inform F&B for any room service or restaurant orders.' },
    { first: 'Emeka', last: 'Nwosu', email: 'emeka.nwosu@example.com', phone: '08031234503' },
    { first: 'Ngozi', last: 'Adeyemi', email: 'ngozi.adeyemi@example.com', phone: '08031234504' },
    { first: 'Tunde', last: 'Balogun', email: 'tunde.balogun@example.com', phone: '08031234505', vip: 'platinum', points: 9800, note: 'Long-standing corporate client (Balogun and Co). Requests late checkout whenever the room allows it.' },
    { first: 'Folake', last: 'Ogunleye', email: 'folake.ogunleye@example.com', phone: '08031234506' },
    { first: 'Ibrahim', last: 'Suleiman', email: 'ibrahim.suleiman@example.com', phone: '08031234507' },
    { first: 'Grace', last: 'Eze', email: 'grace.eze@example.com', phone: '08031234508' },
    { first: 'Michael', last: 'Okonkwo', email: 'michael.okonkwo@example.com', phone: '08031234509' },
    { first: 'Blessing', last: 'Chukwu', email: 'blessing.chukwu@example.com', phone: '08031234510' },
    { first: 'Yusuf', last: 'Danladi', email: 'yusuf.danladi@example.com', phone: '08031234511' }
  ];
  const guestIds = {};
  for (const g of guestDefs) {
    const [result] = await pool.query(
      `INSERT INTO guests (first_name, last_name, email, phone, vip_tier, loyalty_points) VALUES (?,?,?,?,?,?)`,
      [g.first, g.last, g.email, g.phone, g.vip || 'none', g.points || 0]
    );
    guestIds[`${g.first} ${g.last}`] = result.insertId;
    if (g.note) {
      await pool.query('INSERT INTO guest_notes (guest_id, user_id, note) VALUES (?,?,?)', [result.insertId, userId, g.note]);
    }
  }

  async function createReservation({ guest, roomTypeName, checkIn, checkOut, status, source = 'walk_in', adults = 2 }) {
    const rate = roomTypeDefs.find((rt) => rt.name === roomTypeName).base_rate;
    const [result] = await pool.query(
      `INSERT INTO reservations
       (confirmation_code, guest_id, room_type_id, source, check_in_date, check_out_date, adults, rate_per_night, status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [generateCode('RES'), guestIds[guest], roomTypeIds[roomTypeName], source, checkIn, checkOut, adults, rate, status, userId]
    );
    return { id: result.insertId, rate };
  }

  const nights = (checkIn, checkOut) => Math.max(Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000), 1);

  async function checkInGuest({ guest, roomNumber, roomTypeName, checkIn, checkOut, posCharges = [] }) {
    const checkInDate = daysFromNow(checkIn);
    const checkOutDate = daysFromNow(checkOut);
    const res = await createReservation({ guest, roomTypeName, checkIn: checkInDate, checkOut: checkOutDate, status: 'checked_in', source: 'website' });
    await pool.query('UPDATE reservations SET room_id = ? WHERE id = ?', [roomIds[roomNumber], res.id]);
    await pool.query('UPDATE rooms SET status = "occupied" WHERE id = ?', [roomIds[roomNumber]]);

    const [stayResult] = await pool.query(
      `INSERT INTO stays (reservation_id, room_id, guest_id, actual_check_in, checked_in_by) VALUES (?,?,?,NOW(),?)`,
      [res.id, roomIds[roomNumber], guestIds[guest], userId]
    );
    const n = nights(checkInDate, checkOutDate);
    const folioNumber = generateNumber('FOL');
    const [folioResult] = await pool.query('INSERT INTO folios (stay_id, folio_number) VALUES (?,?)', [stayResult.insertId, folioNumber]);
    await pool.query(
      `INSERT INTO folio_charges (folio_id, charge_type, description, amount) VALUES (?, 'room', ?, ?)`,
      [folioResult.insertId, `Room charge (${n} night${n > 1 ? 's' : ''})`, res.rate * n]
    );

    for (const charge of posCharges) {
      const orderNumber = generateNumber('POS');
      const subtotal = money(charge.items.reduce((sum, i) => sum + i.qty * i.price, 0));
      const [orderResult] = await pool.query(
        `INSERT INTO pos_orders (order_number, outlet_id, guest_id, stay_id, status, subtotal, total_amount, opened_by, closed_by, closed_at)
         VALUES (?,?,?,?,'charged_to_room',?,?,?,?,NOW())`,
        [orderNumber, outletIds[charge.outlet], guestIds[guest], stayResult.insertId, subtotal, subtotal, userId, userId]
      );
      for (const item of charge.items) {
        await pool.query(
          'INSERT INTO pos_order_items (order_id, item_id, name, quantity, unit_price, line_total) VALUES (?,?,?,?,?,?)',
          [orderResult.insertId, itemIds[item.name] || null, item.name, item.qty, item.price, money(item.qty * item.price)]
        );
      }
      await pool.query(
        `INSERT INTO folio_charges (folio_id, charge_type, description, reference_table, reference_id, amount)
         VALUES (?, 'pos', ?, 'pos_orders', ?, ?)`,
        [folioResult.insertId, `POS charge — order ${orderNumber} (${charge.outlet})`, orderResult.insertId, subtotal]
      );
    }
  }

  await checkInGuest({
    guest: 'Chinedu Okafor', roomNumber: '202', roomTypeName: 'Deluxe Room', checkIn: -2, checkOut: 1,
    posCharges: [{ outlet: 'Main Restaurant', items: [{ name: 'Bottled Water 500ml', qty: 2, price: 800 }] }]
  });
  await checkInGuest({
    guest: 'Aisha Bello', roomNumber: '301', roomTypeName: 'Executive Suite', checkIn: -1, checkOut: 3,
    posCharges: [
      { outlet: 'Spa & Wellness', items: [{ name: 'Aromatherapy Massage Oil', qty: 1, price: 12000 }] },
      { outlet: 'Main Restaurant', items: [{ name: 'Bottled Water 500ml', qty: 3, price: 800 }] }
    ]
  });
  await checkInGuest({ guest: 'Emeka Nwosu', roomNumber: '101', roomTypeName: 'Standard Room', checkIn: 0, checkOut: 2 });

  await createReservation({ guest: 'Ngozi Adeyemi', roomTypeName: 'Deluxe Room', checkIn: daysFromNow(0), checkOut: daysFromNow(2), status: 'confirmed', source: 'phone' });
  await createReservation({ guest: 'Tunde Balogun', roomTypeName: 'Executive Suite', checkIn: daysFromNow(1), checkOut: daysFromNow(4), status: 'confirmed', source: 'corporate' });

  async function completedStay({ guest, roomNumber, roomTypeName, checkIn, checkOut, method, invoiceStatus }) {
    const checkInDate = daysFromNow(checkIn);
    const checkOutDate = daysFromNow(checkOut);
    const res = await createReservation({ guest, roomTypeName, checkIn: checkInDate, checkOut: checkOutDate, status: 'checked_out' });
    await pool.query('UPDATE reservations SET room_id = ? WHERE id = ?', [roomIds[roomNumber], res.id]);

    const [stayResult] = await pool.query(
      `INSERT INTO stays (reservation_id, room_id, guest_id, actual_check_in, actual_check_out, status, checked_in_by, checked_out_by)
       VALUES (?,?,?,?,?,'checked_out',?,?)`,
      [res.id, roomIds[roomNumber], guestIds[guest], `${checkInDate} 14:00:00`, `${checkOutDate} 11:00:00`, userId, userId]
    );
    const n = nights(checkInDate, checkOutDate);
    const roomTotal = res.rate * n;
    const folioNumber = generateNumber('FOL');
    const [folioResult] = await pool.query(
      `INSERT INTO folios (stay_id, folio_number, status, closed_at) VALUES (?,?,'closed',?)`,
      [stayResult.insertId, folioNumber, `${checkOutDate} 11:00:00`]
    );
    await pool.query(
      `INSERT INTO folio_charges (folio_id, charge_type, description, amount) VALUES (?, 'room', ?, ?)`,
      [folioResult.insertId, `Room charge (${n} night${n > 1 ? 's' : ''})`, roomTotal]
    );

    const taxAmount = money(roomTotal * (taxPercent / 100));
    const serviceCharge = money(roomTotal * (serviceChargePercent / 100));
    const total = money(roomTotal + taxAmount + serviceCharge);
    const invoiceNumber = generateNumber('INV');
    const amountPaid = invoiceStatus === 'partial' ? money(total * 0.5) : total;
    const balanceDue = money(total - amountPaid);

    const [invoiceResult] = await pool.query(
      `INSERT INTO invoices
       (invoice_number, folio_id, guest_id, subtotal, tax_amount, service_charge, total_amount, amount_paid, balance_due, status, currency_code, issued_by)
       VALUES (?,?,?,?,?,?,?,?,?,?, (SELECT currency_code FROM hotel_settings LIMIT 1), ?)`,
      [invoiceNumber, folioResult.insertId, guestIds[guest], roomTotal, taxAmount, serviceCharge, total, amountPaid, balanceDue, invoiceStatus, userId]
    );
    await pool.query(
      `INSERT INTO payments (invoice_id, method, amount, currency_code, received_by)
       VALUES (?,?,?, (SELECT currency_code FROM hotel_settings LIMIT 1), ?)`,
      [invoiceResult.insertId, method, amountPaid, userId]
    );
  }

  await completedStay({ guest: 'Folake Ogunleye', roomNumber: '103', roomTypeName: 'Standard Room', checkIn: -10, checkOut: -7, method: 'card', invoiceStatus: 'paid' });
  await completedStay({ guest: 'Ibrahim Suleiman', roomNumber: '203', roomTypeName: 'Deluxe Room', checkIn: -8, checkOut: -5, method: 'paystack', invoiceStatus: 'paid' });
  await completedStay({ guest: 'Grace Eze', roomNumber: '302', roomTypeName: 'Executive Suite', checkIn: -15, checkOut: -12, method: 'bank_transfer', invoiceStatus: 'partial' });
  await completedStay({ guest: 'Michael Okonkwo', roomNumber: '104', roomTypeName: 'Standard Room', checkIn: -20, checkOut: -18, method: 'mobile_money', invoiceStatus: 'paid' });

  await createReservation({ guest: 'Blessing Chukwu', roomTypeName: 'Deluxe Room', checkIn: daysFromNow(5), checkOut: daysFromNow(7), status: 'cancelled', source: 'ota' });
  await createReservation({ guest: 'Yusuf Danladi', roomTypeName: 'Standard Room', checkIn: daysFromNow(-3), checkOut: daysFromNow(-1), status: 'no_show', source: 'website' });

  {
    const items = [{ name: 'Star Lager Beer', qty: 4, price: 2000 }, { name: 'Bottled Water 500ml', qty: 2, price: 800 }];
    const subtotal = money(items.reduce((sum, i) => sum + i.qty * i.price, 0));
    const orderNumber = generateNumber('POS');
    const [orderResult] = await pool.query(
      `INSERT INTO pos_orders (order_number, outlet_id, status, subtotal, total_amount, opened_by, closed_by, closed_at)
       VALUES (?,?,'paid',?,?,?,?,NOW())`,
      [orderNumber, outletIds['Pool Bar'], subtotal, subtotal, userId, userId]
    );
    for (const item of items) {
      await pool.query(
        'INSERT INTO pos_order_items (order_id, item_id, name, quantity, unit_price, line_total) VALUES (?,?,?,?,?,?)',
        [orderResult.insertId, itemIds[item.name], item.name, item.qty, item.price, money(item.qty * item.price)]
      );
      await pool.query('UPDATE inventory_items SET quantity_on_hand = quantity_on_hand - ? WHERE id = ?', [item.qty, itemIds[item.name]]);
      await pool.query(
        `INSERT INTO inventory_transactions (item_id, type, quantity, reference, user_id) VALUES (?, 'pos_sale_out', ?, ?, ?)`,
        [itemIds[item.name], -item.qty, orderNumber, userId]
      );
    }
  }

  const hkTasks = [
    { room: '103', type: 'checkout_clean', priority: 'high', status: 'pending' },
    { room: '203', type: 'checkout_clean', priority: 'high', status: 'in_progress' },
    { room: '302', type: 'deep_clean', priority: 'normal', status: 'completed' },
    { room: '104', type: 'checkout_clean', priority: 'normal', status: 'verified' },
    { room: '105', type: 'stay_over_clean', priority: 'low', status: 'pending' }
  ];
  for (const t of hkTasks) {
    const [result] = await pool.query(
      `INSERT INTO housekeeping_tasks (room_id, task_type, priority, status, assigned_to) VALUES (?,?,?,?,?)`,
      [roomIds[t.room], t.type, t.priority, t.status, userId]
    );
    if (t.status === 'in_progress' || t.status === 'completed' || t.status === 'verified') {
      await pool.query('UPDATE housekeeping_tasks SET started_at = NOW() WHERE id = ?', [result.insertId]);
    }
    if (t.status === 'completed' || t.status === 'verified') {
      await pool.query('UPDATE housekeeping_tasks SET completed_at = NOW() WHERE id = ?', [result.insertId]);
    }
    if (t.status === 'verified') {
      await pool.query('UPDATE housekeeping_tasks SET verified_by = ? WHERE id = ?', [userId, result.insertId]);
      await pool.query('UPDATE rooms SET housekeeping_status = "clean" WHERE id = ?', [roomIds[t.room]]);
    } else if (t.status === 'pending' || t.status === 'in_progress') {
      await pool.query('UPDATE rooms SET housekeeping_status = "dirty" WHERE id = ?', [roomIds[t.room]]);
    }
  }

  console.log('Demo data seeded successfully:');
  console.log('  - 3 room types, 13 rooms');
  console.log('  - 11 guests (2 VIP, with CRM notes)');
  console.log('  - 3 in-house stays with open folios and room-charge POS orders');
  console.log('  - 2 upcoming confirmed arrivals');
  console.log('  - 4 completed stays with invoices (3 paid, 1 partial) across 4 payment methods');
  console.log('  - 1 cancelled + 1 no-show reservation');
  console.log('  - 1 walk-in POS sale');
  console.log('  - 5 housekeeping tasks across all statuses');
  console.log('  - 10 inventory items (4 intentionally below reorder level) + 1 pending purchase order');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});