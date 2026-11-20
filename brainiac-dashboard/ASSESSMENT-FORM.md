# Speech and language assessment form

Based on the structure of the user-provided assessment report. No client-identifying content, clinical findings or therapist contact details from that document are included in the source or demo fixtures.

Sections: client/date/DOB/age/existing diagnosis/assigned therapist; statement of problem; background; preverbal skills; receptive language; expressive language and speech; clinical impression; recommendations; reporter details and review confirmation.

The template is for speech and language assessment, not a standardized scored instrument or occupational therapy assessment. Developmental levels and clinical conclusions are entered manually. Age is calculated from date of birth and assessment date.

Records are stored in the existing browser-local demo data. Draft saving requires a student and date. Completion additionally requires therapist, DOB, every narrative section and review confirmation. Editing clears review confirmation. Multiple dated assessments can be retained per student. An unsaved form stays in memory during in-app navigation, warns before browser exit and blocks switching to another assessment until saved.

Verified: draft save/reload/open; incomplete form validation; completion; report preview; no browser console errors in tested flow. Automated tests cover draft and completion validation, age, separate records, update-in-place, failed-save rollback and escaped output. Package/syntax checks pass. No production database or export feature added.

## Occupational Therapy — Denver II recording companion

Added a type chooser, OT-only staff selection and a separate OT schema. Legacy records without a type remain speech assessments. Denver II fields include instrument version/language, source form reference, administration language, age used and adjustment basis, the four domains (personal-social, fine motor-adaptive, language, gross motor), optional item-reference/result notes, behavior observations, clinician-entered result, follow-up and source-manual review confirmation.

This is a recording companion used alongside official Denver II materials, not the Denver II instrument or a comprehensive OT assessment. It does not reproduce the 125 items, percentile chart, norms or administration/scoring manual. No automatic clinical classification or developmental-age estimate is generated. Chronological age display is separate from the manually entered age used on the official chart. The demo prevents completion above the six-year chronological boundary; drafts remain available. Instrument suitability and any age adjustments require clinician review of the official manual.

Reference checked 14 November 2026: https://www.hogrefe.com/uk/shop/tests/child-development/denver-ii-developmental-screening-test.html — four developmental areas, 0–6 years, official kit/forms/manual and training materials.

Verification: speech regression suite; OT role isolation, required metadata, age range, manual review, follow-up date, independent record types and escaped report text; package/syntax checks. Browser tested OT type selection, draft save/reload, completion and report preview with synthetic data; no console errors captured.

## Short Sensory Profile original (1999)

Added a third assessment type, ot-ssp, restricted to Occupational Therapist selection. This recording companion preserves speech and Denver II records. It includes caregiver identity/relationship/questionnaire date, source form/manual reference, seven original SSP domains, manually entered optional raw scores/classifications, overall interpretation, OT narrative, recommendations and review confirmation. No protected questionnaire items, scoring thresholds or norms are reproduced; no totals or classifications are computed.

Age eligibility is checked on caregiver questionnaire date: third birthday through the day before the eleventh birthday (3:0–10:11). Drafts can record out-of-range ages. Completion requires source references, caregiver metadata, narrative sections and manual review. Blank scores remain missing, distinct from zero; entered scores are validated only as nonnegative integers, not interpreted clinically. This template is explicitly the original SSP, not SSP2.

Sources: Pearson original Sensory Profile page https://www.pearsonassessments.com/en-us/Store/Professional-Assessments/Behavior/Sensory-Profile-/p/100000566 ; original SSP seven subscales documented in https://pmc.ncbi.nlm.nih.gov/articles/PMC6219913/ . Consult official manual for administration, suitability, scoring and interpretation.

Verification: existing speech/Denver regressions, new SSP age boundaries, respondent dates, required metadata/review, blank/zero handling, invalid score rejection, report escaping and record type isolation all pass. Browser tested create, draft save/reload, completion and preview using synthetic data; no console errors captured. Package/syntax checks pass.
