# Brainiac dashboard demo

Uses UI/UX Pro Max guidance, reviewed against the existing Airtable schema. Design-system searches were run for healthcare operations and patient-portal/EHR. The second returned Minimalism & Swiss Style, a relevant interface direction; marketing/conversion layouts were rejected as inappropriate. Dashboard layout is a deliberate custom adaptation. Calm teal palette adapted from the Medical Clinic palette; system typography fallback and DM Sans for compact operational data.

Scope: fictional data only, browser-local persistence, simulated director workflow. Not production authorization or clinical software. Navigation, filters, session details, notes, attendance, lesson-plan review, enquiries, CSV export and reset are interactive.

Tokens and responsive styling live in dist/style.css. Data and interactions live in dist/app.js; DOM text derived from user input is escaped. Native dialog provides focus containment and Escape dismissal. Mobile navigation, focus outlines and reduced-motion support included.

Deployment: dependency-free static HTML/JS in dist. The supplied Vinext starter is retained but unused: its installer could not run because npm is unavailable in this environment. Static implementation avoids that build dependency and is portable to Cloudflare. The old starter page is not deployed.

Migration: replace demo state with a backend data adapter, implement real authentication and server-enforced permissions, move files to private storage, add audit events and backup recovery, then migrate validated data. Never load real health records into this demo.
