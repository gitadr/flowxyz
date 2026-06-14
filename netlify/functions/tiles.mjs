// Nearmap tile proxy. Keeps NEARMAP_API_KEY server-side so it never ships
// in the client bundle. Configure the key in Netlify environment variables
// (no VITE_ prefix — it must not be exposed to the build).
//
// Abuse controls (this endpoint is public and spends your Nearmap quota):
//   1. Zoom/coordinate bounds — only valid, in-range tiles are forwarded.
//   2. Fail-closed origin/referer — requests must come from this site, so a
//      bare script with no Referer is rejected (set TILE_REQUIRE_REFERER=false
//      to relax if legitimate clients strip the header).
//   3. Optional geographic allowlist — set TILE_BBOX="minLng,minLat,maxLng,maxLat"
//      to reject tiles outside your area of interest. Combined with the long
//      cache below, the set of tiles that can ever reach Nearmap is then a
//      bounded, CDN-cached universe.

const UPSTREAM = "https://api.nearmap.com/tiles/v3/Vert"

// Nearmap imagery is native to z21; Leaflet upscales beyond that and never
// requests higher tiles, so anything above is abuse or a bug.
const MAX_ZOOM = 21

/** Parsed TILE_BBOX, or null when no geographic restriction is configured. */
function parseBbox() {
  const raw = process.env.TILE_BBOX
  if (!raw) return null
  const parts = raw.split(",").map((v) => Number(v.trim()))
  if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v))) return null
  const [minLng, minLat, maxLng, maxLat] = parts
  return { minLng, minLat, maxLng, maxLat }
}

/** Lat/lng bounds of a Web Mercator tile (north/west/south/east), degrees. */
function tileBounds(z, x, y) {
  const n = 2 ** z
  const lngWest = (x / n) * 360 - 180
  const lngEast = ((x + 1) / n) * 360 - 180
  const latNorth = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI
  const latSouth = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI
  return { latNorth, latSouth, lngWest, lngEast }
}

function tileInBbox(z, x, y, bbox) {
  const t = tileBounds(z, x, y)
  // Reject only when the tile and the bbox do not overlap at all.
  return !(
    t.lngEast < bbox.minLng ||
    t.lngWest > bbox.maxLng ||
    t.latNorth < bbox.minLat ||
    t.latSouth > bbox.maxLat
  )
}

function hostOf(value) {
  if (!value) return null
  try {
    return new URL(value).host
  } catch {
    return null
  }
}

export default async (req, context) => {
  const key = process.env.NEARMAP_API_KEY
  if (!key) {
    return new Response("Tile proxy not configured", { status: 503 })
  }

  // 1. Validate coordinates: integers, in-range for the zoom, zoom bounded.
  const z = Number(context.params.z)
  const x = Number(context.params.x)
  const y = Number(context.params.y)
  const ints = [z, x, y].every((v) => Number.isInteger(v))
  if (!ints || z < 0 || z > MAX_ZOOM || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
    return new Response("Bad tile coordinates", { status: 400 })
  }

  // 2. Fail-closed origin/referer: requests must originate from this site.
  // Browser <img> tile loads send Referer (same-origin) but no Origin header;
  // scripts that omit both are rejected. Toggle off with TILE_REQUIRE_REFERER=false.
  const requireReferer = process.env.TILE_REQUIRE_REFERER !== "false"
  const selfHost = hostOf(req.url)
  const originHost = hostOf(req.headers.get("origin"))
  const refererHost = hostOf(req.headers.get("referer"))
  if (originHost) {
    if (originHost !== selfHost) return new Response("Forbidden", { status: 403 })
  } else if (refererHost) {
    if (refererHost !== selfHost) return new Response("Forbidden", { status: 403 })
  } else if (requireReferer) {
    return new Response("Forbidden", { status: 403 })
  }

  // 3. Optional geographic allowlist.
  const bbox = parseBbox()
  if (bbox && !tileInBbox(z, x, y, bbox)) {
    return new Response("Tile outside allowed area", { status: 403 })
  }

  const upstream = await fetch(`${UPSTREAM}/${z}/${x}/${y}.img?apikey=${key}`)
  if (!upstream.ok) {
    return new Response("Upstream error", { status: upstream.status })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  })
}

export const config = {
  path: "/api/tiles/:z/:x/:y",
}
