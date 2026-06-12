import type { MapPoint } from "./types"

const EARTH_R = 6371000

export function haversineMeters(a: MapPoint, b: MapPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.sqrt(s))
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`
}

/** Planar local offset of `p` from `origin`, in metres (east = x, north = y). */
export function toLocalMeters(origin: MapPoint, p: MapPoint): { x: number; y: number } {
  const metersPerDegLat = 111320
  const metersPerDegLng = 111320 * Math.cos((origin.lat * Math.PI) / 180)
  return {
    x: (p.lng - origin.lng) * metersPerDegLng,
    y: (p.lat - origin.lat) * metersPerDegLat,
  }
}

export function fromLocalMeters(origin: MapPoint, x: number, y: number): MapPoint {
  const metersPerDegLat = 111320
  const metersPerDegLng = 111320 * Math.cos((origin.lat * Math.PI) / 180)
  return { lat: origin.lat + y / metersPerDegLat, lng: origin.lng + x / metersPerDegLng }
}
