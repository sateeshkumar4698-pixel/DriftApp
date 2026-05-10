import * as Location from 'expo-location';

/**
 * Haversine formula — returns distance in kilometres between two GPS coords.
 */
export function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Requests foreground location permission, then returns the current GPS fix.
 * Returns null silently if permission is denied or the request fails.
 */
export async function requestAndGetLocation(): Promise<{
  lat: number;
  lon: number;
} | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
    };
  } catch {
    return null;
  }
}

/**
 * Formats a distance in km for display.
 * < 1 km  → "0.5 km"
 * < 10 km → "2.1 km"
 * >= 10   → "12 km"
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${km.toFixed(1)} km`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
