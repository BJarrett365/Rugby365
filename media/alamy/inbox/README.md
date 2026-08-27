# Alamy download inbox

Drop licensed Alamy downloads here (`.jpg`, `.jpeg`, `.png`, `.webp`).

Name files after the player, e.g.:

- `Abongile-Nonkontwana.jpg`
- `Jean Kleyn.jpg`

Then run:

```bash
npx tsx --require ./scripts/stub-server-only.cjs scripts/import-alamy-inbox-images.ts
```

Lightbox shortcuts are in [`lightboxes.json`](./lightboxes.json).
