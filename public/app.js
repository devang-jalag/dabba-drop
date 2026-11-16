const state = {
  deliveries: [],
  notifications: [],
  auditLogs: [],
  driver: null,
  stats: {},
  activeTab: 'driver',
  selectedCustomerId: 'TIFFIN-101',
  searchQuery: '',
  statusFilter: 'ALL',
  watchId: null,
  simulationTimer: null,
  cameraStream: null,
  cameraTargetId: null,
  cameraFacingMode: 'environment'
};

const CARGO_COPY = {
  tiffin: 'Hot stainless-steel tiffins with two-way container tracking and doorstep alerts before lunch cools.',
  harvest: 'Weekly heirloom vegetables, herbs, and orchard boxes flagged at 100 meters so crisp greens never sit in the sun.',
  dairy: 'Pre-dawn glass milk bottles and cultured butter delivered silently with instant doorstep verification.',
  bakery: 'Warm sourdough loaves and pantry staples handed off with zero WhatsApp friction and 7-day proof retention.'
};

const els = {
  scrollProgress: document.getElementById('scroll-progress'),
  heroMedia: document.getElementById('hero-media'),
  bentoSlider: document.getElementById('bento-distance-slider'),
  bentoReadout: document.getElementById('bento-distance-readout'),
  bentoState: document.getElementById('bento-geofence-state'),
  cargoDesc: document.getElementById('cargo-description'),
  sseStatus: document.getElementById('sse-status'),
  gpsStatus: document.getElementById('gps-status'),
  toastContainer: document.getElementById('toast-container'),
  deliveryList: document.getElementById('delivery-list'),
  orderSearch: document.getElementById('order-search'),
  statusFilter: document.getElementById('status-filter'),
  customerSelect: document.getElementById('customer-order-select'),
  customerSearch: document.getElementById('customer-order-search'),
  customerBody: document.getElementById('customer-tracker-body'),
  adminKpis: document.getElementById('admin-kpis'),
  radarSvg: document.getElementById('geofence-radar'),
  adminNotifs: document.getElementById('admin-notification-list'),
  retentionBody: document.getElementById('retention-table-body'),
  auditLogList: document.getElementById('audit-log-list'),
  cameraModal: document.getElementById('camera-modal'),
  cameraTitle: document.getElementById('camera-modal-title'),
  cameraVideo: document.getElementById('camera-video'),
  cameraCanvas: document.getElementById('camera-canvas'),
  cameraHud: document.getElementById('camera-hud'),
  newOrderModal: document.getElementById('new-order-modal'),
  newOrderForm: document.getElementById('new-order-form')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, isError = false) {
  const div = document.createElement('div');
  div.className = isError ? 'toast error' : 'toast';
  div.textContent = message;
  els.toastContainer.prepend(div);
  setTimeout(() => div.remove(), 5500);
}

function formatRetentionCountdown(expiresAt) {
  if (!expiresAt) return 'N/A';
  const diffMs = Date.parse(expiresAt) - Date.now();
  if (diffMs <= 0) return 'Expired • pending sweep';
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return `${days}d ${hours}h left`;
}

// Fluid 60fps Scroll Parallax, Active Nav Highlight & Progress Bar
const navLinks = Array.from(document.querySelectorAll('.anchor-link[data-section]'));
const trackedSections = ['hero-overview', 'bento-showcase', 'live-workspace']
  .map((id) => document.getElementById(id))
  .filter(Boolean);

function setActiveNavSection(sectionId) {
  navLinks.forEach((link) => {
    link.classList.toggle('is-active', link.dataset.section === sectionId);
  });
}

function syncActiveSectionNav() {
  if (!trackedSections.length || !navLinks.length) return;
  const probeY = (window.scrollY || 0) + 180;
  let currentId = trackedSections[0].id;
  for (const sec of trackedSections) {
    if (probeY >= sec.offsetTop) {
      currentId = sec.id;
    }
  }
  setActiveNavSection(currentId);
}

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    setActiveNavSection(link.dataset.section);
  });
});

