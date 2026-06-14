import exifr from "exifr"
import type { PhotoMeta } from "./types"

export async function extractPhotoMeta(
  file: File,
  imageWidth: number,
  imageHeight: number,
): Promise<PhotoMeta> {
  let lat: number | null = null
  let lng: number | null = null
  let headingDeg: number | null = null
  let hfovDeg: number | null = null
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
        "FocalLengthIn35mmFormat",
        "DateTimeOriginal",
      ],
      gps: true,
    })
    if (data) {
      if (typeof data.latitude === "number") lat = data.latitude
      if (typeof data.longitude === "number") lng = data.longitude
      const dir = data.GPSImgDirection ?? data.GPSDestBearing
      if (typeof dir === "number" && isFinite(dir)) headingDeg = dir
      const f35 = data.FocalLengthIn35mmFormat
      if (typeof f35 === "number" && f35 > 0) {
        // Use the matching side of the 36×24 mm equivalent frame after orientation.
        const frameWidthMm = imageWidth >= imageHeight ? 36 : 24
        hfovDeg = (2 * Math.atan(frameWidthMm / (2 * f35)) * 180) / Math.PI
      }
      if (data.DateTimeOriginal instanceof Date) {
        takenAt = data.DateTimeOriginal.toISOString()
      }
    }
  } catch {
    // No EXIF (screenshots, stripped images) — leave fields null.
  }

  return {
    fileName: file.name,
    lat,
    lng,
    headingDeg,
    hfovDeg,
    imageWidth,
    imageHeight,
    takenAt,
  }
}
