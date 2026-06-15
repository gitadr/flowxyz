# Experiment 01 · Ground ↔ Aerial Image Linking

**Question:** Can Nearmap become the spatial reference frame for messy,
ground-level evidence?

A human-in-the-loop tool that links objects in a ground-level iPhone photo to
the same objects in top-down aerial imagery.

## Workflow

```text
Upload iPhone photo
→ Extract GPS / heading / timestamp from EXIF
→ Show photo beside aerial imagery centred on the photo location
→ Drag a box around an object in the photo
→ Click the same object on the map
→ Saved as a linked annotation (rename, select, delete, export)
```

The photo location is marked on the map; if the EXIF contains
`GPSImgDirection`, a wedge shows the approximate camera heading.

Two analysis tools build on the links:

- **Distance on selection** — select any two linked objects (in either view or
  the sidebar) and the ground distance between their map points (haversine)
  appears as a dashed line with a label in both the photo and the map.
- **Refine position** — with 2+ links, each link's horizontal position in the
  photo is a bearing constraint (using the field of view from the EXIF focal
  length, or an assumed 69° iPhone FOV). With 2 links the camera heading is
  re-solved; with 3+ a least-squares resection (`src/lib/resection.ts`)
  re-solves the standpoint and heading, correcting GPS error. The proposal
  shows as an amber ghost marker; accepting it records `photo.refined` in the
  session and export. Verify the solver with
  `npx tsx scripts/test-resection.ts`.

## Setup

Requires Node `^20.19.0 || >=22.12.0` (Vite 7). With `nvm`, run `nvm use` to
pick up the pinned version from `.nvmrc`.

```bash
nvm use            # Node 22 (see .nvmrc)
npm install
cp .env.example .env   # add your Nearmap API key
npm run dev
```

Tile sources:

- **Deployed (Netlify):** set `NEARMAP_API_KEY` (server-side, used by the
  `/api/tiles` proxy function in `netlify/functions/tiles.mjs`) and
  `VITE_NEARMAP_PROXY=true` (tells the client to use the proxy). The key never
  appears in the client bundle. **Do not** set `VITE_NEARMAP_API_KEY` in the
  deployed environment — that prefix bakes the key into the public bundle.
- **Local dev:** put `VITE_NEARMAP_API_KEY` in `.env` for direct Nearmap
  access, or run `netlify dev` to exercise the proxy locally.
- **No key at all:** the map falls back to OpenStreetMap tiles, so the
  workflow is testable without a Nearmap subscription.

The proxy is public, so it enforces a few abuse controls to protect the
Nearmap quota (see `netlify/functions/tiles.mjs`):

- Only valid, in-range tiles up to zoom 21 are forwarded.
- Requests must originate from this site (fail-closed on `Origin`/`Referer`).
  Set `TILE_REQUIRE_REFERER=false` to relax if legitimate clients strip the
  header.
- Optional geographic allowlist: set `TILE_BBOX="minLng,minLat,maxLng,maxLat"`
  to reject tiles outside an area of interest. Leave it unset to serve any
  location.

## Data

- The current session (photo metadata + links) autosaves to `localStorage`.
- **Export JSON** downloads a `mapflow.ground-aerial-link.v1` document:

```json
{
  "schema": "mapflow.ground-aerial-link.v1",
  "exportedAt": "…",
  "photo": { "fileName": "…", "lat": 0, "lng": 0, "headingDeg": 0, "takenAt": "…" },
  "links": [
    {
      "id": "…",
      "label": "Object 1",
      "color": "#e11d48",
      "photoRegion": { "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.25 },
      "mapPoint": { "lat": 0, "lng": 0 },
      "createdAt": "…"
    }
  ]
}
```

`photoRegion` is normalized (0–1) to the image dimensions so it survives any
display size. Photos themselves are never uploaded anywhere — everything runs
client-side.

## Notes / future directions

- Map-side annotation is a point for now; polygons are an obvious next step.
- HEIC support depends on the browser; export photos as JPEG if needed.
- Later experiments may consume the exported links as training/eval data for
  automated ground↔aerial matching.