let scrollTicking = false;
function updateScrollEffects() {
  const y = window.scrollY || 0;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const pct = Math.min(100, Math.max(0, (y / maxScroll) * 100));

  if (els.scrollProgress) {
    els.scrollProgress.style.width = `${pct.toFixed(1)}%`;
  }
  if (els.heroMedia && y < window.innerHeight * 1.3) {
    const translate = Math.round(y * 0.22);
    const scale = 1 + Math.min(0.1, y / 6000);
    els.heroMedia.style.transform = `translate3d(0, ${translate}px, 0) scale(${scale.toFixed(4)})`;
  }
  syncActiveSectionNav();
  scrollTicking = false;
}

window.addEventListener(
  'scroll',
  () => {
    if (!scrollTicking) {
      window.requestAnimationFrame(updateScrollEffects);
      scrollTicking = true;
    }
  },
  { passive: true }
);

// Staggered Scroll Reveals via IntersectionObserver
function initScrollReveals() {
  const targets = document.querySelectorAll('.reveal-on-scroll');
  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -36px 0px' }
  );

  targets.forEach((el) => observer.observe(el));
}

// Interactive Bento Controls
if (els.bentoSlider) {
  const updateBentoGeofence = () => {
    const val = Number(els.bentoSlider.value);
    els.bentoReadout.textContent = `${val} m`;
    if (val <= 100) {
      els.bentoState.textContent = `Inside 100m Geofence (${val}m) • Customer Auto-Notified`;
      els.bentoState.classList.add('triggered');
    } else {
      els.bentoState.textContent = `En Route (${val}m) • Silent GPS Polling`;
      els.bentoState.classList.remove('triggered');
    }
  };
  els.bentoSlider.addEventListener('input', updateBentoGeofence);
  updateBentoGeofence();
}

document.querySelectorAll('.cargo-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cargo-pill').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    const key = btn.dataset.cargo;
    if (els.cargoDesc && CARGO_COPY[key]) {
      els.cargoDesc.textContent = CARGO_COPY[key];
    }
  });
});

function applySnapshot(data) {
  if (Array.isArray(data.deliveries)) state.deliveries = data.deliveries;
  if (Array.isArray(data.notifications)) state.notifications = data.notifications;
  if (Array.isArray(data.auditLogs)) state.auditLogs = data.auditLogs;
  if (data.driver) {
    state.driver = data.driver;
    if (typeof data.driver.lat === 'number' && typeof data.driver.lng === 'number') {
      els.gpsStatus.textContent = `GPS: ${data.driver.lat.toFixed(4)}, ${data.driver.lng.toFixed(4)}`;
    }
  }
  if (data.stats) state.stats = data.stats;

  if (!state.deliveries.some((d) => d.id === state.selectedCustomerId) && state.deliveries[0]) {
    state.selectedCustomerId = state.deliveries[0].id;
  }

  renderAll();
}

async function fetchSnapshot() {
  const res = await fetch('/api/deliveries');
  const data = await res.json();
  applySnapshot(data);
}

async function postDriverLocation(lat, lng) {
  const res = await fetch('/api/driver/location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng })
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || 'Failed to update rider GPS', true);
    return;
  }
  if (Array.isArray(data.triggeredAlerts)) {
    data.triggeredAlerts.forEach((alert) => {
      showToast(`Arrival notice dispatched to ${alert.customerName} at ${alert.distance}m.`);
    });
  }
  applySnapshot(data);
}

function stopSimulation() {
  if (state.simulationTimer) {
    clearInterval(state.simulationTimer);
    state.simulationTimer = null;
  }
}

