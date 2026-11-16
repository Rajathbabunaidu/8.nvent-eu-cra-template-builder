# nVent EU CRA Template Builder v1.1.1 — controlled draft removal

**Release date:** 16 November 2026  
**Status:** Source/test candidate. **Not** a validated production deployment.  
**Inputs:** Attached Template Builder v1.1.0 package, backend inventory dated 15 November 2026, user's live foreign-key inventory, confirmation that two tool configuration history rows blocked domain deletion, and verified creation of `removed_at` on four tables.

## Delivered

- One new **atomic, draft-only** `cra_tm_remove_draft_item` RPC for DOMAIN, CONTRIBUTOR, TOOL, and STAGE. It sets `removed_at` on the selected record and all currently active descendants; never deletes tool configuration history, answers, assessment runs, stage teams or catalogue definitions.
- Cross-reference guards for active assessment/reassessment records, domain review execution, legacy reviewable items and conditional rule targets/sources. Removing a referenced item fails with a clear message and rolls back the entire transaction.
- One new draft-only `cra_tm_restore_draft_item` RPC. Shared timestamps identify descendants removed in the same action. Previously independently removed children remain removed when a parent is restored.
- The existing v1.1.0 `cra_tm_delete_draft_item` remains available for OPTION, CONDITION, CONDITIONAL, including its original FK safeguards.
- The existing five-tab, horizontal-contributors / vertical-tools UI is preserved. The active graph, rule overview, approval-stage UI and preview now omit removed hierarchy records; a **Removed from this draft → Restore** panel is shown in the Domain Builder.
- **Fail-closed publication gate:** a new `BEFORE UPDATE OF status_id` trigger rejects publishing any template version that still contains `removed_at IS NOT NULL` in these four tables. WeWeb also blocks legacy full validation and publication while tombstones exist. This is necessary because the existing `cra_tm_build_template_snapshot`, `cra_tm_run_full_template_validation`, and `cra_tm_clone_published_version` functions from the supplied backend snapshot are *not* removal-aware. This package does **not** silently redefine those large published-data functions from an older snapshot.

## Step-by-step installation — Supabase test project only

1. Back up the current **WeWeb coded-component repository** and **Supabase test database**. Do not overwrite the prior v1.1.0 GitHub release.
2. Confirm the following columns exist and are `timestamptz`: `cra_tm_domains.removed_at`, `cra_tm_contributor_assessments.removed_at`, `cra_tm_tool_instances.removed_at`, `cra_tm_domain_review_stages.removed_at`. You have already verified all four.
3. Open **Supabase → SQL Editor** on a separate test project and run `sql/03_draft_soft_remove_rpc_v1_1_1.sql` as a complete SQL script. It creates remove/restore functions, publication trigger and authenticated-only default function grants. It does not alter existing foreign keys.
4. **Authentication:** the current publishable-key-only WeWeb connection uses the anonymous role. This will be denied by default. On an *isolated, disposable test project only*, after reviewing the implications, run `sql/04_TEST_ONLY_anon_soft_remove_grant.sql` to allow temporary anonymous execution of the new two functions. The existing anonymous grant for the old physical-delete RPC does **not** carry over automatically. Public URL/key + anonymous write privileges is unsafe for production; use real Supabase Auth and RLS for any shared or production dataset.
5. Run the verification SQL below. Export/commit the updated `src`, `tests`, `sql`, `docs` and package metadata to the **existing** GitHub repository. Import the updated component version in WeWeb, preserve the old version as rollback, and use private preview.
6. On the existing draft **Test Domain - Updated**, click **Delete domain**, type `DELETE`, and confirm. The domain should disappear from active Domain Builder and appear in **Removed from this draft**. It should *not* result in HTTP 409 due to the two retained `cra_tm_tool_configuration_history` rows, provided no other reference guard blocks it. The tool configuration audit trigger may add a *new* history row when a tool is marked removed; check that the original history IDs remain present, not that the total history count is identical.
7. Use **Restore** for the removed domain; verify domain, contributors, tools, stages previously removed in that same operation reappear and earlier independently removed children remain removed.
8. Test separately removing and restoring a contributor, a tool instance and a domain-shared approval stage. Also verify rule-reference and assessment-history rejection cases, and that previously published/assessed versions cannot be changed.

