const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const INITIAL_KITCHENS = [
  {
    id: 'KITCHEN-01',
    name: 'Annapurna Home Kitchen',
    cuisine: 'Gujarati & Rajasthani Thali',
    neighborhood: 'Midtown',
    pricePerMonth: 180,
    rating: 4.9
  },
  {
    id: 'KITCHEN-02',
    name: 'Punjab Rasoi Express',
    cuisine: 'High-Protein North Indian',
    neighborhood: 'Downtown',
    pricePerMonth: 210,
    rating: 4.8
  },
  {
    id: 'KITCHEN-03',
    name: 'Ahimsa Pure Jain Kitchen',
    cuisine: 'Sattvic & Jain Daily Tiffin',
    neighborhood: 'West End',
    pricePerMonth: 195,
    rating: 4.9
  },
  {
    id: 'KITCHEN-04',
    name: 'Dakshin Spice Collective',
    cuisine: 'South Indian Executive Tiffin',
    neighborhood: 'Harbourview',
    pricePerMonth: 190,
    rating: 4.9
  }
];

const INITIAL_ORDERS = [
  {
    id: 'TIFFIN-101',
    kitchenId: 'KITCHEN-01',
    kitchenName: 'Annapurna Home Kitchen',
    customerName: 'Aarav Patel',
    customerPhone: '+15550192831',
    customerPushToken: 'ExpoPushToken[aarav-tiffin-101]',
    address: '124 Maple Street, Apt 4B',
    mealPlan: 'Deluxe Gujarati Thali',
    notes: 'Leave at concierge desk if unavailable; extra buttermilk included.',
    lat: 44.6650,
    lng: -63.6550
  },
  {
    id: 'TIFFIN-102',
    kitchenId: 'KITCHEN-02',
    kitchenName: 'Punjab Rasoi Express',
    customerName: 'Priya Sharma',
    customerPhone: '+15550192832',
    customerPushToken: 'ExpoPushToken[priya-tiffin-102]',
    address: '88 Oak Avenue, Suite 2',
    mealPlan: 'High-Protein North Indian',
    notes: 'Ring bell #202 after placing parcel on mat.',
    lat: 44.6672,
    lng: -63.6578
  },
  {
    id: 'TIFFIN-103',
    kitchenId: 'KITCHEN-03',
    kitchenName: 'Ahimsa Pure Jain Kitchen',
    customerName: 'Rohan Mehta',
    customerPhone: '+15550192833',
    customerPushToken: 'ExpoPushToken[rohan-tiffin-103]',
    address: '412 Cedar Lane, Unit 9',
    mealPlan: 'Jain Home-Style Lunch',
    notes: 'No onion/garlic tiffin • keep upright.',
    lat: 44.6626,
    lng: -63.6522
  },
  {
    id: 'TIFFIN-104',
    kitchenId: 'KITCHEN-04',
    kitchenName: 'Dakshin Spice Collective',
    customerName: 'Ananya Iyer',
    customerPhone: '+15550192834',
    customerPushToken: 'ExpoPushToken[ananya-tiffin-104]',
    address: '19 Harbourview Drive, Floor 3',
    mealPlan: 'South Indian Executive Tiffin',
    notes: 'Gate code 4820#.',
    lat: 44.6695,
    lng: -63.6515
  }
];

function mapKitchenRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    cuisine: row.cuisine,
    neighborhood: row.neighborhood,
    pricePerMonth: row.price_per_month,
    rating: row.rating,
    createdAt: row.created_at
  };
}

