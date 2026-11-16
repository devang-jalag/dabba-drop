/**
 * Calculate great-circle distance in meters between two WGS84 coordinates.
 */
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const EARTH_RADIUS_METERS = 6371e3;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Estimate urban delivery ETA in minutes assuming ~250 meters/min rider speed.
 */
function estimateEtaMinutes(distanceMeters) {
  if (typeof distanceMeters !== 'number' || !Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(distanceMeters / 250));
}

/**
 * Validate geographic latitude/longitude pairs.
 */
function isValidCoordinate(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

module.exports = {
  getDistanceInMeters,
  estimateEtaMinutes,
  isValidCoordinate
};
