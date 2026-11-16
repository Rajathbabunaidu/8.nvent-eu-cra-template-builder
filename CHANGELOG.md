# Changelog

## v1.1.1 — 16 November 2026 (test source release candidate)

- Audit-preserving `cra_tm_remove_draft_item` for domains, contributors, tool instances and domain-shared review stages. No cascading removal of protected FK history.
- Timestamp-grouped draft restoration through `cra_tm_restore_draft_item` and a Removed Items panel.
- Active-graph projection filters removed parents and their dependent tools, sections, questions, options, rules and stage teams in editing/preview.
- Server-side publication safeguard rejects draft versions containing tombstones until legacy validation, snapshot, clone and assessment launch functions are made removal-aware; WeWeb blocks misleading legacy validation.
- Test-only optional anonymous grants are isolated; default RPC permissions remain authenticated-only.
- Added unit/mock integration and source safety checks, preserving all v1.1.0 question-editor improvements.
- **Known limitation:** This is NOT yet a publication-ready migration for drafts with removed items. See `docs/UPGRADE_AND_TEST_v1.1.1.md`.

## v1.1.0 — 16 November 2026 (source release candidate)

- Draft deletion buttons for Domain, Contributor, Tool Instance and Review Stage with explicit confirmation and a new transactional deletion RPC script.
- Inline, question-type-aware answer option editor; automatic YES_NO options for newly created questions.
- Conditional operator selection and real option-ID mapping through `cra_tm_set_condition_answer_options`.
- Corrected Preview SHOW semantics, added mapped-option evaluation and state reset on contributor switching.
- Expanded Node tests for preview logic, option handling and deletion source contracts.
- Preserved the existing layout/ordering, published-stage publication blocker and historical record protection.
- **Known limitation:** audited tool instances cannot be physically deleted under current history FK; see `docs/UPGRADE_AND_TEST_v1.1.0.md`.

## v1.0.0

Original five-tab Template Builder baseline.
