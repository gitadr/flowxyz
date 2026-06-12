import { useCallback, useEffect, useState } from "react"
import { PhotoPanel } from "./components/PhotoPanel"
import { MapPanel } from "./components/MapPanel"
import { LinkList } from "./components/LinkList"
import { extractPhotoMeta } from "./lib/exif"
import { formatDistance, haversineMeters } from "./lib/geo"
import { solveResection, type ResectionResult } from "./lib/resection"
import { clearSession, downloadExport, saveSession } from "./lib/storage"
import { usingNearmap } from "./lib/tiles"
import type {
  LinkedAnnotation,
  LinkStep,
  MapPoint,
  PhotoMeta,
  PhotoRegion,
} from "./lib/types"

const COLORS = ["#e11d48", "#f59e0b", "#10b981", "#8b5cf6", "#06b6d4", "#f97316"]

// iPhone main-lens horizontal FOV, used when EXIF lacks a focal length.
const FALLBACK_HFOV_DEG = 69

export interface Measurement {
  a: LinkedAnnotation
  b: LinkedAnnotation
  meters: number
}

export default function App() {
  const [photo, setPhoto] = useState<PhotoMeta | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [links, setLinks] = useState<LinkedAnnotation[]>([])
  const [step, setStep] = useState<LinkStep>({ mode: "idle" })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [proposal, setProposal] = useState<ResectionResult | null>(null)

  const pendingColor = COLORS[links.length % COLORS.length]

  useEffect(() => {
    if (photo) saveSession(photo, links)
  }, [photo, links])

  async function handleFile(file: File) {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageUrl(URL.createObjectURL(file))
    setLinks([])
    setStep({ mode: "idle" })
    setSelectedIds([])
    setProposal(null)
    setPhoto(await extractPhotoMeta(file))
  }

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((s) => s !== id)
        : [...prev, id].slice(-2), // keep at most 2, dropping the oldest
    )
  }, [])

  const handleRegionDrawn = useCallback((photoRegion: PhotoRegion) => {
    setStep({ mode: "pick-map", photoRegion })
  }, [])

  const handleMapPicked = useCallback(
    (mapPoint: MapPoint) => {
      setStep((s) => {
        if (s.mode !== "pick-map") return s
        const link: LinkedAnnotation = {
          id: crypto.randomUUID(),
          label: `Object ${links.length + 1}`,
          color: pendingColor,
          photoRegion: s.photoRegion,
          mapPoint,
          createdAt: new Date().toISOString(),
        }
        setLinks((prev) => [...prev, link])
        return { mode: "idle" }
      })
    },
    [links.length, pendingColor],
  )

  if (!photo || !imageUrl) {
    return (
      <div className="upload-screen">
        <h1>Mapflow · Ground ↔ Aerial Link</h1>
        <p>
          Upload an iPhone photo with GPS metadata. You’ll see it beside
          top-down imagery centred on where it was taken, and can link objects
          between the two views.
        </p>
        <label className="dropzone">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          Choose or drop a photo
        </label>
        {!usingNearmap && (
          <p className="hint">
            No Nearmap API key configured (VITE_NEARMAP_API_KEY) — the map will
            use OpenStreetMap tiles.
          </p>
        )}
      </div>
    )
  }

  const hasLocation = photo.lat != null && photo.lng != null
  const usingAssumedFov = photo.hfovDeg == null

  const selected = selectedIds
    .map((id) => links.find((l) => l.id === id))
    .filter((l): l is LinkedAnnotation => Boolean(l))
  const measurement: Measurement | null =
    selected.length === 2
      ? {
          a: selected[0],
          b: selected[1],
          meters: haversineMeters(selected[0].mapPoint, selected[1].mapPoint),
        }
      : null

  function refinePosition() {
    if (photo!.lat == null || photo!.lng == null) return
    const result = solveResection(
      links,
      { lat: photo!.lat, lng: photo!.lng },
      photo!.hfovDeg ?? FALLBACK_HFOV_DEG,
    )
    setProposal(result)
  }

  function acceptProposal() {
    if (!proposal) return
    setPhoto({
      ...photo!,
      refined: {
        lat: proposal.lat,
        lng: proposal.lng,
        headingDeg: proposal.headingDeg,
      },
    })
    setProposal(null)
  }

  const proposalMovedM =
    proposal && hasLocation
      ? haversineMeters({ lat: photo.lat!, lng: photo.lng! }, proposal)
      : 0

  return (
    <div className="app">
      <header>
        <h1>Mapflow · Ground ↔ Aerial Link</h1>
        <div className="meta">
          <span>{photo.fileName}</span>
          {hasLocation ? (
            <span>
              {(photo.refined?.lat ?? photo.lat!).toFixed(6)},{" "}
              {(photo.refined?.lng ?? photo.lng!).toFixed(6)}
              {photo.refined
                ? ` · heading ${Math.round(photo.refined.headingDeg)}° (refined)`
                : photo.headingDeg != null
                  ? ` · heading ${Math.round(photo.headingDeg)}°`
                  : ""}
            </span>
          ) : (
            <span className="warn">No GPS data in this photo</span>
          )}
          {photo.takenAt && <span>{new Date(photo.takenAt).toLocaleString()}</span>}
        </div>
      </header>

      <div className="toolbar">
        {step.mode === "idle" && (
          <button className="primary" onClick={() => setStep({ mode: "draw-photo" })}>
            Link an object
          </button>
        )}
        {step.mode === "draw-photo" && (
          <>
            <span className="instruction">
              1/2 — Drag a box around the object in the <strong>photo</strong>
            </span>
            <button onClick={() => setStep({ mode: "idle" })}>Cancel</button>
          </>
        )}
        {step.mode === "pick-map" && (
          <>
            <span className="instruction">
              2/2 — Click the same object on the <strong>map</strong>
            </span>
            <button onClick={() => setStep({ mode: "idle" })}>Cancel</button>
          </>
        )}

        {step.mode === "idle" && !proposal && (
          <button
            onClick={refinePosition}
            disabled={!hasLocation || links.length < 2}
            title={
              links.length < 2
                ? "Link at least 2 objects to refine the camera position"
                : usingAssumedFov
                  ? `Assuming ${FALLBACK_HFOV_DEG}° field of view (no focal length in EXIF)`
                  : undefined
            }
          >
            Refine position
          </button>
        )}
        {proposal && (
          <>
            <span className="instruction">
              {links.length < 3 ? "Heading" : "Position"} refined: moved{" "}
              {formatDistance(proposalMovedM)}, heading{" "}
              {Math.round(proposal.headingDeg)}°, fit ±{proposal.rmsDeg.toFixed(1)}°
              {usingAssumedFov && " (assumed FOV)"}
            </span>
            <button className="primary" onClick={acceptProposal}>
              Accept
            </button>
            <button onClick={() => setProposal(null)}>Discard</button>
          </>
        )}

        <span className="spacer" />
        <button onClick={() => downloadExport(photo, links)} disabled={links.length === 0}>
          Export JSON
        </button>
        <label className="file-button">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          New photo
        </label>
        <button
          onClick={() => {
            clearSession()
            setLinks([])
            setSelectedIds([])
            setProposal(null)
            setStep({ mode: "idle" })
          }}
        >
          Clear links
        </button>
      </div>

      <main>
        <PhotoPanel
          imageUrl={imageUrl}
          links={links}
          step={step}
          pendingColor={pendingColor}
          selectedIds={selectedIds}
          measurement={measurement}
          onSelect={toggleSelect}
          onRegionDrawn={handleRegionDrawn}
        />
        <MapPanel
          photo={photo}
          links={links}
          step={step}
          selectedIds={selectedIds}
          measurement={measurement}
          proposal={proposal}
          onSelect={toggleSelect}
          onMapPicked={handleMapPicked}
        />
        <aside>
          <h2>Linked objects</h2>
          <LinkList
            links={links}
            selectedIds={selectedIds}
            onSelect={toggleSelect}
            onRename={(id, label) =>
              setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, label } : l)))
            }
            onDelete={(id) => {
              setLinks((prev) => prev.filter((l) => l.id !== id))
              setSelectedIds((prev) => prev.filter((s) => s !== id))
            }}
          />
          {links.length >= 2 && !measurement && (
            <p className="hint">Select two objects to see the distance between them.</p>
          )}
          {measurement && (
            <p className="hint">
              {measurement.a.label} ↔ {measurement.b.label}:{" "}
              <strong>{formatDistance(measurement.meters)}</strong>
            </p>
          )}
        </aside>
      </main>
    </div>
  )
}
