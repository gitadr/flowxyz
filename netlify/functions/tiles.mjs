// Nearmap tile proxy. Keeps NEARMAP_API_KEY server-side so it never ships
// in the client bundle. Configure the key in Netlify environment variables
// (no VITE_ prefix — it must not be exposed to the build).

const UPSTREAM = "https://api.nearmap.com/tiles/v3/Vert"

export default async (req, context) => {
  const key = process.env.NEARMAP_API_KEY
  if (!key) {
    return new Response("Tile proxy not configured", { status: 503 })
  }

  const { z, x, y } = context.params
  if (![z, x, y].every((v) => /^\d+$/.test(v))) {
    return new Response("Bad tile coordinates", { status: 400 })
  }

  // Light abuse protection: if a Referer is present, it must be this site.
  const referer = req.headers.get("referer")
  if (referer && new URL(referer).host !== new URL(req.url).host) {
    return new Response("Forbidden", { status: 403 })
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
