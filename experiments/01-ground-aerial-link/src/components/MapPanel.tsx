import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { Measurement } from "../App"
import { formatDistance } from "../lib/geo"
import type { ResectionResult } from "../lib/resection"
import { tileLayer } from "../lib/tiles"
import type { LinkedAnnotation, LinkStep, MapPoint, PhotoMeta } from "../lib/types"

interface Props {
  photo: PhotoMeta
  links: LinkedAnnotation[]
  step: LinkStep
  selectedIds: string[]
  measurement: Measurement | null
  proposal: ResectionResult | null
  onSelect: (id: string) => void
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

function addCamera(
  layer: L.LayerGroup,
  pos: L.LatLng,
  headingDeg: number | null,
  opts: { color: string; label: string; dashed?: boolean; faded?: boolean },
) {
  if (headingDeg != null) {
    L.polygon(headingWedge(pos, headingDeg), {
      color: opts.color,
      weight: 1,
      dashArray: opts.dashed ? "4 4" : undefined,
      fillOpacity: opts.faded ? 0.06 : 0.15,
      interactive: false,
    }).addTo(layer)
  }
  L.circleMarker(pos, {
    radius: opts.faded ? 5 : 8,
    color: opts.color,
    fillColor: opts.color,
    fillOpacity: opts.faded ? 0.4 : 0.9,
  })
    .bindTooltip(opts.label, { direction: "top" })
    .addTo(layer)
}

export function MapPanel({
  photo,
  links,
  step,
  selectedIds,
  measurement,
  proposal,
  onSelect,
  onMapPicked,
}: Props) {
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

  // Redraw cameras, linked annotations, measurement, and refinement proposal.
  useEffect(() => {
    const layer = annotationLayerRef.current
    if (!layer) return
    layer.clearLayers()

    if (photo.lat != null && photo.lng != null) {
      const gps = L.latLng(photo.lat, photo.lng)
      if (photo.refined) {
        addCamera(layer, gps, photo.headingDeg, {
          color: "#64748b",
          label: "GPS location (original)",
          faded: true,
        })
        addCamera(
          layer,
          L.latLng(photo.refined.lat, photo.refined.lng),
          photo.refined.headingDeg,
          { color: "#2563eb", label: "Photo location (refined)" },
        )
      } else {
        addCamera(layer, gps, photo.headingDeg, {
          color: "#2563eb",
          label: "Photo location",
        })
      }
    }

    if (proposal) {
      addCamera(layer, L.latLng(proposal.lat, proposal.lng), proposal.headingDeg, {
        color: "#f59e0b",
        label: `Refined position (fit ±${proposal.rmsDeg.toFixed(1)}°)`,
        dashed: true,
      })
    }

    if (measurement) {
      L.polyline(
        [
          [measurement.a.mapPoint.lat, measurement.a.mapPoint.lng],
          [measurement.b.mapPoint.lat, measurement.b.mapPoint.lng],
        ],
        { color: "#fff", weight: 2, dashArray: "6 4", interactive: false },
      )
        .bindTooltip(formatDistance(measurement.meters), {
          permanent: true,
          direction: "center",
          className: "distance-tooltip",
        })
        .addTo(layer)
    }

    for (const link of links) {
      const selected = selectedIds.includes(link.id)
      L.circleMarker([link.mapPoint.lat, link.mapPoint.lng], {
        radius: selected ? 10 : 7,
        color: link.color,
        weight: selected ? 3 : 2,
        fillColor: link.color,
        fillOpacity: selected ? 0.7 : 0.4,
      })
        .bindTooltip(link.label, { direction: "top" })
        .on("click", () => onSelect(link.id))
        .addTo(layer)
    }
  }, [photo, links, selectedIds, measurement, proposal, onSelect])

  return (
    <div
      ref={containerRef}
      className={`map-panel ${step.mode === "pick-map" ? "crosshair" : ""}`}
    />
  )
}