function simulateRouteApproach(targetOrderId = null) {
  stopSimulation();
  const target =
    (targetOrderId && state.deliveries.find((d) => d.id === targetOrderId)) ||
    state.deliveries.find((d) => d.status !== 'Delivered') ||
    state.deliveries[0];

  if (!target) {
    showToast('No orders available to simulate.', true);
    return;
  }

  const steps = [
    { lat: target.lat + 0.0029, lng: target.lng + 0.0002 },
    { lat: target.lat + 0.00145, lng: target.lng + 0.0001 },
    { lat: target.lat + 0.00068, lng: target.lng + 0.00005 },
    { lat: target.lat + 0.00015, lng: target.lng + 0.00002 }
  ];

  let idx = 0;
  showToast(`Running route simulation toward ${target.id} (${target.customerName}).`);
  postDriverLocation(steps[0].lat, steps[0].lng);
  idx = 1;

  state.simulationTimer = setInterval(() => {
    if (idx >= steps.length) {
      stopSimulation();
      return;
    }
    const step = steps[idx];
    idx += 1;
    postDriverLocation(step.lat, step.lng);
  }, 1100);
}

async function jumpNearOrder(tiffinId) {
  stopSimulation();
  const target = state.deliveries.find((d) => d.id === tiffinId);
  if (!target) return;
  await postDriverLocation(target.lat + 0.0003, target.lng + 0.00015);
}

async function submitProofFile(fileOrBlob, tiffinId, filename = `${tiffinId}.jpg`) {
  const formData = new FormData();
  formData.append('photo', fileOrBlob, filename);

  const res = await fetch(`/api/deliveries/${encodeURIComponent(tiffinId)}/proof`, {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || 'Proof upload failed', true);
    return;
  }
  showToast(`Delivery photo saved for ${tiffinId}. Scheduled for purge in 7 days.`);
  applySnapshot(data);
}

async function handleFileProofSubmit(event, tiffinId) {
  event.preventDefault();
  const input = document.getElementById(`photo-${tiffinId}`);
  if (!input || !input.files[0]) {
    showToast('Select or capture a photo first.', true);
    return;
  }
  await submitProofFile(input.files[0], tiffinId, input.files[0].name);
}

async function openLiveCamera(tiffinId) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Live camera unavailable in this browser; use the photo file picker instead.', true);
    return;
  }
  state.cameraTargetId = tiffinId;
  await startCameraStream();
}

async function startCameraStream() {
  stopCameraTracks();
  if (!state.cameraTargetId) return;

  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: state.cameraFacingMode } },
      audio: false
    });
    els.cameraVideo.srcObject = state.cameraStream;
    els.cameraTitle.textContent = `Doorstep Proof • ${state.cameraTargetId}`;
    const coords = state.driver ? `${state.driver.lat.toFixed(5)}, ${state.driver.lng.toFixed(5)}` : 'GPS Pending';
    els.cameraHud.textContent = `${state.cameraTargetId} | ${new Date().toLocaleString()} | GPS ${coords}`;
    els.cameraModal.classList.remove('hidden');
  } catch (err) {
    showToast(`Camera error: ${err.message}`, true);
    closeLiveCamera();
  }
}

function stopCameraTracks() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((track) => track.stop());
    state.cameraStream = null;
  }
  els.cameraVideo.srcObject = null;
}

function closeLiveCamera() {
  stopCameraTracks();
  state.cameraTargetId = null;
  els.cameraModal.classList.add('hidden');
}

function captureWatermarkedProof() {
  if (!state.cameraTargetId || !els.cameraVideo.videoWidth) return;

  const width = els.cameraVideo.videoWidth;
  const height = els.cameraVideo.videoHeight;
  els.cameraCanvas.width = width;
  els.cameraCanvas.height = height;

  const ctx = els.cameraCanvas.getContext('2d');
  ctx.drawImage(els.cameraVideo, 0, 0, width, height);

  const barHeight = Math.max(44, Math.round(height * 0.1));
  ctx.fillStyle = 'rgba(30, 25, 21, 0.82)';
  ctx.fillRect(0, height - barHeight, width, barHeight);

  const coords = state.driver ? `${state.driver.lat.toFixed(5)}, ${state.driver.lng.toFixed(5)}` : 'N/A';
  const stamp = `${state.cameraTargetId}  |  ${new Date().toISOString()}  |  GPS: ${coords}`;
  ctx.fillStyle = '#F5F0E6';
  ctx.font = `bold ${Math.max(14, Math.round(barHeight * 0.36))}px monospace`;
  ctx.fillText(stamp, 14, height - Math.round(barHeight * 0.36));

  const targetId = state.cameraTargetId;
  els.cameraCanvas.toBlob(async (blob) => {
    closeLiveCamera();
    if (blob) {
      await submitProofFile(blob, targetId, `${targetId}-proof.jpg`);
    }
  }, 'image/jpeg', 0.88);
}

