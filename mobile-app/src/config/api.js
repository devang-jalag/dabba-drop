import { Platform } from 'react-native';

// Android emulator reaches host localhost via 10.0.2.2; iOS simulator & web use localhost.
// For physical iOS/Android devices, update this in the Settings tab to your computer's LAN IP.
export const DEFAULT_API_BASE =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export async function fetchDeliveries(apiBase) {
  const res = await fetch(`${apiBase}/api/deliveries`);
  return parseJson(res);
}

export async function postDriverLocation(apiBase, lat, lng) {
  const res = await fetch(`${apiBase}/api/driver/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng })
  });
  return parseJson(res);
}

export async function postOrderLocation(apiBase, orderId, driverLat, driverLng) {
  const res = await fetch(`${apiBase}/api/orders/${encodeURIComponent(orderId)}/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driverLat, driverLng })
  });
  return parseJson(res);
}

export async function uploadOrderProof(apiBase, orderId, photoUri) {
  const formData = new FormData();
  formData.append('proofImage', {
    uri: photoUri,
    name: `${orderId}_${Date.now()}.jpg`,
    type: 'image/jpeg'
  });

  const res = await fetch(`${apiBase}/api/orders/${encodeURIComponent(orderId)}/proof`, {
    method: 'POST',
    body: formData
  });
  return parseJson(res);
}

export async function simulateOrderRetentionPurge(apiBase, simulateOrderId) {
  const res = await fetch(`${apiBase}/api/retention/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(simulateOrderId ? { simulateOrderId } : {})
  });
  return parseJson(res);
}

export async function resetDemo(apiBase) {
  const res = await fetch(`${apiBase}/api/deliveries/reset`, {
    method: 'POST'
  });
  return parseJson(res);
}
