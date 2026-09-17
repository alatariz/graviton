# Graviton Studio & Docs (V3.0.0)

This directory contains the local web dashboard, live documentation, and generator scripts for Graviton V3.0.0.

## Running the Studio Locally (100% Zero-Dependency)

No external `npm install` needed! Run directly using pure Node.js stdlib:

```bash
# Launch from root using Graviton CLI:
grav web

# Or run directly from web/:
cd web
npm start
```

Open your browser at `http://localhost:3333` (or `http://localhost:3333/docs.html`) to view the interactive studio and documentation.
*Note: If port 3333 is occupied, the server automatically shifts to the next open port (3334, 3335, etc.) to prevent collisions.*

## Rebuilding the Pages

If you make modifications to the generator scripts:

```bash
cd web
node scripts/build-aquamarine-pages.mjs
```