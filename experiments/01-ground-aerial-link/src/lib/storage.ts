import type { LinkedAnnotation, PhotoMeta, SessionExport } from "./types"

const KEY = "mapflow.ground-aerial-link.session"

interface StoredSession {
  photo: PhotoMeta
  links: LinkedAnnotation[]
}

export function saveSession(photo: PhotoMeta, links: LinkedAnnotation[]) {
  localStorage.setItem(KEY, JSON.stringify({ photo, links } as StoredSession))
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(KEY)
}

export function downloadExport(photo: PhotoMeta, links: LinkedAnnotation[]) {
  const payload: SessionExport = {
    schema: "mapflow.ground-aerial-link.v1",
    exportedAt: new Date().toISOString(),
    photo,
    links,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${photo.fileName.replace(/\.[^.]+$/, "")}-links.json`
  a.click()
  URL.revokeObjectURL(a.href)
}
