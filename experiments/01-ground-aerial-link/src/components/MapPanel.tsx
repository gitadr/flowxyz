import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { tileLayer } from "../lib/tiles"
import type { LinkedAnnotation, LinkStep, MapPoint, PhotoMeta } from "../lib/types"

interface Props {
  photo: PhotoMeta
  links: LinkedAnnotation[]
  step: LinkStep
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMapPicked: (point: MapPoint) => void
}

/** Translucent wedge showing approximate camera heading. */
function headingWedge(center: L.LatLng, headingDeg: number): L.LatLng[] {
  const spread = 25 // degrees either side
  const lengthM = 40
  const pts: L.LatLng[] = [center]
  for (let a = -spread; a <= spread; a += 5) {
    const rad = ((headingDeg + a) * Math.PI) / 180
    const dLat = (lengthM * Math.cos(rad)) / 111320
    const dLng =
      (lengthM * Math.sin(rad)) /
      (111320 * Math.cos((center.lat * Math.PI) / 180))
    pts.push(L.latLng(center.lat + dLat, center.lng + dLng))
  }
  return pts
}

export function MapPanel({ photo, links, step, selectedId, onSelect, onMapPicked }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const annotationLayerRef = useRef<L.LayerGroup | null>(null)

  // Keep latest handlers/state available to the stable map click listener.
  const stepRef = useRef(step)
  stepRef.current = step
  const onMapPickedRef = useRef(onMapPicked)
  onMapPickedRef.current = onMapPicked

  // Create the map once.
  useEffect(() => {
    const map = L.map(containerRef.current!, { zoomControl: true })
    L.tileLayer(tileLayer.url, {
      attribution: tileLayer.attribution,
      maxZoom: tileLayer.maxZoom,
      maxNativeZoom: tileLayer.maxNativeZoom,
    }).addTo(map)
    map.setView([0, 0], 2)
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (stepRef.current.mode === "pick-map") {
        onMapPickedRef.current({ lat: e.latlng.lat, lng: e.latlng.lng })
      }
    })
    annotationLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Center on the photo location when it changes.
  useEffect(() => {
    const map = mapRef.current
    if (map && photo.lat != null && photo.lng != null) {
      map.setView([photo.lat, photo.lng], 19)
    }
  }, [photo.lat, photo.lng])

  // Redraw marker, heading wedge, and linked annotations.
  useEffect(() => {
    const layer = annotationLayerRef.current
    if (!layer) return
    layer.clearLayers()

    if (photo.lat != null && photo.lng != null) {
      const pos = L.latLng(photo.lat, photo.lng)
      if (photo.headingDeg != null) {
        L.polygon(headingWedge(pos, photo.headingDeg), {
          color: "#2563eb",
          weight: 1,
          fillOpacity: 0.15,
          interactive: false,
        }).addTo(layer)
      }
      L.circleMarker(pos, {
        radius: 8,
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.9,
      })
        .bindTooltip("Photo location", { direction: "top" })
        .addTo(layer)
    }

    for (const link of links) {
      const selected = link.id === selectedId
      L.circleMarker([link.mapPoint.lat, link.mapPoint.lng], {
        radius: selected ? 10 : 7,
        color: link.color,
        weight: selected ? 3 : 2,
        fillColor: link.color,
        fillOpacity: selected ? 0.7 : 0.4,
      })
        .bindTooltip(link.label, { direction: "top" })
        .on("click", () => onSelect(link.id === selectedId ? null : link.id))
        .addTo(layer)
    }
  }, [photo, links, selectedId, onSelect])

  return (
    <div
      ref={containerRef}
      className={`map-panel ${step.mode === "pick-map" ? "crosshair" : ""}`}
    />
  )
}
