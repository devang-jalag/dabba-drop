const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createApp } = require('../src/app');

describe('Dabba Drop API, 100m Geofence & 7-Day Retention Suite', () => {
  let server;
  let baseUrl;
  let dbHandle;
  let tempDir;
  let uploadDir;

  before(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiffinpulse-test-'));
    uploadDir = path.join(tempDir, 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, '.gitkeep'), '');

    const instance = createApp({
      dbPath: path.join(tempDir, 'test.sqlite'),
      uploadDir
    });
    dbHandle = instance.db;

    await new Promise((resolve) => {
      server = instance.app.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (dbHandle) dbHandle.close();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns health status and 4 initial seeded tiffin orders', async () => {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.status, 'ok');
    assert.equal(health.geofenceRadiusMeters, 100);
    assert.equal(health.retentionDays, 7);

    const listRes = await fetch(`${baseUrl}/api/deliveries`);
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.equal(list.deliveries.length, 4);
    assert.equal(list.kitchens.length, 4);
    assert.equal(list.deliveries[0].id, 'TIFFIN-101');
    assert.equal(list.deliveries[0].kitchenName, 'Annapurna Home Kitchen');
  });

  it('registers a partner restaurant and enrolls a subscriber under it', async () => {
    const kRes = await fetch(`${baseUrl}/api/kitchens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bombay Spice Tiffins',
        cuisine: 'Homestyle Maharashtrian Thali',
        neighborhood: 'Midtown',
        pricePerMonth: 195
      })
    });
    assert.equal(kRes.status, 201);
    const kData = await kRes.json();
    assert.equal(kData.kitchen.name, 'Bombay Spice Tiffins');

    const listKitchens = await fetch(`${baseUrl}/api/kitchens`);
    assert.equal(listKitchens.status, 200);
    const kitchensBody = await listKitchens.json();
    assert.equal(kitchensBody.kitchens.length, 5);

    const oRes = await fetch(`${baseUrl}/api/deliveries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kitchenId: kData.kitchen.id,
        customerName: 'Neha Deshmukh',
        customerPhone: '+15550192955',
        address: '45 King St, Apt 12',
        lat: 44.6820,
        lng: -63.6720
      })
    });
    assert.equal(oRes.status, 201);
    const oData = await oRes.json();
    assert.equal(oData.delivery.kitchenId, kData.kitchen.id);
    assert.equal(oData.delivery.kitchenName, 'Bombay Spice Tiffins');
  });

  it('creates a new tiffin order via POST /api/deliveries', async () => {
    const res = await fetch(`${baseUrl}/api/deliveries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'TIFFIN-200',
        customerName: 'Kabir Verma',
        customerPhone: '+15550192900',
        address: '500 Spring Garden Rd',
        mealPlan: 'Punjabi Ghar Ka Khana',
        lat: 44.6750,
        lng: -63.6650
      })
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.delivery.id, 'TIFFIN-200');
    assert.equal(data.stats.totalOrders, 6);
  });

  it('triggers 100m geofence auto-notification accurately and idempotently', async () => {
    // ~330m north of TIFFIN-101 (44.6650, -63.6550) -> should NOT trigger
    const farRes = await fetch(`${baseUrl}/api/driver/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 44.6680, lng: -63.6550 })
    });
    assert.equal(farRes.status, 200);
    const farData = await farRes.json();
    assert.equal(farData.triggeredAlerts.length, 0);

    // ~37m from TIFFIN-101 -> MUST trigger TIFFIN-101 once
    const nearRes = await fetch(`${baseUrl}/api/driver/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 44.6653, lng: -63.6552 })
    });
    assert.equal(nearRes.status, 200);
    const nearData = await nearRes.json();
    assert.equal(nearData.triggeredAlerts.length, 1);
    assert.equal(nearData.triggeredAlerts[0].id, 'TIFFIN-101');
    assert.ok(nearData.triggeredAlerts[0].distance <= 100);

    // Second update still inside 100m -> MUST NOT duplicate alert
    const repeatRes = await fetch(`${baseUrl}/api/driver/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 44.6651, lng: -63.6551 })
    });
    const repeatData = await repeatRes.json();
    assert.equal(repeatData.triggeredAlerts.length, 0);
  });

  it('uploads camera proof photo, generates SHA-256 hash, and sets 7-day retention', async () => {
    const fd = new FormData();
    const dummyJpeg = new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], {
      type: 'image/jpeg'
    });
    fd.append('photo', dummyJpeg, 'doorstep.jpg');

    const res = await fetch(`${baseUrl}/api/deliveries/TIFFIN-101/proof`, {
      method: 'POST',
      body: fd
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.delivery.status, 'Delivered');
    assert.ok(data.delivery.proofImage.startsWith('/uploads/TIFFIN-101_'));
    assert.equal(data.delivery.proofHash.length, 64);

    const deliveredMs = Date.parse(data.delivery.deliveredAt);
    const expiresMs = Date.parse(data.delivery.retentionExpiresAt);
    const diffDays = (expiresMs - deliveredMs) / (24 * 60 * 60 * 1000);
    assert.equal(Math.round(diffDays), 7);

    const fileRes = await fetch(`${baseUrl}${data.delivery.proofImage}`);
    assert.equal(fileRes.status, 200);
  });

  it('supports React Native / Expo per-order geofence and proof upload endpoints', async () => {
    const locRes = await fetch(`${baseUrl}/api/orders/TIFFIN-102/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverLat: 44.6674, driverLng: -63.6579 })
    });
    assert.equal(locRes.status, 200);
    const locData = await locRes.json();
    assert.equal(locData.orderId, 'TIFFIN-102');
    assert.equal(locData.proximityAlertSent, true);
    assert.ok(locData.distanceMeters <= 100);

    const fd = new FormData();
    fd.append('proofImage', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'mobile.jpg');
    const proofRes = await fetch(`${baseUrl}/api/orders/TIFFIN-102/proof`, {
      method: 'POST',
      body: fd
    });
    assert.equal(proofRes.status, 200);
    const proofData = await proofRes.json();
    assert.equal(proofData.order.status, 'Delivered');
    assert.ok(proofData.order.proofImage);
  });

  it('purges proof images older than 7 days while preserving .gitkeep', async () => {
    // Simulate 8-day expiry on TIFFIN-101 via API
    const simRes = await fetch(`${baseUrl}/api/retention/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulateOrderId: 'TIFFIN-101' })
    });
    assert.equal(simRes.status, 200);
    const simData = await simRes.json();
    assert.equal(simData.result.purgedCount, 1);
    assert.deepEqual(simData.result.purgedIds, ['TIFFIN-101']);

    const tiffin101 = simData.deliveries.find((d) => d.id === 'TIFFIN-101');
    assert.equal(tiffin101.proofImage, null);
    assert.ok(tiffin101.proofPurgedAt);

    // Also verify orphaned file > 7 days old is swept while .gitkeep survives
    const orphanPath = path.join(uploadDir, 'ORPHAN_OLD.jpg');
    fs.writeFileSync(orphanPath, 'old-bytes');
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    fs.utimesSync(orphanPath, eightDaysAgo, eightDaysAgo);

    const sweepRes = await fetch(`${baseUrl}/api/retention/run`, { method: 'POST' });
    assert.equal(sweepRes.status, 200);
    assert.equal(fs.existsSync(orphanPath), false);
    assert.equal(fs.existsSync(path.join(uploadDir, '.gitkeep')), true);
  });
});
