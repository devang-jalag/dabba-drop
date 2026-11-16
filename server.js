require('dotenv').config();
const cron = require('node-cron');
const config = require('./src/config');
const { createApp } = require('./src/app');

const { app, db, runRetentionCleanup } = createApp();

// Run 7-day proof image retention check on startup, hourly, and daily at midnight
runRetentionCleanup();
const hourlyJob = cron.schedule('0 * * * *', runRetentionCleanup);
const midnightJob = cron.schedule('0 0 * * *', runRetentionCleanup);

const server = app.listen(config.PORT, () => {
  console.log(`Dabba Drop Server running at http://localhost:${config.PORT}`);
});

function shutdown(signal) {
  console.log(`[SERVER] Received ${signal}, shutting down cleanly...`);
  hourlyJob.stop();
  midnightJob.stop();
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
