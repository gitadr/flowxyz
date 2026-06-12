import { fromLocalMeters, toLocalMeters } from "./geo"
import type { LinkedAnnotation, MapPoint } from "./types"

export interface ResectionResult {
  lat: number
  lng: number
  headingDeg: number
  /** RMS angular residual of the fit, degrees. */
  rmsDeg: number
}

interface Observation {
  /** Landmark position in local metres around the seed. */
  x: number
  y: number
  /** Horizontal photo fraction of the object center (0 = left, 1 = right). */
  u: number
}

const toRad = (d: number) => (d * Math.PI) / 180
const toDeg = (r: number) => (r * 180) / Math.PI

/** Smallest signed angular difference a - b, radians in (-π, π]. */
function angleDiff(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= 2 * Math.PI
  while (d <= -Math.PI) d += 2 * Math.PI
  return d
}

/**
 * Predicted vs observed bearing residuals for a camera at (cx, cy) with
 * heading h (radians, compass). Observation u maps to a bearing offset of
 * (u - 0.5) * hfov from the optical axis.
 */
function residuals(obs: Observation[], cx: number, cy: number, h: number, hfov: number): number[] {
  return obs.map((o) => {
    const predicted = Math.atan2(o.x - cx, o.y - cy) // compass bearing
    const observed = h + (o.u - 0.5) * hfov
    return angleDiff(predicted, observed)
  })
}

function rms(r: number[]): number {
  return Math.sqrt(r.reduce((s, v) => s + v * v, 0) / r.length)
}

/** Best heading for a fixed position (circular mean of per-landmark headings). */
function bestHeading(obs: Observation[], cx: number, cy: number, hfov: number): number {
  let sx = 0
  let sy = 0
  for (const o of obs) {
    const h = Math.atan2(o.x - cx, o.y - cy) - (o.u - 0.5) * hfov
    sx += Math.cos(h)
    sy += Math.sin(h)
  }
  return Math.atan2(sy, sx)
}

/**
 * Solve camera standpoint + heading from ground↔aerial links.
 * - 2 links: heading only (position held at the GPS seed).
 * - 3+ links: position + heading via coordinate descent over a shrinking
 *   grid (robust, no derivatives, fast at this problem size).
 * Returns null if there are fewer than 2 usable links.
 */
export function solveResection(
  links: LinkedAnnotation[],
  seed: MapPoint,
  hfovDeg: number,
): ResectionResult | null {
  if (links.length < 2) return null
  const hfov = toRad(hfovDeg)
  const obs: Observation[] = links.map((l) => ({
    ...toLocalMeters(seed, l.mapPoint),
    u: l.photoRegion.x + l.photoRegion.w / 2,
  }))

  let cx = 0
  let cy = 0
  let h = bestHeading(obs, cx, cy, hfov)

  if (links.length >= 3) {
    // Coordinate descent: search positions on a grid around the current
    // estimate, with the heading set optimally for each candidate.
    let stepM = 16
    while (stepM > 0.05) {
      let improved = true
      while (improved) {
        improved = false
        let best = rms(residuals(obs, cx, cy, h, hfov))
        for (const [dx, dy] of [
          [stepM, 0],
          [-stepM, 0],
          [0, stepM],
          [0, -stepM],
          [stepM, stepM],
          [stepM, -stepM],
          [-stepM, stepM],
          [-stepM, -stepM],
        ]) {
          const nx = cx + dx
          const ny = cy + dy
          // Don't wander more than ~80 m from the GPS seed; beyond that the
          // fit is more likely degenerate than the GPS is wrong.
          if (Math.hypot(nx, ny) > 80) continue
          const nh = bestHeading(obs, nx, ny, hfov)
          const r = rms(residuals(obs, nx, ny, nh, hfov))
          if (r < best) {
            best = r
            cx = nx
            cy = ny
            h = nh
            improved = true
          }
        }
      }
      stepM /= 2
    }
  }

  const pos = fromLocalMeters(seed, cx, cy)
  const headingDeg = ((toDeg(h) % 360) + 360) % 360
  return { ...pos, headingDeg, rmsDeg: toDeg(rms(residuals(obs, cx, cy, h, hfov))) }
}