async function runRetentionSweep(simulateOrderId = null) {
  const res = await fetch('/api/retention/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(simulateOrderId ? { simulateOrderId } : {})
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || 'Retention sweep failed', true);
    return;
  }
  const count = data.result?.purgedCount || 0;
  showToast(
    simulateOrderId
      ? `Simulated 8-day expiry and purged proof photo for ${simulateOrderId}.`
      : `Retention sweep finished: ${count} expired photo(s) removed.`
  );
  applySnapshot(data);
}

function renderDriverView() {
  const query = state.searchQuery.trim().toLowerCase();
  const filtered = state.deliveries.filter((d) => {
    const matchesSearch =
      !query ||
      d.id.toLowerCase().includes(query) ||
      d.customerName.toLowerCase().includes(query) ||
      d.mealPlan.toLowerCase().includes(query) ||
      d.address.toLowerCase().includes(query);

    if (!matchesSearch) return false;
    if (state.statusFilter === 'OUT_FOR_DELIVERY') return d.status === 'Out for Delivery';
    if (state.statusFilter === 'NOTIFIED_100M') return d.notified100m && d.status !== 'Delivered';
    if (state.statusFilter === 'DELIVERED') return d.status === 'Delivered';
    return true;
  });

  if (!filtered.length) {
    els.deliveryList.innerHTML = '<div class="panel muted">No dabba orders match the current filter.</div>';
    return;
  }

  els.deliveryList.innerHTML = filtered.map((d) => {
    const safeId = escapeHtml(d.id);
    const isDelivered = d.status === 'Delivered';
    const distanceLabel = d.currentDistance !== null && d.currentDistance !== undefined ? `${d.currentDistance} m` : 'Pending GPS';
    const etaLabel = d.etaMinutes !== null && d.etaMinutes !== undefined ? `${d.etaMinutes} min` : '--';

    return `
      <article class="order-card ${d.notified100m && !isDelivered ? 'geofence-hot' : ''}">
        <div class="card-top">
          <div>
            <div class="order-id">${safeId} / ${escapeHtml(d.mealPlan)}</div>
            <h3 class="customer-title">${escapeHtml(d.customerName)}</h3>
          </div>
          <span class="badge ${isDelivered ? 'badge-delivered' : 'badge-pending'}">${escapeHtml(d.status)}</span>
        </div>

        <p class="meta-line">Address: ${escapeHtml(d.address)}</p>
        <p class="meta-line">Phone: ${escapeHtml(d.customerPhone)}</p>
        ${d.notes ? `<div class="notes-box">${escapeHtml(d.notes)}</div>` : ''}

        <div class="metrics-strip">
          <div class="metric-chip">
            <span>Distance</span>
            <strong>${distanceLabel}</strong>
          </div>
          <div class="metric-chip">
            <span>Est. Arrival</span>
            <strong>${etaLabel}</strong>
          </div>
        </div>

        ${d.notified100m ? `<div class="alert-banner">100m arrival notice sent${d.notifiedAt ? ` at ${new Date(d.notifiedAt).toLocaleTimeString()}` : ''}</div>` : ''}

        <div class="proof-section">
          ${d.proofImage ? `
            <span class="badge badge-info">7-Day Retention: ${escapeHtml(formatRetentionCountdown(d.retentionExpiresAt))}</span>
            <img src="${escapeHtml(d.proofImage)}" alt="Delivery proof for ${safeId}" class="proof-preview" />
            <div class="muted mono">SHA-256: ${escapeHtml((d.proofHash || '').slice(0, 18))}...</div>
          ` : d.proofPurgedAt ? `
            <span class="badge badge-purged">Photo purged on ${new Date(d.proofPurgedAt).toLocaleDateString()} (7-day policy)</span>
          ` : `
            <form onsubmit="handleFileProofSubmit(event, '${safeId}')">
              <label class="field-label" for="photo-${safeId}">Doorstep Photo Proof</label>
              <input id="photo-${safeId}" class="file-input" type="file" accept="image/*" capture="environment" required />
              <div class="card-actions">
                <button type="button" class="btn btn-outline btn-sm" onclick="jumpNearOrder('${safeId}')">Jump &lt;100m</button>
                <button type="button" class="btn btn-dark btn-sm" onclick="openLiveCamera('${safeId}')">Open Camera</button>
                <button type="submit" class="btn btn-primary btn-sm">Upload Photo</button>
              </div>
            </form>
          `}
        </div>
      </article>
    `;
  }).join('');
}

