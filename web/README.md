# Graviton Developer Cockpit & Web Agent (V5.1.1)

This directory contains the local developer cockpit, live documentation, and real-time streaming Web Agent for Graviton V5.1.1.

## Running the Web Agent Locally (100% Zero-Dependency)

No external `npm install` needed. Run directly using pure Node.js stdlib:

```bash
# Launch from root using Graviton CLI:
grav agent

# Or run directly from web/:
cd web
npm start
```

Open your browser at `http://localhost:3000` to view the interactive developer cockpit and IDE.
*Note: If port 3000 is occupied, the server automatically shifts to the next open port (3001, 3002, etc.) to prevent collisions.*