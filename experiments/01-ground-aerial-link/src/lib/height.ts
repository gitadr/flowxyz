import type { PhotoRegion } from "./types"

const toRad = (degrees: number) => (degrees * Math.PI) / 180
const toDeg = (radians: number) => (radians * 180) / Math.PI

export interface HeightEstimateInput {
  region: PhotoRegion
  distanceM: number
  horizontalFovDeg: number
  imageWidth: number
  imageHeight: number
  cameraHeightM: number
  cameraGroundM: number
  objectGroundM: number
}

export interface HeightEstimateResult {
  heightM: number
  pitchDeg: number
  verticalFovDeg: number
}

function rayElevationDeg(y: number, verticalFovDeg: number): number {
  const halfFrame = Math.tan(toRad(verticalFovDeg) / 2)
  return toDeg(Math.atan((0.5 - y) * 2 * halfFrame))
}

/** Estimate a vertical object's height from its photo box and linked base point. */
export function estimateObjectHeight(input: HeightEstimateInput): HeightEstimateResult | null {
  if (
    input.distanceM <= 0 ||
    input.imageWidth <= 0 ||
    input.imageHeight <= 0 ||
    input.region.h <= 0
  ) {
    return null
  }

  const aspect = input.imageWidth / input.imageHeight
  const verticalFovDeg = toDeg(
    2 * Math.atan(Math.tan(toRad(input.horizontalFovDeg) / 2) / aspect),
  )
  const topRayDeg = rayElevationDeg(input.region.y, verticalFovDeg)
  const baseRayDeg = rayElevationDeg(input.region.y + input.region.h, verticalFovDeg)
  const groundDeltaM = input.objectGroundM - input.cameraGroundM
  const baseWorldDeg = toDeg(
    Math.atan2(groundDeltaM - input.cameraHeightM, input.distanceM),
  )
  const pitchDeg = baseWorldDeg - baseRayDeg
  const topElevationM =
    input.cameraGroundM +
    input.cameraHeightM +
    input.distanceM * Math.tan(toRad(pitchDeg + topRayDeg))

  const heightM = topElevationM - input.objectGroundM
  if (!Number.isFinite(heightM) || heightM <= 0) return null

  return { heightM, pitchDeg, verticalFovDeg }
}