function renderCustomerView() {
  const currentOptions = state.deliveries
    .map((d) => `<option value="${escapeHtml(d.id)}" ${d.id === state.selectedCustomerId ? 'selected' : ''}>${escapeHtml(d.id)} • ${escapeHtml(d.customerName)}</option>`)
    .join('');
  els.customerSelect.innerHTML = currentOptions;

  const order = state.deliveries.find((d) => d.id === state.selectedCustomerId);
  if (!order) {
    els.customerBody.innerHTML = '<div class="panel muted">Select a Dabba ID to view its status.</div>';
    return;
  }

  const orderNotifs = state.notifications.filter((n) => n.tiffinId === order.id);
  const step1Done = true;
  const step2Done = order.currentDistance !== null || order.notified100m || order.status === 'Delivered';
  const step3Done = order.notified100m || order.status === 'Delivered';
  const step4Done = order.status === 'Delivered';

  els.customerBody.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <div>
          <span class="order-id">${escapeHtml(order.id)}</span>
          <h3>${escapeHtml(order.customerName)} • ${escapeHtml(order.mealPlan)}</h3>
          <p class="muted">${escapeHtml(order.address)}</p>
        </div>
        <span class="badge ${step4Done ? 'badge-delivered' : 'badge-pending'}">${escapeHtml(order.status)}</span>
      </div>

      <div class="stepper">
        <div class="step ${step1Done ? 'done' : ''}">1. Kitchen Dispatched</div>
        <div class="step ${step2Done ? 'done' : ''}">2. En Route ${order.currentDistance !== null ? `(${order.currentDistance}m)` : ''}</div>
        <div class="step ${step3Done ? 'done' : ''}">3. Within 100m Notified</div>
        <div class="step ${step4Done ? 'done' : ''}">4. Delivered with Proof</div>
      </div>

      ${state.driver ? `<p class="meta-line">Rider: <strong>${escapeHtml(state.driver.name)}</strong> (${escapeHtml(state.driver.vehicle)}) • ETA: <strong>${order.etaMinutes ?? '--'} min</strong></p>` : ''}
    </div>

    <div class="customer-grid">
      <div class="panel">
        <div class="panel-header"><h3>Automated Notices</h3></div>
        ${orderNotifs.length ? `
          <ul class="feed-list">
            ${orderNotifs.map((n) => `
              <li class="feed-item">
                <div><strong>${escapeHtml(n.title)}</strong></div>
                <div>${escapeHtml(n.message)}</div>
                <div class="feed-time">${new Date(n.sentAt).toLocaleString()}</div>
              </li>
            `).join('')}
          </ul>
        ` : '<p class="muted">Awaiting rider entry into the 100m doorstep radius.</p>'}
      </div>

      <div class="panel">
        <div class="panel-header"><h3>Doorstep Proof</h3></div>
        ${order.proofImage ? `
          <span class="badge badge-info">7-Day Retention: ${escapeHtml(formatRetentionCountdown(order.retentionExpiresAt))}</span>
          <img src="${escapeHtml(order.proofImage)}" alt="Doorstep proof for ${escapeHtml(order.id)}" class="proof-preview" style="margin-top:0.65rem;" />
          <p class="muted mono" style="margin-top:0.55rem;">Delivered: ${new Date(order.deliveredAt).toLocaleString()}</p>
          <p class="muted mono">SHA-256: ${escapeHtml(order.proofHash || '')}</p>
        ` : order.proofPurgedAt ? `
          <span class="badge badge-purged">Proof photo cleared after 7 days (${new Date(order.proofPurgedAt).toLocaleString()})</span>
        ` : '<p class="muted">Delivery photo will appear here once dropped off.</p>'}
      </div>
    </div>
  `;
}

function renderRadarSvg() {
  const deliveries = state.deliveries;
  if (!deliveries.length) {
    els.radarSvg.innerHTML = '';
    return;
  }

  const lats = deliveries.map((d) => d.lat);
  const lngs = deliveries.map((d) => d.lng);
  if (state.driver && typeof state.driver.lat === 'number') {
    lats.push(state.driver.lat);
    lngs.push(state.driver.lng);
  }

  const minLat = Math.min(...lats) - 0.0018;
  const maxLat = Math.max(...lats) + 0.0018;
  const minLng = Math.min(...lngs) - 0.0022;
  const maxLng = Math.max(...lngs) + 0.0022;

  const projectX = (lng) => 30 + ((lng - minLng) / (maxLng - minLng || 0.001)) * 360;
  const projectY = (lat) => 250 - ((lat - minLat) / (maxLat - minLat || 0.001)) * 220;

  const metersSpan = (maxLat - minLat) * 111000;
  const radius100m = Math.max(14, Math.min(44, (100 / (metersSpan || 500)) * 220));

  const gridLines = [70, 140, 210].map((y) => `<line x1="0" y1="${y}" x2="420" y2="${y}" stroke="#332B25" stroke-width="1" />`).join('')
    + [105, 210, 315].map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="280" stroke="#332B25" stroke-width="1" />`).join('');

  const orderMarkers = deliveries.map((d) => {
    const cx = projectX(d.lng).toFixed(1);
    const cy = projectY(d.lat).toFixed(1);
    const color = d.status === 'Delivered' ? '#6BA37E' : d.notified100m ? '#D4A359' : '#C98A63';

    return `
      <circle cx="${cx}" cy="${cy}" r="${radius100m.toFixed(1)}" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-dasharray="4 3" stroke-width="1.3" />
      <circle cx="${cx}" cy="${cy}" r="5" fill="${color}" />
      <text x="${Number(cx) + 8}" y="${Number(cy) + 4}" fill="#EFE8DA" font-size="10" font-family="monospace">${escapeHtml(d.id)}</text>
    `;
  }).join('');

  let driverMarker = '';
  if (state.driver && typeof state.driver.lat === 'number') {
    const dx = projectX(state.driver.lng).toFixed(1);
    const dy = projectY(state.driver.lat).toFixed(1);
    driverMarker = `
      <circle cx="${dx}" cy="${dy}" r="9" fill="#D96B4E" fill-opacity="0.32" />
      <circle cx="${dx}" cy="${dy}" r="5.5" fill="#D96B4E" stroke="#FAF6EE" stroke-width="1.5" />
      <text x="${Number(dx) + 9}" y="${Number(dy) - 6}" fill="#E7C284" font-size="10" font-weight="bold" font-family="monospace">RIDER</text>
    `;
  }

  els.radarSvg.innerHTML = `${gridLines}${orderMarkers}${driverMarker}`;
}

