const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 7);

module.exports = {
  ROOT_DIR,
  PORT: Number(process.env.PORT || 3000),
  GEOFENCE_RADIUS_METERS: Number(process.env.GEOFENCE_RADIUS_METERS || 100),
  RETENTION_DAYS,
  RETENTION_MS: RETENTION_DAYS * 24 * 60 * 60 * 1000,
  MAX_UPLOAD_BYTES: 5 * 1024 * 1024,
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(ROOT_DIR, 'uploads'),
  DB_PATH: process.env.DB_PATH || path.join(ROOT_DIR, 'data', 'tiffin.sqlite'),
  WEBHOOK_NOTIFICATION_URL: process.env.WEBHOOK_NOTIFICATION_URL || ''
};
