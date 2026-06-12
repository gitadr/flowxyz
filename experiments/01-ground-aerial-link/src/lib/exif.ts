import exifr from "exifr"
import type { PhotoMeta } from "./types"

export async function extractPhotoMeta(file: File): Promise<PhotoMeta> {
  let lat: number | null = null
  let lng: number | null = null
  let headingDeg: number | null = null
  let takenAt: string | null = null

  try {
    const data = await exifr.parse(file, {
      pick: [
        "GPSLatitude",
        "GPSLatitudeRef",
        "GPSLongitude",
        "GPSLongitudeRef",
        "GPSImgDirection",
        "GPSDestBearing",
        "DateTimeOriginal",
      ],
      gps: true,
    })
    if (data) {
      if (typeof data.latitude === "number") lat = data.latitude
      if (typeof data.longitude === "number") lng = data.longitude
      const dir = data.GPSImgDirection ?? data.GPSDestBearing
      if (typeof dir === "number" && isFinite(dir)) headingDeg = dir
      if (data.DateTimeOriginal instanceof Date) {
        takenAt = data.DateTimeOriginal.toISOString()
      }
    }
  } catch {
    // No EXIF (screenshots, stripped images) — leave fields null.
  }

  return { fileName: file.name, lat, lng, headingDeg, takenAt }
}
