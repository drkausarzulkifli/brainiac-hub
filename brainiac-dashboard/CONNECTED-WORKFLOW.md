# Connected programme and session workflow

The browser-local demo now links student programme enrolment, dated bookings, reusable study plans, EIP notes, therapy notes, assessments and progress reports.

- Student profiles select EIP, speech therapy, occupational therapy, or any combination. Legacy seed students infer their original programme until edited. New students must select at least one programme.
- Calendar placements accept students enrolled in that programme. EIP groups may optionally attach one reusable study plan; the same plan can be used by different teachers, students and dates.
- Study plans store their editable content independently of class notes. Opening an EIP booking creates or resumes one note for that booking. Study plans can be authored without any booking. Teachers may select any saved plan directly in the EIP note, independently of the slot attachment, or complete notes entirely without a plan. Optional preload copies only plan content; the booking supplies the roster, teacher, date and period. The actual session time is editable. Observations are retained when selecting or detaching a plan. Later plan changes do not modify saved note content automatically.
- Completing EIP notes requires an actual activity narrative and each child's achievement or absence. Future sessions remain drafts.
- Therapy bookings distinguish assessment and follow-up treatment. A treatment record requires a completed assessment of the same discipline for the same student on an earlier calendar date. OT accepts either supported OT assessment type. This is workflow validation, not an automatic clinical decision.
- Assessment and progress report PDFs use saved records. Editing disables export until saved. Draft PDFs are marked as drafts. PDF generation runs locally with bundled jsPDF and Noto Sans.
- Student history uses stable student IDs and shows EIP observations, therapy notes, assessments and progress reports separately from registered calendar slots. Legacy numeric class-note student IDs map through the original demo session roster.
- Slots with linked records cannot be cleared or reassigned to a different roster/staff/purpose. Previously recorded information stays associated with its original booking.

Validation: existing regression checks, connected-workflow checks for shared plan reuse, stable identity, immutable plan snapshots, discipline/date assessment gating, PDF state and record protection; browser walkthrough from enrolment to EIP note, assessment PDF download and treatment completion, followed by student history. Assessment PDF rendered and visually inspected.

Limitations: demo localStorage only, no shared database, clinician login or digital signatures. Original dashboard, attendance and aggregate report sample panels remain explicitly labelled sample data; connected individual records live in the calendar and student-history workflow. No real clinical data was copied into fixtures.

Backdated sessions are supported through the dated calendar. EIP notes, therapy records and assessments distinguish session date/time (Malaysia, +08:00) from real entry and update timestamps. New records preserve createdAt across saves. Older records without a known creation timestamp show "Tidak direkod" instead of an invented historical entry time. These are browser-device timestamps, not server-audited timestamps.

Empty Nota Kelas now shows an inline session starter rather than a preload-only message. Users can open a registered EIP session or select a date, period, teacher and students directly from this page. Saving the placement immediately opens the note form. Browser verified using a fresh origin with no saved notes/bookings, then completed a manual note without a study plan.


Explicit form saves now display a separate result dialog. Successful writes confirm browser persistence; failed storage writes retain the form and show a retry message. Validation failures explain the field issue. Keystroke autosave does not interrupt with a modal. Results are collected after event handlers finish, and failure takes precedence if one action performs multiple writes. Dialogs do not replace the editing form. Browser-verified draft/completion success and validation failure; denied storage and retry verified with the actual persistence function in regression checks.

