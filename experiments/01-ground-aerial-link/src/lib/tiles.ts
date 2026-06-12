const nearmapKey = import.meta.env.VITE_NEARMAP_API_KEY as string | undefined

export const usingNearmap = Boolean(nearmapKey)

export const tileLayer = usingNearmap
  ? {
      url: `https://api.nearmap.com/tiles/v3/Vert/{z}/{x}/{y}.img?apikey=${nearmapKey}`,
      attribution: "Imagery © Nearmap",
      maxZoom: 24,
      maxNativeZoom: 21,
    }
  : {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "© OpenStreetMap contributors",
      maxZoom: 22,
      maxNativeZoom: 19,
    }
