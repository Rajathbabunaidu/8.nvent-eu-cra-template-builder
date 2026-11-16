-- nVent EU CRA Template Builder 1.1.1: audit-preserving draft removal.
-- Prerequisite: removed_at TIMESTAMPTZ on domains, contributors, tools, stages.
-- Test DB only until authorization / RLS and publication integrations are reviewed.
-- This is a NEW RPC. It deliberately does not alter the v1.1.0 physical-delete RPC
-- used for OPTION, CONDITION and CONDITIONAL records.
-- The current snapshot/validation/clone functions are NOT removal-aware.
-- A separate publication trigger below denies unsafe publish while tombstones exist.
BEGIN;

CREATE OR REPLACE FUNCTION public.cra_tm_remove_draft_item(
    p_kind text,
    p_id bigint,
    p_template_version_id bigint,
    p_confirm boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
    v_kind text := pg_catalog.upper(pg_catalog.btrim(pg_catalog.coalesce(p_kind, '')));
    v_version bigint;
    v_status text;
    v_removed_at timestamptz;
    v_now timestamptz := pg_catalog.clock_timestamp();
    v_domains bigint[] := '{}'::bigint[];
    v_contributors bigint[] := '{}'::bigint[];
    v_tools bigint[] := '{}'::bigint[];
    v_stages bigint[] := '{}'::bigint[];
    v_sections bigint[] := '{}'::bigint[];
    v_questions bigint[] := '{}'::bigint[];
    v_domains_removed integer := 0;
    v_contributors_removed integer := 0;
    v_tools_removed integer := 0;
    v_stages_removed integer := 0;
BEGIN
    IF p_confirm IS DISTINCT FROM true
       OR p_id IS NULL OR p_id <= 0
       OR p_template_version_id IS NULL OR p_template_version_id <= 0 THEN
       RAISE EXCEPTION 'Explicit confirmation and positive item/version IDs are required';
    END IF;
    IF v_kind NOT IN ('DOMAIN','CONTRIBUTOR','TOOL','STAGE') THEN
       RAISE EXCEPTION 'Supported removal types are DOMAIN, CONTRIBUTOR, TOOL and STAGE';
    END IF;

    -- Resolve version from the item (never trust a version ID alone).
    IF v_kind='DOMAIN' THEN
       SELECT d.template_version_id, d.removed_at INTO v_version, v_removed_at
       FROM public.cra_tm_domains AS d WHERE d.id=p_id;
    ELSIF v_kind='CONTRIBUTOR' THEN
       SELECT d.template_version_id, c.removed_at INTO v_version, v_removed_at
       FROM public.cra_tm_contributor_assessments AS c
       JOIN public.cra_tm_domains AS d ON d.id=c.domain_id
       WHERE c.id=p_id AND d.removed_at IS NULL;
    ELSIF v_kind='TOOL' THEN
       SELECT d.template_version_id, ti.removed_at INTO v_version, v_removed_at
       FROM public.cra_tm_tool_instances AS ti
       JOIN public.cra_tm_contributor_assessments AS c ON c.id=ti.contributor_assessment_id
       JOIN public.cra_tm_domains AS d ON d.id=c.domain_id
       WHERE ti.id=p_id AND c.removed_at IS NULL AND d.removed_at IS NULL;
    ELSE
       SELECT d.template_version_id, s.removed_at INTO v_version, v_removed_at
       FROM public.cra_tm_domain_review_stages AS s
       JOIN public.cra_tm_domains AS d ON d.id=s.domain_id
       WHERE s.id=p_id AND d.removed_at IS NULL;
    END IF;

    IF v_version IS NULL THEN
       RAISE EXCEPTION '% item % does not exist under an active parent',v_kind,p_id;
    END IF;
    IF v_version <> p_template_version_id THEN
       RAISE EXCEPTION 'The selected item belongs to a different template version';
    END IF;

    -- Serializes with lifecycle transition and edit RPCs.
    SELECT vs.status_code INTO v_status
    FROM public.cra_tm_template_versions AS tv
    JOIN public.cra_tm_version_statuses AS vs ON vs.id=tv.status_id
    WHERE tv.id=v_version FOR UPDATE OF tv;
    IF v_status IS DISTINCT FROM 'DRAFT' THEN
       RAISE EXCEPTION 'Only a DRAFT template version may be modified';
    END IF;
    IF v_removed_at IS NOT NULL THEN
       RAISE EXCEPTION 'The selected % was already removed from this draft',v_kind;
    END IF;

    IF v_kind='DOMAIN' THEN
       v_domains:=ARRAY[p_id];
       SELECT pg_catalog.coalesce(pg_catalog.array_agg(c.id), '{}'::bigint[])
       INTO v_contributors FROM public.cra_tm_contributor_assessments AS c
       WHERE c.domain_id=ANY(v_domains);
       SELECT pg_catalog.coalesce(pg_catalog.array_agg(s.id), '{}'::bigint[])
       INTO v_stages FROM public.cra_tm_domain_review_stages AS s
       WHERE s.domain_id=ANY(v_domains);
    ELSIF v_kind='CONTRIBUTOR' THEN
       v_contributors:=ARRAY[p_id];
    ELSIF v_kind='TOOL' THEN
       v_tools:=ARRAY[p_id];
    ELSE
       v_stages:=ARRAY[p_id];
    END IF;

    IF v_kind IN ('DOMAIN','CONTRIBUTOR') THEN
       SELECT pg_catalog.coalesce(pg_catalog.array_agg(ti.id), '{}'::bigint[])
       INTO v_tools FROM public.cra_tm_tool_instances AS ti
       WHERE ti.contributor_assessment_id=ANY(v_contributors);
    END IF;
    IF v_kind IN ('DOMAIN','CONTRIBUTOR','TOOL') THEN
       SELECT pg_catalog.coalesce(pg_catalog.array_agg(s.id), '{}'::bigint[])
       INTO v_sections FROM public.cra_tm_tool_sections AS s
       WHERE s.tool_instance_id=ANY(v_tools);
       SELECT pg_catalog.coalesce(pg_catalog.array_agg(q.id), '{}'::bigint[])
       INTO v_questions FROM public.cra_tm_tool_questions AS q
       WHERE q.tool_section_id=ANY(v_sections);
    END IF;

    -- Never hide a live assessment behind a draft edit.
    IF EXISTS (SELECT 1 FROM public.cra_am_domain_instances a
               WHERE a.template_domain_id=ANY(v_domains))
       OR EXISTS (SELECT 1 FROM public.cra_am_contributor_instances a
                  WHERE a.template_contributor_assessment_id=ANY(v_contributors))
       OR EXISTS (SELECT 1 FROM public.cra_am_tool_runs a
                  WHERE a.template_tool_instance_id=ANY(v_tools))
       OR EXISTS (SELECT 1 FROM public.cra_am_submission_items a
                  WHERE a.template_question_id=ANY(v_questions))
       OR EXISTS (SELECT 1 FROM public.cra_am_response_revisions a
                  WHERE a.template_question_id=ANY(v_questions))
       OR EXISTS (SELECT 1 FROM public.cra_am_reassessment_request_items a
                  WHERE a.template_question_id=ANY(v_questions))
       OR EXISTS (SELECT 1 FROM public.cra_am_domain_review_stage_runs a
                  WHERE a.template_domain_review_stage_id=ANY(v_stages))
       OR EXISTS (SELECT 1 FROM public.cra_am_domain_reviewer_assignments a
                  WHERE a.template_domain_review_stage_id=ANY(v_stages))
    THEN
       RAISE EXCEPTION 'Removal blocked: assessment execution, responses, or reviewer history reference this item';
    END IF;

    -- Polymorphic conditional references have no FK; catch them explicitly.
    IF EXISTS (
       SELECT 1 FROM public.cra_tm_conditional_rules r
       WHERE r.template_version_id=v_version AND (
         (r.target_type='DOMAIN' AND r.target_id=ANY(v_domains)) OR
         (r.target_type='CONTRIBUTOR' AND r.target_id=ANY(v_contributors)) OR
         (r.target_type='TOOL_INSTANCE' AND r.target_id=ANY(v_tools)) OR
         (r.target_type='TOOL_SECTION' AND r.target_id=ANY(v_sections)) OR
         (r.target_type='QUESTION' AND r.target_id=ANY(v_questions))
       )
    ) THEN
       RAISE EXCEPTION 'Remove conditional rules targeting this item or its descendants first';
    END IF;
    IF EXISTS (
       SELECT 1 FROM public.cra_tm_conditional_rule_conditions cc
       JOIN public.cra_tm_conditional_rules r ON r.id=cc.conditional_rule_id
       WHERE r.template_version_id=v_version AND (
          (cc.source_type IN ('QUESTION','FORM_FIELD') AND cc.source_id=ANY(v_questions)) OR
          (cc.source_type='TOOL_OUTPUT' AND cc.source_id=ANY(v_tools))
       )
    ) THEN
       RAISE EXCEPTION 'Remove conditional rule conditions using this item or its descendants first';
    END IF;
    IF EXISTS (
       SELECT 1 FROM public.cra_tm_reviewable_items ri
       WHERE (ri.item_type='CONTRIBUTOR_ASSESSMENT' AND ri.target_id=ANY(v_contributors))
          OR (ri.item_type='TOOL_INSTANCE' AND ri.target_id=ANY(v_tools))
          OR (ri.item_type='TOOL_SECTION' AND ri.target_id=ANY(v_sections))
          OR (ri.item_type='TOOL_QUESTION' AND ri.target_id=ANY(v_questions))
    ) OR EXISTS (
       SELECT 1 FROM public.cra_tm_review_stages rs
       WHERE rs.contributor_assessment_id=ANY(v_contributors)
    ) THEN
       RAISE EXCEPTION 'Legacy reviewer configuration still references this hierarchy; reconcile it before removal';
    END IF;

    -- Atomic, non-destructive updates; retain sections, questions, teams, history, etc.
    UPDATE public.cra_tm_tool_instances ti
       SET removed_at=v_now
     WHERE ti.id=ANY(v_tools) AND ti.removed_at IS NULL;
    GET DIAGNOSTICS v_tools_removed=ROW_COUNT;

    UPDATE public.cra_tm_contributor_assessments c
       SET removed_at=v_now
     WHERE c.id=ANY(v_contributors) AND c.removed_at IS NULL;
    GET DIAGNOSTICS v_contributors_removed=ROW_COUNT;

    UPDATE public.cra_tm_domain_review_stages s
       SET removed_at=v_now
     WHERE s.id=ANY(v_stages) AND s.removed_at IS NULL;
    GET DIAGNOSTICS v_stages_removed=ROW_COUNT;

    UPDATE public.cra_tm_domains d
       SET removed_at=v_now
     WHERE d.id=ANY(v_domains) AND d.removed_at IS NULL;
    GET DIAGNOSTICS v_domains_removed=ROW_COUNT;

    RETURN pg_catalog.jsonb_build_object(
       'removed',true, 'kind',v_kind,'item_id',p_id,
       'template_version_id',v_version,
       'removed_at',v_now,
       'affected',pg_catalog.jsonb_build_object(
         'domains',v_domains_removed,
         'contributors',v_contributors_removed,
         'tools',v_tools_removed,
         'stages',v_stages_removed
       )
    );
END;
$function$;

-- Restore the last removed group using its shared removed_at timestamp.
-- Restoring a parent does NOT restore children removed in an earlier operation.
CREATE OR REPLACE FUNCTION public.cra_tm_restore_draft_item(
    p_kind text,
    p_id bigint,
    p_template_version_id bigint,
    p_confirm boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
    v_kind text := pg_catalog.upper(pg_catalog.btrim(pg_catalog.coalesce(p_kind, '')));
    v_version bigint;
    v_status text;
    v_stamp timestamptz;
    v_domains bigint[] := '{}'::bigint[];
    v_contributors bigint[] := '{}'::bigint[];
    v_tools bigint[] := '{}'::bigint[];
    v_stages bigint[] := '{}'::bigint[];
    v_count integer := 0;
BEGIN
    IF p_confirm IS DISTINCT FROM true OR p_id IS NULL OR p_id <= 0
       OR p_template_version_id IS NULL OR p_template_version_id <= 0 THEN
       RAISE EXCEPTION 'Explicit confirmation and positive IDs are required';
    END IF;
    IF v_kind NOT IN ('DOMAIN','CONTRIBUTOR','TOOL','STAGE') THEN
       RAISE EXCEPTION 'Unsupported restore type: %',v_kind;
    END IF;
    IF v_kind='DOMAIN' THEN
       SELECT d.template_version_id,d.removed_at INTO v_version,v_stamp
       FROM public.cra_tm_domains d WHERE d.id=p_id;
    ELSIF v_kind='CONTRIBUTOR' THEN
       SELECT d.template_version_id,c.removed_at INTO v_version,v_stamp
       FROM public.cra_tm_contributor_assessments c
       JOIN public.cra_tm_domains d ON d.id=c.domain_id
       WHERE c.id=p_id AND d.removed_at IS NULL;
    ELSIF v_kind='TOOL' THEN
       SELECT d.template_version_id,ti.removed_at INTO v_version,v_stamp
       FROM public.cra_tm_tool_instances ti
       JOIN public.cra_tm_contributor_assessments c ON c.id=ti.contributor_assessment_id
       JOIN public.cra_tm_domains d ON d.id=c.domain_id
       WHERE ti.id=p_id AND c.removed_at IS NULL AND d.removed_at IS NULL;
    ELSE
       SELECT d.template_version_id,s.removed_at INTO v_version,v_stamp
       FROM public.cra_tm_domain_review_stages s
       JOIN public.cra_tm_domains d ON d.id=s.domain_id
       WHERE s.id=p_id AND d.removed_at IS NULL;
    END IF;
    IF v_version IS NULL THEN RAISE EXCEPTION 'Item not found under an active parent'; END IF;
    IF v_version <> p_template_version_id THEN
       RAISE EXCEPTION 'Restore item belongs to another template version';
    END IF;
    SELECT vs.status_code INTO v_status
    FROM public.cra_tm_template_versions tv
    JOIN public.cra_tm_version_statuses vs ON vs.id=tv.status_id
    WHERE tv.id=v_version FOR UPDATE OF tv;
    IF v_status IS DISTINCT FROM 'DRAFT' THEN
       RAISE EXCEPTION 'Only a DRAFT template version may be restored';
    END IF;
    IF v_stamp IS NULL THEN RAISE EXCEPTION 'Item has not been removed'; END IF;

    IF v_kind='DOMAIN' THEN
       v_domains:=ARRAY[p_id];
       SELECT pg_catalog.coalesce(pg_catalog.array_agg(c.id),'{}'::bigint[])
       INTO v_contributors FROM public.cra_tm_contributor_assessments c
       WHERE c.domain_id=p_id AND c.removed_at=v_stamp;
       SELECT pg_catalog.coalesce(pg_catalog.array_agg(s.id),'{}'::bigint[])
       INTO v_stages FROM public.cra_tm_domain_review_stages s
       WHERE s.domain_id=p_id AND s.removed_at=v_stamp;
    ELSIF v_kind='CONTRIBUTOR' THEN
       v_contributors:=ARRAY[p_id];
    ELSIF v_kind='TOOL' THEN
       v_tools:=ARRAY[p_id];
    ELSE
       v_stages:=ARRAY[p_id];
    END IF;
    IF v_kind IN ('DOMAIN','CONTRIBUTOR') THEN
       SELECT pg_catalog.coalesce(pg_catalog.array_agg(ti.id),'{}'::bigint[])
       INTO v_tools FROM public.cra_tm_tool_instances ti
       WHERE ti.contributor_assessment_id=ANY(v_contributors)
         AND ti.removed_at=v_stamp;
    END IF;

    UPDATE public.cra_tm_domains d
       SET removed_at=NULL WHERE d.id=ANY(v_domains) AND d.removed_at=v_stamp;
    GET DIAGNOSTICS v_count=ROW_COUNT;
    UPDATE public.cra_tm_contributor_assessments c
       SET removed_at=NULL WHERE c.id=ANY(v_contributors) AND c.removed_at=v_stamp;
    UPDATE public.cra_tm_domain_review_stages s
       SET removed_at=NULL WHERE s.id=ANY(v_stages) AND s.removed_at=v_stamp;
    UPDATE public.cra_tm_tool_instances ti
       SET removed_at=NULL WHERE ti.id=ANY(v_tools) AND ti.removed_at=v_stamp;

    RETURN pg_catalog.jsonb_build_object('restored',true,'kind',v_kind,
      'item_id',p_id,'template_version_id',v_version,
      'group_removed_at',v_stamp);
END;
$function$;

-- Protect publication through *any* caller, not just the WeWeb UI.
-- The existing validation/snapshot/clone routines are not removal-aware.
CREATE OR REPLACE FUNCTION public.cra_tm_block_publish_with_removed_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
   v_new_status text;
BEGIN
   IF NEW.status_id IS NOT DISTINCT FROM OLD.status_id THEN
      RETURN NEW;
   END IF;
   SELECT vs.status_code INTO v_new_status
   FROM public.cra_tm_version_statuses vs WHERE vs.id=NEW.status_id;
   IF v_new_status <> 'PUBLISHED' THEN RETURN NEW; END IF;

   IF EXISTS (SELECT 1 FROM public.cra_tm_domains d
              WHERE d.template_version_id=NEW.id AND d.removed_at IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.cra_tm_contributor_assessments c
                 JOIN public.cra_tm_domains d ON d.id=c.domain_id
                 WHERE d.template_version_id=NEW.id AND c.removed_at IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.cra_tm_tool_instances ti
                 JOIN public.cra_tm_contributor_assessments c ON c.id=ti.contributor_assessment_id
                 JOIN public.cra_tm_domains d ON d.id=c.domain_id
                 WHERE d.template_version_id=NEW.id AND ti.removed_at IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.cra_tm_domain_review_stages s
                 JOIN public.cra_tm_domains d ON d.id=s.domain_id
                 WHERE d.template_version_id=NEW.id AND s.removed_at IS NOT NULL)
   THEN
      RAISE EXCEPTION 'Publishing blocked: removed draft items are retained in the legacy snapshot/validation functions. Migrate the publication pipeline to active-row filtering first.';
   END IF;
   RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cra_tm_block_publish_with_removed_items ON public.cra_tm_template_versions;
CREATE TRIGGER trg_cra_tm_block_publish_with_removed_items
BEFORE UPDATE OF status_id ON public.cra_tm_template_versions
FOR EACH ROW
WHEN (OLD.status_id IS DISTINCT FROM NEW.status_id)
EXECUTE FUNCTION public.cra_tm_block_publish_with_removed_items();

-- Deletion is a data-changing administrative capability. It is never public by default.
REVOKE ALL ON FUNCTION public.cra_tm_remove_draft_item(text,bigint,bigint,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cra_tm_remove_draft_item(text,bigint,bigint,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.cra_tm_remove_draft_item(text,bigint,bigint,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.cra_tm_restore_draft_item(text,bigint,bigint,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cra_tm_restore_draft_item(text,bigint,bigint,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.cra_tm_restore_draft_item(text,bigint,bigint,boolean) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