function renderAdminView() {
  const s = state.stats || {};
  els.adminKpis.innerHTML = `
    <div class="kpi-card"><span>Total Orders</span><strong>${s.totalOrders ?? 0}</strong></div>
    <div class="kpi-card"><span>Out for Delivery</span><strong>${s.outForDelivery ?? 0}</strong></div>
    <div class="kpi-card"><span>100m Alerts</span><strong>${s.notified100mCount ?? 0}</strong></div>
    <div class="kpi-card"><span>Delivered</span><strong>${s.deliveredCount ?? 0}</strong></div>
    <div class="kpi-card"><span>Active Photos</span><strong>${s.activeProofCount ?? 0}</strong></div>
    <div class="kpi-card"><span>Purged (&gt;7d)</span><strong>${s.purgedProofCount ?? 0}</strong></div>
  `;

  renderRadarSvg();

  els.adminNotifs.innerHTML = state.notifications.length
    ? state.notifications.map((n) => `
        <li class="feed-item">
          <div><strong>[${escapeHtml(n.tiffinId)}] ${escapeHtml(n.title)}</strong> • ${escapeHtml(n.customerPhone)}</div>
          <div>${escapeHtml(n.message)}</div>
          <div class="feed-time">${new Date(n.sentAt).toLocaleString()}</div>
        </li>
      `).join('')
    : '<li class="muted">No arrival or delivery notices sent yet.</li>';

  els.retentionBody.innerHTML = state.deliveries.map((d) => {
    const safeId = escapeHtml(d.id);
    let statusBadge = '<span class="badge badge-pending">Pending Drop</span>';
    if (d.proofImage) statusBadge = '<span class="badge badge-delivered">Active Photo</span>';
    else if (d.proofPurgedAt) statusBadge = '<span class="badge badge-purged">Purged (&gt;7d)</span>';

    return `
      <tr>
        <td class="mono"><strong>${safeId}</strong></td>
        <td>${escapeHtml(d.customerName)}</td>
        <td>${statusBadge}</td>
        <td class="mono">${d.proofHash ? `${escapeHtml(d.proofHash.slice(0, 14))}...` : '--'}</td>
        <td>${d.proofImage ? escapeHtml(formatRetentionCountdown(d.retentionExpiresAt)) : (d.proofPurgedAt ? `Purged ${new Date(d.proofPurgedAt).toLocaleDateString()}` : '--')}</td>
        <td>
          ${d.proofImage ? `<button type="button" class="btn btn-outline btn-sm" onclick="runRetentionSweep('${safeId}')">Simulate 8d Expiry &amp; Purge</button>` : '--'}
        </td>
      </tr>
    `;
  }).join('');

  els.auditLogList.innerHTML = state.auditLogs.length
    ? state.auditLogs.map((a) => `
        <li class="audit-item">
          <div><span class="mono">[${escapeHtml(a.eventType)}]</span> ${escapeHtml(a.summary)}</div>
          <span class="muted mono">${new Date(a.createdAt).toLocaleTimeString()}</span>
        </li>
      `).join('')
    : '<li class="muted">No activity recorded yet.</li>';
}

