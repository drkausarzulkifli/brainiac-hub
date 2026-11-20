# Brainiac Hub — Hostinger Node.js upload

Upload brainiac-hub-hostinger-EXPRESS-KOSONG.zip using the Node.js application upload flow.

- Framework: Express
- Node.js: 24.x
- Package manager: npm
- Root directory: . (archive root)
- Build command: npm run build
- Start command: npm start
- Entry file: server.js
- Port: supplied PORT environment variable, or 3000 by default

This is a server application. Start server.js from the project root; public is the static asset folder, not the server entry directory. Do not deploy public alone through the Node.js project importer.

The ZIP contains package.json, package-lock.json, server.js, build.js and public/. Hostinger installs dependencies; node_modules is intentionally excluded.

All initial student/staff/clinical collections are empty. Data entered later is kept in browser localStorage. Simulated roles remain a demo feature; this server serves the application files and does not add login, accounts or a shared clinical database.

Validated locally on Node.js 24: build, HTTP home/assets/fonts/logo, health endpoint, server-source denial and empty initial records. Hostinger deployment is not yet verified.
