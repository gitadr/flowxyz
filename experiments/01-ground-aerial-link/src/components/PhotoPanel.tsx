import { useRef, useState } from "react"
import type { Measurement } from "../App"
import { formatDistance } from "../lib/geo"
import type { LinkedAnnotation, LinkStep, PhotoRegion } from "../lib/types"

interface Props {
  imageUrl: string
  links: LinkedAnnotation[]
  step: LinkStep
  pendingColor: string
  selectedIds: string[]
  measurement: Measurement | null
  heightEstimate: { linkId: string; meters: number } | null
  onSelect: (id: string) => void
  onRegionDrawn: (region: PhotoRegion) => void
}

interface DragState {
  x0: number
  y0: number
  x1: number
  y1: number
}

function dragToRegion(d: DragState): PhotoRegion {
  return {
    x: Math.min(d.x0, d.x1),
    y: Math.min(d.y0, d.y1),
    w: Math.abs(d.x1 - d.x0),
    h: Math.abs(d.y1 - d.y0),
  }
}

function center(r: PhotoRegion) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

export function PhotoPanel({
  imageUrl,
  links,
  step,
  pendingColor,
  selectedIds,
  measurement,
  heightEstimate,
  onSelect,
  onRegionDrawn,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const drawing = step.mode === "draw-photo"

  const toNorm = (e: React.PointerEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    }
  }

  const regions: { region: PhotoRegion; color: string; id: string | null }[] =
    links.map((l) => ({ region: l.photoRegion, color: l.color, id: l.id }))
  if (step.mode === "pick-map") {
    regions.push({ region: step.photoRegion, color: pendingColor, id: null })
  }
  if (drag) {
    regions.push({ region: dragToRegion(drag), color: pendingColor, id: null })
  }

  const measureA = measurement && center(measurement.a.photoRegion)
  const measureB = measurement && center(measurement.b.photoRegion)

  return (
    <div className="photo-panel">
      <div
        className={`photo-stage ${drawing ? "crosshair" : ""}`}
        ref={overlayRef}
        onPointerDown={(e) => {
          if (!drawing) return
          e.currentTarget.setPointerCapture(e.pointerId)
          const p = toNorm(e)
          setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
        }}
        onPointerMove={(e) => {
          if (!drag) return
          const p = toNorm(e)
          setDrag({ ...drag, x1: p.x, y1: p.y })
        }}
        onPointerUp={() => {
          if (!drag) return
          const region = dragToRegion(drag)
          setDrag(null)
          // Ignore accidental clicks; require a real box.
          if (region.w > 0.01 && region.h > 0.01) onRegionDrawn(region)
        }}
      >
        <img src={imageUrl} alt="Ground-level photo" draggable={false} />
        <svg className="photo-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
          {regions.map((r, i) => (
            <rect
              key={r.id ?? `pending-${i}`}
              x={r.region.x * 100}
              y={r.region.y * 100}
              width={r.region.w * 100}
              height={r.region.h * 100}
              fill={r.color}
              fillOpacity={r.id && selectedIds.includes(r.id) ? 0.35 : 0.15}
              stroke={r.color}
              strokeWidth={r.id && selectedIds.includes(r.id) ? 0.8 : 0.4}
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: drawing ? "none" : "auto", cursor: "pointer" }}
              onClick={() => r.id && onSelect(r.id)}
            />
          ))}
          {measureA && measureB && (
            <line
              x1={measureA.x * 100}
              y1={measureA.y * 100}
              x2={measureB.x * 100}
              y2={measureB.y * 100}
              stroke="#fff"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {heightEstimate && (() => {
            const link = links.find((item) => item.id === heightEstimate.linkId)
            if (!link) return null
            const x = (link.photoRegion.x + link.photoRegion.w) * 100
            const y1 = link.photoRegion.y * 100
            const y2 = (link.photoRegion.y + link.photoRegion.h) * 100
            return (
              <line
                x1={x}
                y1={y1}
                x2={x}
                y2={y2}
                stroke="#fff"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            )
          })()}
        </svg>
        {measureA && measureB && (
          // HTML label: SVG text would distort in the stretched viewBox.
          <div
            className="distance-label"
            style={{
              left: `${((measureA.x + measureB.x) / 2) * 100}%`,
              top: `${((measureA.y + measureB.y) / 2) * 100}%`,
            }}
          >
            {formatDistance(measurement!.meters)}
          </div>
        )}
        {heightEstimate && (() => {
          const link = links.find((item) => item.id === heightEstimate.linkId)
          if (!link) return null
          return (
            <div
              className="height-label"
              style={{
                left: `${(link.photoRegion.x + link.photoRegion.w) * 100}%`,
                top: `${link.photoRegion.y * 100}%`,
              }}
            >
              ≈ {heightEstimate.meters.toFixed(1)} m
            </div>
          )
        })()}
      </div>
    </div>
  )
}