function renderAll() {
  renderDriverView();
  renderCustomerView();
  renderAdminView();
}

// Navigation tabs
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-view').forEach((v) => v.classList.remove('active'));
    btn.classList.add('active');
    state.activeTab = btn.dataset.tab;
    document.getElementById(`view-${state.activeTab}`).classList.add('active');
  });
});

// Hero simulate CTA scrolls smoothly to live console and starts simulation
const heroSimBtn = document.getElementById('hero-simulate-btn');
if (heroSimBtn) {
  heroSimBtn.addEventListener('click', () => {
    document.getElementById('live-workspace').scrollIntoView({ behavior: 'smooth' });
    simulateRouteApproach();
  });
}

// Driver GPS & Controls
document.getElementById('start-tracking-btn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('Geolocation is unavailable on this browser.', true);
    return;
  }
  stopSimulation();
  if (state.watchId !== null) navigator.geolocation.clearWatch(state.watchId);

  els.gpsStatus.textContent = 'GPS: Acquiring...';
  state.watchId = navigator.geolocation.watchPosition(
    (pos) => postDriverLocation(pos.coords.latitude, pos.coords.longitude),
    (err) => {
      els.gpsStatus.textContent = 'GPS: Error';
      showToast(`GPS error: ${err.message}`, true);
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
});

