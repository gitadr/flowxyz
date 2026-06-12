import { useCallback, useEffect, useState } from "react"
import { PhotoPanel } from "./components/PhotoPanel"
import { MapPanel } from "./components/MapPanel"
import { LinkList } from "./components/LinkList"
import { extractPhotoMeta } from "./lib/exif"
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

export default function App() {
  const [photo, setPhoto] = useState<PhotoMeta | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [links, setLinks] = useState<LinkedAnnotation[]>([])
  const [step, setStep] = useState<LinkStep>({ mode: "idle" })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const pendingColor = COLORS[links.length % COLORS.length]

  useEffect(() => {
    if (photo) saveSession(photo, links)
  }, [photo, links])

  async function handleFile(file: File) {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageUrl(URL.createObjectURL(file))
    setLinks([])
    setStep({ mode: "idle" })
    setSelectedId(null)
    setPhoto(await extractPhotoMeta(file))
  }

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
        setSelectedId(link.id)
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

  return (
    <div className="app">
      <header>
        <h1>Mapflow · Ground ↔ Aerial Link</h1>
        <div className="meta">
          <span>{photo.fileName}</span>
          {hasLocation ? (
            <span>
              {photo.lat!.toFixed(6)}, {photo.lng!.toFixed(6)}
              {photo.headingDeg != null && ` · heading ${Math.round(photo.headingDeg)}°`}
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
            setSelectedId(null)
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
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRegionDrawn={handleRegionDrawn}
        />
        <MapPanel
          photo={photo}
          links={links}
          step={step}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMapPicked={handleMapPicked}
        />
        <aside>
          <h2>Linked objects</h2>
          <LinkList
            links={links}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRename={(id, label) =>
              setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, label } : l)))
            }
            onDelete={(id) => {
              setLinks((prev) => prev.filter((l) => l.id !== id))
              if (selectedId === id) setSelectedId(null)
            }}
          />
        </aside>
      </main>
    </div>
  )
}
