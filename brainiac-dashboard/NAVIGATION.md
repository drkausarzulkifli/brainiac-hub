# Back and Discard controls

Every section has a Back control, using in-app section history for the current page session; direct entry falls back to Dashboard. Dashboard Back is disabled when no previous section exists. Assessment editor Back returns to the assessment list before returning to a previous section.

Assessment forms have explicit Back-to-list and Discard controls. Discard clears only the working copy, preserving saved assessments. Section navigation prompts if the active assessment has unsaved edits. Modal forms (student, staff, planner, session notes and lesson-plan feedback) have Back/Discard controls; changed values prompt on Back, Cancel, close, or Escape. A separate confirmation dialog preserves the original input when continuing editing.

Class notes retain autosave, with an in-memory editing baseline. Discard restores the note at the start of this editing session, or removes a newly created auto-draft until it is explicitly saved. Simpan draf / Tandakan lengkap establishes a new baseline. Failed rollback storage preserves the working state and displays an error. After a browser reload, the persisted note is the new baseline.

Verified with synthetic data: section history, assessment draft return to list, modal keep/discard, sidebar navigation guard, class-note auto-draft discard, preservation of saved records, rollback on storage failure, syntax/package validation. Browser flow captured no console errors.
