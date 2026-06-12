export interface PhotoMeta {
  fileName: string
  lat: number | null
  lng: number | null
  /** Compass heading the camera was pointing, degrees from true north. */
  headingDeg: number | null
  takenAt: string | null
}

/** Rectangle on the ground photo, normalized to 0–1 of image dimensions. */
export interface PhotoRegion {
  x: number
  y: number
  w: number
  h: number
}

export interface MapPoint {
  lat: number
  lng: number
}

/** A linked annotation: the same object marked in both views. */
export interface LinkedAnnotation {
  id: string
  label: string
  color: string
  photoRegion: PhotoRegion
  mapPoint: MapPoint
  createdAt: string
}

export interface SessionExport {
  schema: "mapflow.ground-aerial-link.v1"
  exportedAt: string
  photo: PhotoMeta
  links: LinkedAnnotation[]
}

/** Linking workflow state machine. */
export type LinkStep =
  | { mode: "idle" }
  | { mode: "draw-photo" }
  | { mode: "pick-map"; photoRegion: PhotoRegion }
