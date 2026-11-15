# Source-grounded backend map

Primary source: uploaded `backend-reference.zip.zip` → `EU_CRA_Hub_Schema_Snapshot_2026-11-15.json`. Domain-shared additions: user-reported successful Queries `3A`–`3H`.

| UI action | Data source / RPC |
|---|---|
| Load template/version | `cra_tm_templates`, `cra_tm_template_versions`, `cra_tm_version_statuses`, `cra_tm_template_statuses` |
| Create new template | `cra_tm_create_template_draft` |
| Clone published to draft | `cra_tm_clone_published_version` |
| Draft setup metadata | guarded `PATCH cra_tm_templates` / `cra_tm_template_versions` |
| Domains | `cra_tm_domains`, `cra_tm_save_domain` |
| Contributors | `cra_tm_contributor_assessments`, `cra_tm_save_contributor_assessment` |
| Catalogue | `cra_tm_tools` + `cra_tm_tool_releases` filtered active; `cra_tm_question_types` |
| Tool instances | `cra_tm_tool_instances`, `cra_tm_save_tool_instance` |
| Sections | `cra_tm_tool_sections`, `cra_tm_save_tool_section` |
| Questions | `cra_tm_tool_questions`, `cra_tm_save_tool_question` |
| Answer options | `cra_tm_tool_answer_options`, `cra_tm_save_tool_answer_option` |
| Domain-shared stages | direct API `cra_tm_domain_review_stages` (from Query 3A) |
| Stage reviewer teams | direct API `cra_tm_domain_review_stage_teams` (from Query 3A) |
| Conditional rules | `cra_tm_conditional_rules`, `cra_tm_save_conditional_rule` |
| Conditional conditions | `cra_tm_conditional_rule_conditions`, `cra_tm_save_rule_condition` |
| Tool risk/gap/issue rules | `cra_tm_risk_issue_rules`, `cra_tm_save_risk_issue_rule` |
| Validation | `cra_tm_run_full_template_validation` → `cra_tm_template_validation_results` |
| Publish | `cra_tm_publish_template_version` gated by latest result + zero domain shared stage records + explicit publication enable |

## Status

- Source signature and data model match inspected uploaded schema. All direct REST table identifiers match the snapshot or Query 3A.
- Current sample data and anonymous role grants are **not** inspected live.
- Domain-stage CRUD is additive, but publication / clone / snapshot are **not integrated** with new stage tables. Protect against data omission.
- Conditional simulation is intentionally partial; PostgreSQL remains the validator.
- Every write requires a draft version, the explicit dev mutation toggle and any RPC-specific valid `actor_user_id`.
