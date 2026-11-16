# Template Builder v1.1.0 — Upgrade / acceptance guide

**Source date:** 16 November 2026. This is a **source release candidate**, not a verified production deployment. It is based on the uploaded `8.nvent-eu-cra-template-builder.zip` and 15 November Supabase snapshot, not live database introspection.

## Scope of code changes

- Four new draft-only removal controls: Domain, Contributor, Tool Instance, Domain Review Stage. The view hierarchy/ordering and existing horizontal contributor / vertical tools layout were deliberately retained.
- One modal for authoring inline question options. For `YES_NO`, Yes/No options are provisioned with stable values `YES` and `NO` when creating the question. Other option-based types use the actual `cra_tm_question_types.supports_options` and `.supports_multiple_values` settings. Existing option identifiers remain immutable; defaults, hints and option labels can be edited.
- Conditional editor uses source question, type-specific operators, and answer-option IDs via the existing `cra_tm_set_condition_answer_options` function. The original JSON-based risk/issue rule editor is retained.
- Preview now loads condition-option mappings and applies SHOW as an inclusion condition. The contributor-switch preview state is reset. This is still a **local simulation**, not regulatory sign-off or live assessment execution.
- Option/condition/rule delete buttons are included because otherwise parent deletion can be blocked by rule references. Existing tool/section/question editor remains available.

## Database changes and activation

1. **Back up the current WeWeb source and Supabase test project.** Check `cra_tm_*` tables/constraints, 3A domain-stage tables and grants against the 15-Nov reference. DO NOT run migration blindly in a production project.
2. In a **separate Supabase test project** run `sql/01_draft_deletion_rpc_v1_1.sql` using the SQL Editor after reviewing it. It defines `cra_tm_delete_draft_item(...)`. It changes no FK constraints, does not delete audit records, and refuses non-DRAFT deletion. It is transactional (a failed FK/guard rolls the request back).
3. The function's EXECUTE permission is granted **only to `authenticated` by default**. Since this component currently sends only a publishable key and has no Supabase Auth, its deletion calls will be denied until proper authentication + server-side policies are implemented. For **disposable/private development testing ONLY**, `sql/02_TEST_ONLY_anon_deletion_grant.sql` can temporarily allow anonymous execution, assuming existing table privileges; **revoke that grant immediately after testing. Never enable it on a public or shared Supabase project.** An anonymous grant is not safe for production.
4. Import the updated GitHub repository as a new coded-component version in WeWeb; retain the prior component/repository version as a rollback option. Update the WeWeb page component version and test privately.
5. Use the *existing* Tools Catalogue v2.1.0; this package does not redeploy it or change its tool metadata schema.

## Known backend constraints

- The supplied database has `ON DELETE RESTRICT` relationships and `cra_tm_tool_configuration_history.tool_instance_id` is a non-null FK to tool instances. **Every tool instance created through the existing save RPC receives immutable CREATE history.** Therefore physical removal of populated/audited tool instances, and removal of contributors/domains containing them, can be blocked **by design**. The new RPC returns an explanatory error and does not erase history. Resolving actual removal of audited tools requires an approved archival/tombstone policy and compatible changes to snapshots, validation and execution—not bypassing FK protections.
- A question with existing options cannot be converted between option-bearing and option-free types in this release. The UI refuses the incompatible transition. Author a new question or design a governed conversion with explicit reference migration.
- New-question/answer-option saving currently invokes existing RPCs sequentially. If the network fails between calls, the question and some options may have saved; **refresh the draft before retrying**. A dedicated atomic save-question-with-options RPC is recommended before enterprise use.
- Domain-shared approval-stage configuration is still **not published** in the supplied snapshot/clone/full-validation pipeline. The existing block on publishing templates with these stages is intentionally retained; v1.1.0 does not silently bypass it.
- Supabase Auth and RLS remain outstanding. A publishable key with anonymous write grants is for an isolated development project only. Server-side authorization, auditing and test migration verification are mandatory prior to production.

## Test checklist

1. `npm test` locally. Inspect `package.json` (version 1.1.0); validate WeWeb import/build. The automated tests here are JS/static contracts, not database integration tests.
2. Draft with no children: delete Domain, and confirm it disappears after reload. Confirm same operation is rejected for a published version.
3. Add a contributor without tools; delete it. Add a review stage with mapped reviewer teams; delete stage and verify mappings are removed. Run with all required database permissions.
4. Add a tool instance with questions/options; try to delete it: expect a retained-history guard if applicable. Do not remove history to make the test pass.
5. Add questions of `YES_NO`, `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `TEXT`, `NUMBER` and `DATE`: verify correct editor, defaults, validation and preview. Create two YES/NO answers and save them together.
6. Use a YES_NO question as the source for a SHOW condition; select option YES using the visual condition builder; verify NO hides the question, YES shows it in Preview and condition-option mappings exist.
7. Verify question/option codes are stable, submitted/history data and published snapshots are unchanged, catalogue releases are not deleted, and contributor horizontal / tools vertical layouts remain identical.
8. Verify failure behavior: an FK-protected deletion must not partly remove children. Check audit and configuration-revision changes.
9. Verify the old publication blocker remains in place for domain-shared stages. Until the snapshot/clone/validation integration is addressed, this is expected.

## Git steps (from the extracted repo root)

```powershell
git status
git add .
git commit -m "Upgrade Template Builder to v1.1.0 - draft delete actions and dynamic questions"
git push origin main
```

If the extracted directory has **no `.git` folder**, first `git clone` the existing Template Builder repository into a new directory, copy the extracted files **into the cloned repository root**, and then run the commands. Preserve existing Git history; do not force push.
