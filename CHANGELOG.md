# Changelog

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