### Verification queries (read-only)

```sql
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('cra_tm_remove_draft_item','cra_tm_restore_draft_item')
ORDER BY p.proname;

SELECT tgname, tgenabled,
       pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid='public.cra_tm_template_versions'::regclass
  AND tgname='trg_cra_tm_block_publish_with_removed_items';

SELECT d.id, d.template_version_id, d.domain_name, d.removed_at
FROM public.cra_tm_domains d
WHERE d.domain_name='Test Domain - Updated'
ORDER BY d.id;

SELECT h.id, h.tool_instance_id
FROM public.cra_tm_tool_configuration_history h
JOIN public.cra_tm_tool_instances ti ON ti.id=h.tool_instance_id
JOIN public.cra_tm_contributor_assessments c ON c.id=ti.contributor_assessment_id
JOIN public.cra_tm_domains d ON d.id=c.domain_id
WHERE d.domain_name='Test Domain - Updated'
ORDER BY h.id;
```

### Known limitations and release gate

- **NOT yet publication-ready for templates containing removed records.** The preserved draft-only `removed_at` rows remain in the old raw query paths used by publication, validation and cloning. The safe gate intentionally blocks publishing them. **Do not remove/disable the trigger as a workaround.** Completing the source-compatible validation + snapshot + clone + assessment-launch integration is the next backend milestone, requiring comparison to live function definitions and test DB integration tests.
- **Contributor team uniqueness is retained:** the existing `UNIQUE(domain_id,team_id)` constraint means removing a contributor does not free that team ID to create an independent duplicate contributor in the same domain. Use **Restore** and edit the existing contributor. Do **not** drop the uniqueness constraint casually; it preserves the one-team-per-contributor design.
- Same applies to domain codes in `UNIQUE(template_version_id,domain_code)`: removal does not free historical codes. New generated codes are used rather than reusing historical IDs.
- No live Supabase migration execution, WeWeb import/build, browser acceptance testing, database integration tests or production security review were performed in generating this ZIP. The included Node tests are mocks/contract checks.
- Every action still requires server-side permission. Real role-aware Supabase Auth/RLS is required before enterprise use; a client-supplied actor ID and public publishable key do not establish identity.

## Acceptance criteria

| Case | Expected result |
|---|---|
| Remove a domain with two tool audit records | Hide entire active hierarchy; original history IDs persist; no FK cascade |
| Remove only one contributor | Other contributors remain horizontally visible and unchanged |
| Remove one tool | Other stacked tools stay visible and ordered |
| Remove a stage | Only selected stage excluded from active review workflow preview |
| Restore a parent | Restore only children stamped in the same operation |
| Remove with conditional references | Reject transaction until rules/conditions are resolved |
| Remove with actual assessment/run references | Reject and retain all records |
| Attempt removal on PUBLISHED version | Reject |
| Full validation with any removed records | Blocked in new frontend; legacy function otherwise unchanged |
| Publish with any removed records | Blocked by **database trigger**, even outside WeWeb |
| All removals restored | Existing v1.1.0 validation/publish conditions still apply, including stage integration block |
| Existing format and layout | Preserve 5 tabs, horizontal contributors, vertical tools and option-aware authoring |

## Rollback

Restore all removed items first, validate that all four tables have no relevant `removed_at IS NOT NULL` rows, and only then consider rolling back the frontend. **Do not drop the `removed_at` columns as a routine rollback step**; they contain retained lifecycle evidence. Keep the publication trigger until the actual published-data path is proven removal-aware. Revoke any temporary anonymous grants after testing:

```sql
REVOKE EXECUTE ON FUNCTION public.cra_tm_remove_draft_item(text,bigint,bigint,boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cra_tm_restore_draft_item(text,bigint,bigint,boolean) FROM anon;
NOTIFY pgrst, 'reload schema';
```

## Tests

Run `npm test` from the extracted repository root. The suite covers the existing v1.1.0 behaviors and new data-projection, restore-list, mock PostgREST graph loading, publication guard contract and UI source contract. Actual SQL functions have **not** been executed against a live PostgreSQL/Supabase instance.