function mapDeliveryRow(row) {
  if (!row) return null;
  const notified = Boolean(row.notified_100m);
  return {
    id: row.id,
    kitchenId: row.kitchen_id || 'KITCHEN-01',
    kitchenName: row.kitchen_name || 'Annapurna Home Kitchen',
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerPushToken: row.customer_push_token,
    address: row.address,
    mealPlan: row.meal_plan,
    notes: row.notes,
    lat: row.lat,
    lng: row.lng,
    dropLat: row.lat,
    dropLng: row.lng,
    currentDistance: row.current_distance,
    etaMinutes: row.eta_minutes,
    notified100m: notified,
    proximityAlertSent: notified,
    notifiedAt: row.notified_at,
    status: row.status,
    proofImage: row.proof_image,
    proofHash: row.proof_hash,
    proofSizeBytes: row.proof_size_bytes,
    deliveredAt: row.delivered_at,
    retentionExpiresAt: row.retention_expires_at,
    proofPurgedAt: row.proof_purged_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapNotificationRow(row) {
  return {
    id: row.id,
    tiffinId: row.tiffin_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    channel: row.channel,
    type: row.type,
    title: row.title,
    message: row.message,
    distanceMeters: row.distance_meters,
    sentAt: row.sent_at
  };
}

function mapAuditRow(row) {
  return {
    id: row.id,
    eventType: row.event_type,
    entityId: row.entity_id,
    summary: row.summary,
    createdAt: row.created_at
  };
}

function mapDriverRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    vehicle: row.vehicle,
    lat: row.lat,
    lng: row.lng,
    updatedAt: row.updated_at
  };
}

function createDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS kitchens (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cuisine TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      price_per_month INTEGER NOT NULL,
      rating REAL NOT NULL DEFAULT 4.9,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      kitchen_id TEXT,
      kitchen_name TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_push_token TEXT,
      address TEXT NOT NULL,
      meal_plan TEXT NOT NULL,
      notes TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      current_distance INTEGER,
      eta_minutes INTEGER,
      notified_100m INTEGER NOT NULL DEFAULT 0,
      notified_at TEXT,
      status TEXT NOT NULL DEFAULT 'Out for Delivery',
      proof_image TEXT,
      proof_hash TEXT,
      proof_size_bytes INTEGER,
      delivered_at TEXT,
      retention_expires_at TEXT,
      proof_purged_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      tiffin_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      channel TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      distance_meters INTEGER,
      sent_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      entity_id TEXT,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS driver_state (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      vehicle TEXT NOT NULL,
      lat REAL,
      lng REAL,
      updated_at TEXT
    );
  `);

  // Safe migration for pre-existing local SQLite databases
  const deliveryCols = db.prepare('PRAGMA table_info(deliveries)').all().map((c) => c.name);
  if (!deliveryCols.includes('kitchen_id')) {
    db.exec('ALTER TABLE deliveries ADD COLUMN kitchen_id TEXT;');
  }
  if (!deliveryCols.includes('kitchen_name')) {
    db.exec('ALTER TABLE deliveries ADD COLUMN kitchen_name TEXT;');
  }

  function seedKitchens() {
    const now = new Date().toISOString();
    const insertKitchen = db.prepare(`
      INSERT INTO kitchens (id, name, cuisine, neighborhood, price_per_month, rating, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const k of INITIAL_KITCHENS) {
      insertKitchen.run(k.id, k.name, k.cuisine, k.neighborhood, k.pricePerMonth, k.rating, now);
    }
  }

  function seedInitialData() {
    const now = new Date().toISOString();
    if (db.prepare('SELECT COUNT(*) AS count FROM kitchens').get().count === 0) {
      seedKitchens();
    }

    const insertDelivery = db.prepare(`
      INSERT INTO deliveries (
        id, kitchen_id, kitchen_name, customer_name, customer_phone, customer_push_token, address,
        meal_plan, notes, lat, lng, current_distance, eta_minutes,
        notified_100m, notified_at, status, proof_image, proof_hash,
        proof_size_bytes, delivered_at, retention_expires_at, proof_purged_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, NULL, 'Out for Delivery', NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)
    `);

    for (const item of INITIAL_ORDERS) {
      insertDelivery.run(
        item.id,
        item.kitchenId,
        item.kitchenName,
        item.customerName,
        item.customerPhone,
        item.customerPushToken,
        item.address,
        item.mealPlan,
        item.notes,
        item.lat,
        item.lng,
        now,
        now
      );
    }

    db.prepare(`
      INSERT OR REPLACE INTO driver_state (id, name, phone, vehicle, lat, lng, updated_at)
      VALUES ('DRIVER-01', 'Vikram Rao', '+15550190001', 'E-Bike #DD-07', 44.6612, -63.6590, ?)
    `).run(now);

    db.prepare(`
      INSERT INTO audit_logs (event_type, entity_id, summary, created_at)
      VALUES ('NETWORK_SEEDED', 'NETWORK', 'Seeded 4 partner kitchens and 4 active dabba routes with 100m geofence & 7-day proof retention', ?)
    `).run(now);
  }

  if (db.prepare('SELECT COUNT(*) AS count FROM kitchens').get().count === 0) {
    seedKitchens();
  }
  if (db.prepare('SELECT COUNT(*) AS count FROM deliveries').get().count === 0) {
    seedInitialData();
  }

  function getAllKitchens() {
    return db.prepare('SELECT * FROM kitchens ORDER BY created_at ASC, id ASC').all().map(mapKitchenRow);
  }

  function getKitchenById(id) {
    const row = db.prepare('SELECT * FROM kitchens WHERE id = ?').get(id);
    return mapKitchenRow(row);
  }

  function createKitchen(kitchen) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO kitchens (id, name, cuisine, neighborhood, price_per_month, rating, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      kitchen.id,
      kitchen.name,
      kitchen.cuisine,
      kitchen.neighborhood,
      kitchen.pricePerMonth,
      kitchen.rating ?? 4.9,
      now
    );
    return getKitchenById(kitchen.id);
  }

  function getAllDeliveries() {
    return db.prepare('SELECT * FROM deliveries ORDER BY created_at ASC, id ASC').all().map(mapDeliveryRow);
  }

  function getDeliveryById(id) {
    const row = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(id);
    return mapDeliveryRow(row);
  }

  function createDelivery(order) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO deliveries (
        id, kitchen_id, kitchen_name, customer_name, customer_phone, customer_push_token, address,
        meal_plan, notes, lat, lng, current_distance, eta_minutes,
        notified_100m, notified_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, NULL, 'Out for Delivery', ?, ?)
    `).run(
      order.id,
      order.kitchenId || 'KITCHEN-01',
      order.kitchenName || 'Annapurna Home Kitchen',
      order.customerName,
      order.customerPhone,
      order.customerPushToken || `ExpoPushToken[${order.id.toLowerCase()}]`,
      order.address,
      order.mealPlan || 'Standard Daily Dabba',
      order.notes || '',
      order.lat,
      order.lng,
      now,
      now
    );
    return getDeliveryById(order.id);
  }

  function updateDeliveryLocationAndAlert(id, { distance, etaMinutes, triggerAlert, nowIso }) {
    if (triggerAlert) {
      db.prepare(`
        UPDATE deliveries
        SET current_distance = ?,
            eta_minutes = ?,
            notified_100m = 1,
            notified_at = COALESCE(notified_at, ?),
            updated_at = ?
        WHERE id = ?
      `).run(distance, etaMinutes, nowIso, nowIso, id);
    } else {
      db.prepare(`
        UPDATE deliveries
        SET current_distance = ?,
            eta_minutes = ?,
            updated_at = ?
        WHERE id = ?
      `).run(distance, etaMinutes, nowIso, id);
    }
    return getDeliveryById(id);
  }

  function saveDeliveryProof(id, { proofImage, proofHash, proofSizeBytes, deliveredAt, retentionExpiresAt }) {
    db.prepare(`
      UPDATE deliveries
      SET status = 'Delivered',
          proof_image = ?,
          proof_hash = ?,
          proof_size_bytes = ?,
          delivered_at = ?,
          retention_expires_at = ?,
          proof_purged_at = NULL,
          eta_minutes = 0,
          updated_at = ?
      WHERE id = ?
    `).run(proofImage, proofHash, proofSizeBytes, deliveredAt, retentionExpiresAt, deliveredAt, id);
    return getDeliveryById(id);
  }

  function backdateDeliveryProofForTest(id, { deliveredAt, retentionExpiresAt }) {
    db.prepare(`
      UPDATE deliveries
      SET delivered_at = ?,
          retention_expires_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(deliveredAt, retentionExpiresAt, new Date().toISOString(), id);
    return getDeliveryById(id);
  }

  function markProofPurged(id, purgedAtIso) {
    db.prepare(`
      UPDATE deliveries
      SET proof_image = NULL,
          proof_purged_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(purgedAtIso, purgedAtIso, id);
    return getDeliveryById(id);
  }

  function getDeliveriesWithActiveProof() {
    return db
      .prepare('SELECT * FROM deliveries WHERE proof_image IS NOT NULL ORDER BY delivered_at DESC')
      .all()
      .map(mapDeliveryRow);
  }

  function getDeliveryByProofPath(proofImagePath) {
    const row = db.prepare('SELECT * FROM deliveries WHERE proof_image = ?').get(proofImagePath);
    return mapDeliveryRow(row);
  }

  function addNotification(entry) {
    db.prepare(`
      INSERT INTO notifications (
        id, tiffin_id, customer_name, customer_phone, channel,
        type, title, message, distance_meters, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id,
      entry.tiffinId,
      entry.customerName,
      entry.customerPhone,
      entry.channel,
      entry.type,
      entry.title,
      entry.message,
      entry.distanceMeters ?? null,
      entry.sentAt
    );
    return entry;
  }

  function getNotifications(limit = 50, tiffinId = null) {
    if (tiffinId) {
      return db
        .prepare('SELECT * FROM notifications WHERE tiffin_id = ? ORDER BY sent_at DESC LIMIT ?')
        .all(tiffinId, limit)
        .map(mapNotificationRow);
    }
    return db
      .prepare('SELECT * FROM notifications ORDER BY sent_at DESC LIMIT ?')
      .all(limit)
      .map(mapNotificationRow);
  }

  function addAuditLog(eventType, entityId, summary) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO audit_logs (event_type, entity_id, summary, created_at)
      VALUES (?, ?, ?, ?)
    `).run(eventType, entityId, summary, now);
  }

  function getAuditLogs(limit = 40) {
    return db
      .prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?')
      .all(limit)
      .map(mapAuditRow);
  }

  function getDriverState() {
    const row = db.prepare("SELECT * FROM driver_state WHERE id = 'DRIVER-01'").get();
    return mapDriverRow(row);
  }

  function updateDriverState(lat, lng) {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE driver_state
      SET lat = ?, lng = ?, updated_at = ?
      WHERE id = 'DRIVER-01'
    `).run(lat, lng, now);
    return getDriverState();
  }

  function getStats() {
    const row = db.prepare(`
      SELECT
        COUNT(*) AS totalOrders,
        SUM(CASE WHEN status = 'Out for Delivery' THEN 1 ELSE 0 END) AS outForDelivery,
        SUM(CASE WHEN notified_100m = 1 THEN 1 ELSE 0 END) AS notified100mCount,
        SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) AS deliveredCount,
        SUM(CASE WHEN proof_image IS NOT NULL THEN 1 ELSE 0 END) AS activeProofCount,
        SUM(CASE WHEN proof_purged_at IS NOT NULL THEN 1 ELSE 0 END) AS purgedProofCount
      FROM deliveries
    `).get();
    const notifRow = db.prepare('SELECT COUNT(*) AS count FROM notifications').get();
    const kitchenRow = db.prepare('SELECT COUNT(*) AS count FROM kitchens').get();

    return {
      kitchensCount: kitchenRow.count || 0,
      totalOrders: row.totalOrders || 0,
      outForDelivery: row.outForDelivery || 0,
      notified100mCount: row.notified100mCount || 0,
      deliveredCount: row.deliveredCount || 0,
      activeProofCount: row.activeProofCount || 0,
      purgedProofCount: row.purgedProofCount || 0,
      notificationCount: notifRow.count || 0
    };
  }

  function resetDemoData() {
    db.exec('DELETE FROM kitchens; DELETE FROM deliveries; DELETE FROM notifications; DELETE FROM audit_logs;');
    seedInitialData();
  }

  function close() {
    db.close();
  }

  return {
    getAllKitchens,
    getKitchenById,
    createKitchen,
    getAllDeliveries,
    getDeliveryById,
    createDelivery,
    updateDeliveryLocationAndAlert,
    saveDeliveryProof,
    backdateDeliveryProofForTest,
    markProofPurged,
    getDeliveriesWithActiveProof,
    getDeliveryByProofPath,
    addNotification,
    getNotifications,
    addAuditLog,
    getAuditLogs,
    getDriverState,
    updateDriverState,
    getStats,
    resetDemoData,
    close
  };
}

module.exports = {
  createDatabase
};