document.getElementById('simulate-approach-btn').addEventListener('click', () => simulateRouteApproach());

document.getElementById('reset-demo-btn').addEventListener('click', async () => {
  stopSimulation();
  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }
  const res = await fetch('/api/deliveries/reset', { method: 'POST' });
  const data = await res.json();
  applySnapshot(data);
  showToast('Route reset. Ready to test 100m alerts and photo proof.');
});

els.orderSearch.addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  renderDriverView();
});

els.statusFilter.addEventListener('change', (e) => {
  state.statusFilter = e.target.value;
  renderDriverView();
});

// Order Lookup listeners
els.customerSelect.addEventListener('change', (e) => {
  state.selectedCustomerId = e.target.value;
  renderCustomerView();
});

document.getElementById('customer-find-btn').addEventListener('click', () => {
  const id = els.customerSearch.value.trim().toUpperCase();
  if (!id) return;
  if (!state.deliveries.some((d) => d.id === id)) {
    showToast(`Order ${id} not found.`, true);
    return;
  }
  state.selectedCustomerId = id;
  renderCustomerView();
});

// Camera modal listeners
document.getElementById('close-camera-btn').addEventListener('click', closeLiveCamera);
document.getElementById('snap-photo-btn').addEventListener('click', captureWatermarkedProof);
document.getElementById('switch-camera-btn').addEventListener('click', async () => {
  state.cameraFacingMode = state.cameraFacingMode === 'environment' ? 'user' : 'environment';
  await startCameraStream();
});

// Kitchen Ledger modal & retention actions
document.getElementById('open-new-order-btn').addEventListener('click', () => {
  els.newOrderModal.classList.remove('hidden');
});
document.getElementById('close-new-order-btn').addEventListener('click', () => {
  els.newOrderModal.classList.add('hidden');
});
document.getElementById('run-retention-btn').addEventListener('click', () => runRetentionSweep());

document.getElementById('use-driver-coords-btn').addEventListener('click', () => {
  if (!state.driver) return;
  document.getElementById('new-lat').value = (state.driver.lat + 0.0005).toFixed(6);
  document.getElementById('new-lng').value = (state.driver.lng + 0.0005).toFixed(6);
});

els.newOrderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    customerName: document.getElementById('new-customer-name').value,
    customerPhone: document.getElementById('new-customer-phone').value,
    address: document.getElementById('new-address').value,
    mealPlan: document.getElementById('new-meal-plan').value,
    lat: Number(document.getElementById('new-lat').value),
    lng: Number(document.getElementById('new-lng').value),
    notes: document.getElementById('new-notes').value
  };

  const res = await fetch('/api/deliveries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || 'Could not create order', true);
    return;
  }

  els.newOrderModal.classList.add('hidden');
  els.newOrderForm.reset();
  showToast(`Added order ${data.delivery.id} for ${data.delivery.customerName}.`);
  applySnapshot(data);
});

function connectSse() {
  const sse = new EventSource('/api/events');
  sse.addEventListener('connected', () => {
    els.sseStatus.innerHTML = '<span class="status-dot"></span>Live Sync';
    els.sseStatus.classList.remove('offline');
  });
  sse.addEventListener('state_update', (ev) => {
    try {
      applySnapshot(JSON.parse(ev.data));
    } catch {}
  });
  sse.addEventListener('retention_purged', () => fetchSnapshot());
  sse.onerror = () => {
    els.sseStatus.innerHTML = '<span class="status-dot"></span>Reconnecting';
    els.sseStatus.classList.add('offline');
  };
}

window.handleFileProofSubmit = handleFileProofSubmit;
window.openLiveCamera = openLiveCamera;
window.jumpNearOrder = jumpNearOrder;
window.runRetentionSweep = runRetentionSweep;

initScrollReveals();
updateScrollEffects();
fetchSnapshot();
connectSse();
