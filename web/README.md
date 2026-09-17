# Graviton Studio & Docs (V3.0.0)

This directory contains the local web dashboard, live documentation, and generator scripts for Graviton V3.0.0.

## Running the Studio Locally

```bash
cd web
npm install
npm start
```

Open your browser at `http://localhost:3000` to view the landing page, documentation, and prompt visualizer.

## Rebuilding the Pages

If you make modifications to the generator scripts:

```bash
cd web
node scripts/build-aquamarine-pages.mjs
```