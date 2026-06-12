// Synthetic check for the resection solver: place a camera at a known
// position/heading, project landmarks to photo fractions, then recover the
// pose from a GPS seed ~20 m off. Run: npx tsx scripts/test-resection.ts
import { solveResection } from "../src/lib/resection"
import { fromLocalMeters, haversineMeters, toLocalMeters } from "../src/lib/geo"
import type { LinkedAnnotation, MapPoint } from "../src/lib/types"

const truth: MapPoint = { lat: -33.8678, lng: 151.2123 }
const headingDeg = 91
const hfovDeg = 69

// Landmarks in local metres relative to the true camera position.
const landmarks = [
  { x: 30, y: 2 },   // ~east, near optical axis
  { x: 25, y: 14 },  // left of axis
  { x: 28, y: -12 }, // right of axis
  { x: 45, y: 6 },
]

const links: LinkedAnnotation[] = landmarks.map((lm, i) => {
  const bearing = (Math.atan2(lm.x, lm.y) * 180) / Math.PI
  let off = bearing - headingDeg
  while (off > 180) off -= 360
  while (off <= -180) off += 360
  const u = 0.5 + off / hfovDeg
  if (u < 0 || u > 1) throw new Error(`landmark ${i} outside FOV (u=${u})`)
  return {
    id: String(i),
    label: `L${i}`,
    color: "#fff",
    photoRegion: { x: u - 0.05, y: 0.4, w: 0.1, h: 0.1 },
    mapPoint: fromLocalMeters(truth, lm.x, lm.y),
    createdAt: "",
  }
})

// GPS seed ~20 m north-west of the truth.
const seed = fromLocalMeters(truth, -14, 14)

const result = solveResection(links, seed, hfovDeg)
if (!result) throw new Error("solver returned null")

const posErr = haversineMeters(truth, result)
let hErr = Math.abs(result.headingDeg - headingDeg)
if (hErr > 180) hErr = 360 - hErr

console.log(`position error: ${posErr.toFixed(2)} m`)
console.log(`heading error:  ${hErr.toFixed(2)}°`)
console.log(`rms residual:   ${result.rmsDeg.toFixed(3)}°`)
console.log(`local solution: ${JSON.stringify(toLocalMeters(truth, result))}`)

// Heading-only mode with 2 links (position stays at seed).
const r2 = solveResection(links.slice(0, 2), seed, hfovDeg)
if (!r2) throw new Error("2-link solve returned null")
console.log(`2-link heading: ${r2.headingDeg.toFixed(1)}° (seed retained: ${haversineMeters(seed, r2).toFixed(2)} m)`)

if (posErr > 1 || hErr > 1) {
  console.error("FAIL: recovery outside tolerance")
  process.exit(1)
}
console.log("PASS")
