# Dabba Drop — Recurring Doorstep Dispatch, 100m Geofence & Proof Ledger

A full-stack and cross-platform (Web/PWA + iOS/Android via React Native & Expo) delivery dispatch platform engineered for daily tiffins, farm boxes, milk bottles, bakery routes, and any recurring dabba parcel.

## Core Architecture & Features

1. **Automated 100-Meter Geofence Arrival Notices**:
   - Computes exact rider-to-doorstep distance via the Haversine formula (`src/services/geofenceService.js`).
   - Automatically triggers idempotent arrival alerts once per order inside the 100-meter radius, persists events in SQLite (`notifications` + `audit_logs`), and streams live updates over Server-Sent Events (`GET /api/events`) without manual WhatsApp messaging.
2. **Watermarked Camera Proof-of-Delivery**:
   - **Web / PWA (`public/`)**: High-definition editorial product-launch interface with scroll-driven parallax, Bento showcase, rear-camera capture (`capture="environment"`), and live WebRTC camera capture that stamps the order ID, ISO timestamp, and GPS coordinates directly onto the JPEG.
   - **iOS & Android (`mobile-app/`)**: Native fullscreen `expo-camera` capture with front/rear camera toggle, instant preview, and live `expo-location` geofence tracking.
   - **Cryptographic Receipt**: Validates MIME type and file size (max 5 MB) via `multer` and records a permanent SHA-256 digest (`proofHash`).
3. **Automated 7-Day Rolling Image Retention**:
   - Enforces automatic cleanup (`src/services/retentionService.js`) on server startup, hourly, and daily at midnight (`0 0 * * *`) using `node-cron`.
   - Purges image binaries older than 7 days from `uploads/` (preserving `.gitkeep`) and logs `proof_purged_at` in SQLite while preserving lightweight audit metadata.

---

## Project Structure

```text
dabba-drop/
├── package.json
├── .env.example
├── .gitignore
├── server.js                           # Server bootstrap, cron retention & graceful shutdown
├── README.md
├── docs/                               # Stakeholder pitch deck, PDF & Word brief
│   ├── Dabba-Drop-Pitch-Deck.html
│   ├── Dabba-Drop-Expansion-Plan.pdf
│   └── Dabba-Drop-Expansion-Plan.docx
├── src/
│   ├── app.js                          # Express app factory, REST + SSE routes, Multer upload
│   ├── config/index.js                 # Environment & policy constants (100m, 7-day retention)
│   ├── db/database.js                  # Persistent SQLite schema, repositories & demo seeding
│   └── services/
│       ├── geofenceService.js          # Haversine distance, ETA & coordinate validation
│       ├── notificationService.js      # SSE broadcaster + automated notification dispatcher
│       └── retentionService.js         # 7-day disk + DB purge engine & expiry simulator
├── public/                             # Product-launch Web App & PWA
│   ├── assets/                         # High-definition culinary photography backdrops
│   ├── logo.svg                        # Bespoke Dabba Drop crest emblem
│   ├── manifest.json
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── mobile-app/                         # Cross-Platform iOS & Android App (React Native / Expo)
│   ├── package.json
│   ├── app.json                        # iOS infoPlist & Android location/camera permissions
│   ├── eas.json                        # EAS Build profiles (development / preview / production)
│   ├── App.js
│   └── src/
│       ├── config/api.js
│       ├── utils/geofence.js
│       └── components/
│           ├── OrderCard.js
│           └── CameraModal.js
├── tests/
│   └── api.test.js                     # Automated node:test integration suite
└── uploads/
    └── .gitkeep
```

---

## Quick Start (Backend & Web App)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the automated test suite:
   ```bash
   npm test
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000` in your browser.

---

## Cross-Platform Mobile App (iOS & Android)

1. Install Expo dependencies inside `mobile-app/`:
   ```bash
   cd mobile-app
   npm install
   npx expo start
   ```
2. Run on Simulator, Emulator, or Physical Device:
   - **iOS Simulator**: Press `i` (`http://localhost:3000` is preconfigured).
   - **Android Emulator**: Press `a` (`http://10.0.2.2:3000` is preconfigured).
   - **Physical Phone (Expo Go)**: Open the **Ledger & API** tab inside the app and set your server LAN IP (e.g. `http://192.168.1.50:3000`).
3. Build standalone binaries with EAS:
   ```bash
   npx eas build --platform ios --profile preview
   npx eas build --platform android --profile preview
   ```

---

## REST & SSE API Reference

| Method & Path | Purpose |
| :--- | :--- |
| `GET /api/health` | Service health, geofence radius (`100m`), retention policy (`7` days) & live stats |
| `GET /api/events` | Server-Sent Events stream (`connected`, `state_update`, `notification`, `retention_purged`) |
| `GET /api/deliveries` | Full operational snapshot (`deliveries`, `notifications`, `auditLogs`, `driver`, `stats`) |
| `GET /api/deliveries/:id` | Single dabba order details & notification history |
| `POST /api/deliveries` | Create a new dabba delivery order |
| `POST /api/driver/location` | Update rider GPS `{ lat, lng }`, calculate ETAs & fire idempotent 100m alerts |
| `POST /api/deliveries/:id/proof` | Upload camera proof (`photo` or `proofImage`), compute SHA-256 & set 7-day expiry |
| `POST /api/retention/run` | Run 7-day purge sweep (or pass `{ simulateOrderId }` to test 8-day expiry immediately) |
| `POST /api/deliveries/reset` | Reset demo SQLite data and clear uploaded demo files |
| `POST /api/orders/:orderId/location` | Mobile per-order geofence check (`{ driverLat, driverLng }`) |
| `POST /api/orders/:orderId/proof` | Mobile per-order proof upload (`proofImage`) |
