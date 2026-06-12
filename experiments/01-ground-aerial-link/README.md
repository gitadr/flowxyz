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

## Setup

```bash
npm install
cp .env.example .env   # add your Nearmap API key
npm run dev
```

Without `VITE_NEARMAP_API_KEY` the map falls back to OpenStreetMap tiles, so
the workflow is testable without a Nearmap subscription.

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
