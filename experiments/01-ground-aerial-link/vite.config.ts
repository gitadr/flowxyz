import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fromArrayBuffer } from "geotiff"
import { defineConfig, loadEnv, type Plugin } from "vite"
import react from "@vitejs/plugin-react"

interface Point {
  lat: number
  lng: number
}

interface CachedTransaction {
  createdAt: string
  surveyId: string
  transactionToken: string
  point: Point
  radius: number
}

const transactionCachePath = join(tmpdir(), "mapflow-nearmap-dtm-transactions.json")

function haversineMeters(a: Point, b: Point) {
  const rad = (value: number) => (value * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

function requestArea(camera: Point, objects: Point[]) {
  const points = [camera, ...objects]
  const minLat = Math.min(...points.map((point) => point.lat))
  const maxLat = Math.max(...points.map((point) => point.lat))
  const minLng = Math.min(...points.map((point) => point.lng))
  const maxLng = Math.max(...points.map((point) => point.lng))
  const point = {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  }
  const radius = Math.max(
    5,
    Math.ceil(Math.max(...points.map((candidate) => haversineMeters(point, candidate))) + 2),
  )
  return { point, radius }
}

function transactionCovers(transaction: CachedTransaction, points: Point[]) {
  const valid = Date.now() - new Date(transaction.createdAt).getTime() < 29 * 24 * 60 * 60 * 1000
  return valid && transaction.point && transaction.radius &&
    points.every((point) => haversineMeters(transaction.point, point) <= transaction.radius - 1)
}

async function readJsonBody(request: NodeJS.ReadableStream) {
  let body = ""
  for await (const chunk of request) body += chunk
  return JSON.parse(body)
}

async function readTransactionCache(): Promise<Record<string, CachedTransaction>> {
  try {
    return JSON.parse(await readFile(transactionCachePath, "utf8"))
  } catch {
    return {}
  }
}

async function writeTransactionCache(cache: Record<string, CachedTransaction>) {
  await writeFile(transactionCachePath, JSON.stringify(cache), { mode: 0o600 })
}

function mercator(point: Point) {
  const radius = 6378137
  return {
    x: radius * ((point.lng * Math.PI) / 180),
    y: radius * Math.log(Math.tan(Math.PI / 4 + (point.lat * Math.PI) / 360)),
  }
}

async function sampleDtm(buffer: ArrayBuffer, points: Point[]) {
  const tiff = await fromArrayBuffer(buffer)
  const image = await tiff.getImage()
  const [minX, minY, maxX, maxY] = image.getBoundingBox()
  const width = image.getWidth()
  const height = image.getHeight()
  const rasters = await image.readRasters({ interleave: true })
  const noData = image.getGDALNoData()

  return points.map((point) => {
    const { x, y } = mercator(point)
    const col = Math.max(0, Math.min(width - 1, Math.round(((x - minX) / (maxX - minX)) * width)))
    const row = Math.max(0, Math.min(height - 1, Math.round(((maxY - y) / (maxY - minY)) * height)))
    const value = Number(rasters[row * width + col])
    if (!Number.isFinite(value) || value === noData) throw new Error("No DTM value at point")
    return value
  })
}

function nearmapDtmPlugin(apiKey: string): Plugin {
  return {
    name: "nearmap-dtm-local-api",
    configureServer(server) {
      server.middlewares.use("/api/nearmap/dtm", async (request, response) => {
        response.setHeader("Content-Type", "application/json")
        try {
          if (!apiKey) throw new Error("VITE_NEARMAP_API_KEY is not configured")
          const { camera, objects } = (await readJsonBody(request)) as {
            camera: Point
            objects: { id: string; point: Point }[]
          }
          if (!objects.length) throw new Error("No linked objects to sample")
          const requestedPoints = [camera, ...objects.map((object) => object.point)]
          const { point, radius } = requestArea(camera, objects.map((object) => object.point))
          if (radius > 100) throw new Error("Linked objects span more than one DTM request")

          const params = new URLSearchParams({
            apikey: apiKey,
            radius: String(radius),
            resources: "raster:DetailDtm",
            dates: "single",
            filter: "allTypes",
          })
          const coverageUrl = `https://api.nearmap.com/coverage/v2/tx/point/${point.lng},${point.lat}`
          const cacheKey = createHash("sha256")
            .update(`${point.lat.toFixed(6)},${point.lng.toFixed(6)},${radius}`)
            .digest("hex")
          const cache = await readTransactionCache()
          let transaction = Object.values(cache).find((item) =>
            transactionCovers(item, requestedPoints),
          )

          if (request.method === "PUT") {
            if (transaction) {
              response.end(JSON.stringify({ cost: 0, captureDate: null, radius, cached: true }))
              return
            }
            params.set("preview", "true")
            const preview = await fetch(`${coverageUrl}?${params}`)
            if (!preview.ok) throw new Error(`Nearmap preview failed (${preview.status})`)
            const data = await preview.json()
            response.end(JSON.stringify({
              cost: data.costOfTransaction,
              captureDate: data.surveys?.[0]?.captureDate ?? null,
              radius,
            }))
            return
          }

          if (request.method !== "POST") {
            response.statusCode = 405
            response.end(JSON.stringify({ error: "Method not allowed" }))
            return
          }

          let cost = 0
          if (!transaction) {
            const coverage = await fetch(`${coverageUrl}?${params}`)
            if (!coverage.ok) throw new Error(`Nearmap transaction failed (${coverage.status})`)
            const data = await coverage.json()
            const survey = data.surveys?.find((item: { contentTypes?: string[] }) =>
              item.contentTypes?.includes("raster:DetailDtm"),
            )
            if (!survey || !data.transactionToken) throw new Error("No DTM survey available")
            transaction = {
              createdAt: new Date().toISOString(),
              surveyId: survey.id,
              transactionToken: data.transactionToken,
              point,
              radius,
            }
            cost = data.costOfTransaction
            cache[cacheKey] = transaction
            await writeTransactionCache(cache)
          }

          const rasterParams = new URLSearchParams({
            point: `${transaction.point.lng},${transaction.point.lat}`,
            radius: String(transaction.radius),
            maxSize: "512x512",
            transactionToken: transaction.transactionToken,
          })
          const raster = await fetch(
            `https://api.nearmap.com/staticmap/v3/surveys/${transaction.surveyId}/DetailDtm.tif?${rasterParams}`,
          )
          if (!raster.ok) throw new Error(`Nearmap DTM download failed (${raster.status})`)
          const [cameraGroundM, ...objectElevations] = await sampleDtm(
            await raster.arrayBuffer(),
            requestedPoints,
          )
          const objectGroundM = Object.fromEntries(
            objects.map((object, index) => [object.id, objectElevations[index]]),
          )
          response.end(JSON.stringify({ cameraGroundM, objectGroundM, cost, cached: cost === 0 }))
        } catch (error) {
          response.statusCode = 400
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : "DTM request failed" }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  return {
  // Deployed under /01-ground-aerial-link/, so asset URLs must be relative.
  base: "./",
    plugins: [react(), nearmapDtmPlugin(env.VITE_NEARMAP_API_KEY)],
  }
})
