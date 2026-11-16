const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const config = require('./config');
const { createDatabase } = require('./db/database');
const { getDistanceInMeters, estimateEtaMinutes, isValidCoordinate } = require('./services/geofenceService');
const { createNotificationService } = require('./services/notificationService');
const { cleanExpiredProofImages, simulateExpiryForOrder } = require('./services/retentionService');

function computeFileSha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function getUploadedFile(req) {
  if (req.file) return req.file;
  if (req.files) {
    if (Array.isArray(req.files.photo) && req.files.photo[0]) return req.files.photo[0];
    if (Array.isArray(req.files.proofImage) && req.files.proofImage[0]) return req.files.proofImage[0];
  }
  return null;
}

function createApp(options = {}) {
  const uploadDir = options.uploadDir || config.UPLOAD_DIR;
  const dbPath = options.dbPath || config.DB_PATH;
  const retentionMs = options.retentionMs || config.RETENTION_MS;
  const geofenceRadius = options.geofenceRadius || config.GEOFENCE_RADIUS_METERS;

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const db = createDatabase(dbPath);
  const notificationService = createNotificationService();
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(config.ROOT_DIR, 'public')));
  app.use('/uploads', express.static(uploadDir));

  app.get('/favicon.ico', (req, res) => {
    res.type('image/svg+xml').sendFile(path.join(config.ROOT_DIR, 'public', 'logo.svg'));
  });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const rawId = req.params.id || req.params.orderId || 'TIFFIN';
      const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
      const ext = path.extname(file.originalname || '') || '.jpg';
      cb(null, `${safeId}_${Date.now()}${ext}`);
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: config.MAX_UPLOAD_BYTES },
    fileFilter: (req, file, cb) => {
      if (file.mimetype && file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for delivery proof.'));
      }
    }
  });

  const acceptProofFields = upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'proofImage', maxCount: 1 }
  ]);

  function buildDashboardSnapshot() {
    return {
      deliveries: db.getAllDeliveries(),
      notifications: db.getNotifications(50),
      auditLogs: db.getAuditLogs(40),
      driver: db.getDriverState(),
      stats: db.getStats()
    };
  }

  function runRetentionCleanup() {
    return cleanExpiredProofImages(db, uploadDir, retentionMs, notificationService.broadcastEvent);
  }

  async function processLocationUpdateForOrder(order, driverLat, driverLng, nowIso) {
    const distance = Math.round(getDistanceInMeters(driverLat, driverLng, order.lat, order.lng));
    const etaMinutes = estimateEtaMinutes(distance);
    const shouldTriggerAlert = distance <= geofenceRadius && !order.notified100m;

    const updated = db.updateDeliveryLocationAndAlert(order.id, {
      distance,
      etaMinutes,
      triggerAlert: shouldTriggerAlert,
      nowIso
    });

    if (shouldTriggerAlert) {
      await notificationService.dispatchCustomerNotification(db, updated, distance, 'PROXIMITY_100M');
    }

    return { updated, distance, triggered: shouldTriggerAlert };
  }

  async function handleProofUpload(orderId, file) {
    const order = db.getDeliveryById(orderId);
    if (!order) {
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      const err = new Error('Tiffin order not found');
      err.statusCode = 404;
      throw err;
    }

    if (!file) {
      const err = new Error('Proof image is required');
      err.statusCode = 400;
      throw err;
    }

    const now = Date.now();
    const deliveredAt = new Date(now).toISOString();
    const retentionExpiresAt = new Date(now + retentionMs).toISOString();
    const proofHash = computeFileSha256(file.path);

    const updated = db.saveDeliveryProof(order.id, {
      proofImage: `/uploads/${file.filename}`,
      proofHash,
      proofSizeBytes: file.size,
      deliveredAt,
      retentionExpiresAt
    });

    await notificationService.dispatchCustomerNotification(
      db,
      updated,
      updated.currentDistance ?? 0,
      'DELIVERED'
    );

    notificationService.broadcastEvent('state_update', buildDashboardSnapshot());
    return updated;
  }

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'dabba-drop-api',
      geofenceRadiusMeters: geofenceRadius,
      retentionDays: config.RETENTION_DAYS,
      timestamp: new Date().toISOString(),
      stats: db.getStats()
    });
  });

  // Real-time Server-Sent Events stream
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, timestamp: new Date().toISOString() })}\n\n`);
    const unsubscribe = notificationService.addSseClient(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 25000);
    if (typeof heartbeat.unref === 'function') heartbeat.unref();

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  // Get full operational dashboard snapshot
  app.get('/api/deliveries', (req, res) => {
    res.json(buildDashboardSnapshot());
  });

  // Get single tiffin delivery details and its notifications
  app.get('/api/deliveries/:id', (req, res) => {
    const delivery = db.getDeliveryById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: 'Tiffin order not found' });
    }
    res.json({
      delivery,
      notifications: db.getNotifications(25, delivery.id),
      driver: db.getDriverState()
    });
  });

  // Create new tiffin delivery order
  app.post('/api/deliveries', (req, res) => {
    const {
      id,
      customerName,
      customerPhone,
      address,
      mealPlan,
      notes,
      lat,
      lng
    } = req.body || {};

    if (!customerName || !customerPhone || !address) {
      return res.status(400).json({ error: 'customerName, customerPhone, and address are required' });
    }

    const numericLat = Number(lat);
    const numericLng = Number(lng);
    if (!isValidCoordinate(numericLat, numericLng)) {
      return res.status(400).json({ error: 'Valid numeric lat and lng are required' });
    }

    const existingDeliveries = db.getAllDeliveries();
    const generatedId = `TIFFIN-${101 + existingDeliveries.length}`;
    const orderId = (id ? String(id).trim().toUpperCase() : generatedId).replace(/[^A-Z0-9_-]/g, '');

    if (!orderId) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }
    if (db.getDeliveryById(orderId)) {
      return res.status(409).json({ error: `Order ${orderId} already exists` });
    }

    const created = db.createDelivery({
      id: orderId,
      customerName: String(customerName).trim(),
      customerPhone: String(customerPhone).trim(),
      address: String(address).trim(),
      mealPlan: mealPlan ? String(mealPlan).trim() : 'Standard Home Tiffin',
      notes: notes ? String(notes).trim() : '',
      lat: numericLat,
      lng: numericLng
    });

    db.addAuditLog(
      'ORDER_CREATED',
      created.id,
      `Created order ${created.id} for ${created.customerName} (${created.mealPlan})`
    );

    const snapshot = buildDashboardSnapshot();
    notificationService.broadcastEvent('state_update', snapshot);
    res.status(201).json({ delivery: created, ...snapshot });
  });

  // Driver live GPS update & idempotent 100m geofence evaluation across active orders
  app.post('/api/driver/location', async (req, res) => {
    const { lat, lng } = req.body || {};
    if (!isValidCoordinate(lat, lng)) {
      return res.status(400).json({ error: 'Valid numeric lat and lng required' });
    }

    const nowIso = new Date().toISOString();
    db.updateDriverState(lat, lng);

    const triggeredAlerts = [];
    const activeOrders = db.getAllDeliveries().filter((item) => item.status !== 'Delivered');

    for (const item of activeOrders) {
      const result = await processLocationUpdateForOrder(item, lat, lng, nowIso);
      if (result.triggered) {
        triggeredAlerts.push({
          id: result.updated.id,
          customerName: result.updated.customerName,
          distance: result.distance
        });
      }
    }

    const snapshot = buildDashboardSnapshot();
    notificationService.broadcastEvent('state_update', snapshot);
    res.json({ triggeredAlerts, ...snapshot });
  });

  // PWA proof upload endpoint
  app.post('/api/deliveries/:id/proof', acceptProofFields, async (req, res, next) => {
    try {
      const file = getUploadedFile(req);
      const delivery = await handleProofUpload(req.params.id, file);
      res.json({
        message: `Proof uploaded for ${delivery.id}. Image will be retained for ${config.RETENTION_DAYS} days.`,
        delivery,
        ...buildDashboardSnapshot()
      });
    } catch (err) {
      next(err);
    }
  });

  // Demo reset endpoint
  app.post('/api/deliveries/reset', (req, res) => {
    const files = fs.readdirSync(uploadDir);
    for (const file of files) {
      if (file === '.gitkeep') continue;
      const target = path.join(uploadDir, file);
      try {
        if (fs.statSync(target).isFile()) {
          fs.unlinkSync(target);
        }
      } catch {}
    }

    db.resetDemoData();
    const snapshot = buildDashboardSnapshot();
    notificationService.broadcastEvent('state_update', snapshot);
    res.json({
      message: 'Demo deliveries, notification logs, and uploads reset.',
      ...snapshot
    });
  });

  // Manual or simulated 7-day image retention sweep
  app.post('/api/retention/run', (req, res, next) => {
    try {
      const { simulateOrderId } = req.body || {};
      const result = simulateOrderId
        ? simulateExpiryForOrder(db, uploadDir, String(simulateOrderId), retentionMs, notificationService.broadcastEvent)
        : runRetentionCleanup();

      const snapshot = buildDashboardSnapshot();
      notificationService.broadcastEvent('state_update', snapshot);
      res.json({ result, ...snapshot });
    } catch (err) {
      next(err);
    }
  });

  // React Native / Expo endpoint: per-order geofence check
  app.post('/api/orders/:orderId/location', async (req, res) => {
    const { orderId } = req.params;
    const { driverLat, driverLng } = req.body || {};
    const order = db.getDeliveryById(orderId);

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!isValidCoordinate(driverLat, driverLng)) {
      return res.status(400).json({ error: 'Valid numeric driverLat and driverLng required' });
    }

    const nowIso = new Date().toISOString();
    db.updateDriverState(driverLat, driverLng);
    const { updated, distance } = await processLocationUpdateForOrder(order, driverLat, driverLng, nowIso);

    notificationService.broadcastEvent('state_update', buildDashboardSnapshot());
    res.json({
      orderId: updated.id,
      distanceMeters: distance,
      etaMinutes: updated.etaMinutes,
      proximityAlertSent: updated.proximityAlertSent
    });
  });

  // React Native / Expo endpoint: proof photo upload
  app.post('/api/orders/:orderId/proof', acceptProofFields, async (req, res, next) => {
    try {
      const file = getUploadedFile(req);
      const order = await handleProofUpload(req.params.orderId, file);
      res.json({
        message: `Proof uploaded and tiffin marked delivered (${config.RETENTION_DAYS}-day retention active)`,
        order
      });
    } catch (err) {
      next(err);
    }
  });

  // Centralized error handling middleware
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(err.statusCode || 400).json({ error: err.message || 'Request failed' });
    }
    next();
  });

  return {
    app,
    db,
    notificationService,
    runRetentionCleanup,
    uploadDir,
    retentionMs
  };
}

module.exports = {
  createApp
};
