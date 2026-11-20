# User access requirements

Requested 17 November 2026. Demo simulation is now published; this is not a production security policy.

| Module | Admin | Teacher | Therapist |
| --- | --- | --- | --- |
| Dashboard | Yes | Yes | Yes |
| Students | Yes | Yes | Yes |
| Student records | Yes | Yes | Yes |
| Staff | Yes | No | No |
| Session calendar | Yes | Yes | Yes |
| Attendance | Yes | Yes | Yes |
| Study plans | Yes | Yes | No |
| Class notes | Yes | Yes | No |
| Assessment | Yes | No | Yes |
| Therapy session | Yes | No | Yes |
| Progress Report | Yes | Yes | Yes |
| Reports (Laporan) | Yes | No | No |

Both Speech Therapists and Occupational Therapists use the Therapist role.

Current deployed app serves static assets from dist and stores records in browser localStorage. It has no active application account/role service. The app/chatgpt-auth.ts starter is not used by the static deployment.

User selected explicitly labelled demo role simulation. Published on 17 November 2026. See brainiac-dashboard/DEMO-ACCESS.md for implementation and limitations.

Enforce the same module rules at sidebar, direct routes, dashboard shortcuts, calendar actions, student-history links, exports and write operations. Account roles must be assigned by an administrator, not by the user being restricted. A real implementation must enforce data permissions in the backend, not rely on hidden menu items or localStorage roles.

Student-history cross-module visibility requires explicit treatment: access to the shared history page must not accidentally bypass restricted modules. Record ownership restrictions (own students/notes versus all) have not been specified by the user.
