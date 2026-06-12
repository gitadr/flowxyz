# Mapflow

Spatial intelligence experiments for **mapflow.xyz**.

Mapflow is a series of small, focused prototypes exploring how aerial imagery
(Nearmap and similar) can act as the spatial reference frame for messy,
ground-level evidence: smartphone photos, field notes, sensor traces.

Each experiment is self-contained, human-in-the-loop first, and optimised for
fast iteration over automation.

## Experiments

| # | Name | Question | Status |
|---|------|----------|--------|
| 01 | [Ground ↔ Aerial Image Linking](experiments/01-ground-aerial-link/) | Can Nearmap become the spatial reference frame for ground-level photos? | Active |

## Repository conventions

- `experiments/<nn>-<short-name>/` — one directory per experiment, each with
  its own `package.json`, README, and run instructions. Experiments do not
  import from each other.
- `docs/` — shared notes, data-format specs, and decisions that span
  experiments.
- Shared code is only extracted into a common package once two or more
  experiments actually need it. Until then, duplication is fine.

## Running an experiment

```bash
cd experiments/01-ground-aerial-link
npm install
npm run dev
```

See each experiment's README for configuration (e.g. Nearmap API keys).

## Principles

1. **Human in the loop.** The operator marks, links, and corrects. Automation
   assists later, if ever.
2. **Visible state.** Everything the system believes is on screen and
   editable.
3. **Clean data capture.** Annotations export as plain JSON so future
   experiments (and models) can consume them.
4. **Small and disposable.** An experiment that answers its question is done,
   even if the code is thrown away.
