type TileSource = {
  url: string
  attribution: string
  maxZoom: number
  maxNativeZoom: number
}

// Tile source, in order of preference:
// 1. Nearmap via the Netlify Function proxy (deployed; key stays server-side).
// 2. Nearmap direct with a key in the bundle (local dev only).
// 3. OpenStreetMap fallback.
const useProxy = import.meta.env.VITE_NEARMAP_PROXY === "true"
const nearmapKey = import.meta.env.VITE_NEARMAP_API_KEY as string | undefined

const nearmap = { attribution: "Imagery © Nearmap", maxZoom: 24, maxNativeZoom: 21 }

export const tileLayer: TileSource = useProxy
  ? { url: "/api/tiles/{z}/{x}/{y}", ...nearmap }
  : nearmapKey
    ? {
        url: `https://api.nearmap.com/tiles/v3/Vert/{z}/{x}/{y}.img?apikey=${nearmapKey}`,
        ...nearmap,
      }
    : {
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: "© OpenStreetMap contributors",
        maxZoom: 22,
        maxNativeZoom: 19,
      }

export const usingNearmap = useProxy || Boolean(nearmapKey)
