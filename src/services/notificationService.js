const config = require('../config');

function createNotificationService() {
  const sseClients = new Set();

  function addSseClient(res) {
    sseClients.add(res);
    return () => sseClients.delete(res);
  }

  function broadcastEvent(event, payload) {
    const serialized = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(serialized);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  async function dispatchCustomerNotification(db, delivery, distanceMeters, type = 'PROXIMITY_100M') {
    const isDelivered = type === 'DELIVERED';
    const roundedDistance = Math.round(distanceMeters ?? 0);
    const title = isDelivered ? 'Dabba Delivered' : 'Rider Approaching';
    const kitchenLabel = delivery.kitchenName ? `${delivery.kitchenName} ` : '';
    const message = isDelivered
      ? `${delivery.customerName}, your ${kitchenLabel}dabba (${delivery.id}) has been left at your door. Delivery photo kept for 7 days.`
      : `${delivery.customerName}, your ${kitchenLabel}dabba (${delivery.id}) is ${roundedDistance}m away and arriving shortly.`;

    const entry = {
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tiffinId: delivery.id,
      customerName: delivery.customerName,
      customerPhone: delivery.customerPhone,
      channel: 'AUTO_PUSH_SMS',
      type,
      title,
      message,
      distanceMeters: roundedDistance,
      sentAt: new Date().toISOString()
    };

    db.addNotification(entry);
    db.addAuditLog(
      isDelivered ? 'PROOF_DELIVERY_NOTIFIED' : 'GEOFENCE_100M_TRIGGERED',
      delivery.id,
      `${title} sent automatically to ${delivery.customerName} (${delivery.customerPhone}) at ${roundedDistance}m`
    );

    if (config.WEBHOOK_NOTIFICATION_URL && process.env.ENABLE_LIVE_WEBHOOK === 'true') {
      try {
        await fetch(config.WEBHOOK_NOTIFICATION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        });
      } catch (err) {
        console.warn('[WEBHOOK WARN]', err.message);
      }
    }

    console.log(`[AUTO-ALERT] (${type}) [${delivery.id}] -> ${delivery.customerPhone}: "${message}"`);
    broadcastEvent('notification', entry);
    return entry;
  }

  return {
    addSseClient,
    broadcastEvent,
    dispatchCustomerNotification
  };
}

module.exports = {
  createNotificationService
};
