const fs = require('fs');
const path = require('path');

/**
 * Enforce the 7-day image retention policy across both disk storage and SQLite records.
 */
function cleanExpiredProofImages(db, uploadDir, retentionMs, broadcastEvent = null) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const deletedFiles = [];
  const purgedIds = [];

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // 1. Scan files on disk and delete any proof image older than retentionMs
  const files = fs.readdirSync(uploadDir);
  for (const file of files) {
    if (file === '.gitkeep') continue;
    const filePath = path.join(uploadDir, file);
    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch {
      continue;
    }
    if (!stats.isFile()) continue;

    if (now - stats.mtimeMs > retentionMs) {
      try {
        fs.unlinkSync(filePath);
        deletedFiles.push(file);

        const matchingDelivery = db.getDeliveryByProofPath(`/uploads/${file}`);
        if (matchingDelivery) {
          db.markProofPurged(matchingDelivery.id, nowIso);
          purgedIds.push(matchingDelivery.id);
          db.addAuditLog(
            'IMAGE_RETENTION_PURGED',
            matchingDelivery.id,
            `Auto-deleted proof image ${file} after 7-day retention policy expiration`
          );
        } else {
          db.addAuditLog(
            'IMAGE_RETENTION_PURGED',
            file,
            `Auto-deleted orphaned proof image ${file} older than 7 days`
          );
        }
      } catch (err) {
        console.error('[RETENTION ERROR] Failed to delete file:', file, err.message);
      }
    }
  }

  // 2. Also purge any DB record whose retention_expires_at timestamp has passed
  const activeProofDeliveries = db.getDeliveriesWithActiveProof();
  for (const delivery of activeProofDeliveries) {
    if (!delivery.retentionExpiresAt) continue;
    const expiresMs = Date.parse(delivery.retentionExpiresAt);
    if (!Number.isFinite(expiresMs) || expiresMs > now) continue;

    const safeFileName = path.basename(delivery.proofImage);
    const targetPath = path.join(uploadDir, safeFileName);
    if (safeFileName !== '.gitkeep' && fs.existsSync(targetPath)) {
      try {
        fs.unlinkSync(targetPath);
        deletedFiles.push(safeFileName);
      } catch (err) {
        console.error('[RETENTION ERROR] Failed removing DB-expired file:', safeFileName, err.message);
      }
    }

    db.markProofPurged(delivery.id, nowIso);
    if (!purgedIds.includes(delivery.id)) {
      purgedIds.push(delivery.id);
      db.addAuditLog(
        'IMAGE_RETENTION_PURGED',
        delivery.id,
        `Purged expired proof image ${safeFileName} per 7-day retention deadline`
      );
    }
  }

  if (deletedFiles.length > 0 || purgedIds.length > 0) {
    console.log(`[7-DAY RETENTION] Purged ${purgedIds.length} delivery proofs (${deletedFiles.length} files deleted).`);
    if (typeof broadcastEvent === 'function') {
      broadcastEvent('retention_purged', { purgedIds, deletedFiles, purgedAt: nowIso });
    }
  }

  return {
    purgedCount: purgedIds.length,
    purgedIds,
    deletedFiles
  };
}

/**
 * Simulate an 8-day-old delivery proof for testing and immediate admin verification.
 */
function simulateExpiryForOrder(db, uploadDir, orderId, retentionMs, broadcastEvent = null) {
  const delivery = db.getDeliveryById(orderId);
  if (!delivery) {
    const err = new Error(`Order ${orderId} not found`);
    err.statusCode = 404;
    throw err;
  }
  if (!delivery.proofImage) {
    const err = new Error(`Order ${orderId} has no active proof image to expire`);
    err.statusCode = 400;
    throw err;
  }

  const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const expiredDate = new Date(Date.now() - eightDaysMs);
  const expiredRetentionIso = new Date(Date.now() - oneDayMs).toISOString();

  const safeFileName = path.basename(delivery.proofImage);
  const filePath = path.join(uploadDir, safeFileName);
  if (fs.existsSync(filePath)) {
    fs.utimesSync(filePath, expiredDate, expiredDate);
  }

  db.backdateDeliveryProofForTest(orderId, {
    deliveredAt: expiredDate.toISOString(),
    retentionExpiresAt: expiredRetentionIso
  });

  db.addAuditLog(
    'RETENTION_EXPIRY_SIMULATED',
    orderId,
    `Simulated 8-day age on ${safeFileName} to verify 7-day automatic purge`
  );

  return cleanExpiredProofImages(db, uploadDir, retentionMs, broadcastEvent);
}

module.exports = {
  cleanExpiredProofImages,
  simulateExpiryForOrder
};
