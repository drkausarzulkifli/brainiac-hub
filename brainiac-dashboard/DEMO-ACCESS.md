# Demo role simulation

Enabled at the user's request on 17 November 2026. The role switcher is labelled as a simulation, not login or real access security. Everyone using the browser shares the same demo data and can select any role. No accounts are created.

The permission matrix is centralized in `dist/demo-access.js`. Admin gets all modules. Teacher gets dashboard, students, student history, calendar, attendance, study plans, class notes and progress reports. Therapist gets dashboard, students, student history, calendar, attendance, assessments, therapy sessions and progress reports.

The UI filters menus, direct routes, shortcuts, student timeline entries and calendar clinical actions. Restricted form submissions are intercepted before application handlers. Admin-only demo reset and restricted export/assessment PDF actions are blocked. Shared student history shows all EIP, therapy, assessment and progress records to every role, including read-only report content. Opening assessment editors and other restricted modules still requires the corresponding role permission. Calendar booking management remains shared; editing an EIP booking as therapist preserves its existing study-plan reference.

Selection is stored separately as `brainiac-demo-role`. Clinical records are not deleted on role switches. A switch is blocked while a form has uncommitted edits; save or discard using existing controls first. This uses module-level permissions, not ownership restrictions to individual students or clinicians.

Before production on the eventual hosting platform, replace this with verified identity, administrator-assigned roles and server/database authorization. Hiding menus or setting a browser role is not a security boundary.

Validation: `node scripts/check-demo-access.cjs`, SOAP, navigation, save-feedback and package checks. Browser visual QA was unavailable in this session.
