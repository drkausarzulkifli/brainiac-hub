# Code audit — 13 November 2026

Scope: the static EHR demo in dist/, persistence, class notes, legacy views, scheduling/student/staff regressions, and deployment packaging. This is a targeted audit, not an exhaustive security assessment.

## Findings fixed

| Priority | Finding | Resolution |
| --- | --- | --- |
| High | Stored text in legacy views could be interpreted as HTML (including student names in assessments). | Escape interpolated record text and avatar initials. Synthetic HTML regression passes. |
| Medium | Legacy actions reported success even when browser storage failed. | Check save result and roll back failed mutations before showing success or closing forms. |
| Medium | A failed class-note save could later display a saved timestamp/status. | Track unsaved notes and preserve the last successful timestamp through re-render. |
| Medium | Reopening a note selected the default teaching plan instead of its linked plan. | Restore selection from the active note's plan ID. |
| Medium | New notes used a fixed 11 November date. | Default to today's date in Malaysia. |
| Low | Startup accepted non-array core collections. | Validate core collection types before loading stored data. This is not deep record validation. |
| Low | Planner heading used an invalid font shorthand. | Set font family, weight and size explicitly. |

## Outstanding integration gap

Dashboard, attendance and reports still use the original sample sessions, while the dated calendar stores bookings separately. Calendar bookings therefore do not automatically populate attendance or reports. This requires a shared session model and migration; it has not been changed in this audit. The global sample-day header also remains explicitly labelled as a sample day.

## Verification

- check-audit.cjs: five reproduced failures now pass (plan selection, current date, failed-save status, HTML escaping, false success on attendance).
- check-planner.cjs, check-students.cjs and check-staff.cjs pass.
- check-package.cjs passes: manifest, all 10 asset references, syntax of all five scripts and bootstrap order.
- Browser: preload first teaching plan, create note dated 13 November 2026, reload and confirm same plan remains selected. No console errors captured in that flow.
- Existing deployment archive follows the supplied packaging helper's expected layout. No missing assets or syntax error identified as a publication cause.

## Limits

Data remains browser-local demo data; it is not a shared production EHR database. Tests use synthetic data. Cloud publication previously returned a generic failure; the underlying hosting cause remains unconfirmed. See the workspace publication status file for the latest attempt.
