-- Template Builder v1.1.0: transactional, draft-only deletion.
-- Review in a SEPARATE Supabase test project before applying. No existing tables
-- or FK rules are changed. SECURITY INVOKER: caller still needs table privileges.
-- Does not delete external audit/history rows and intentionally refuses any
-- referenced record instead of weakening retention constraints.
CREATE OR REPLACE FUNCTION public.cra_tm_delete_draft_item(
  p_kind text,
  p_id bigint,
  p_template_version_id bigint,
  p_confirm boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $$
DECLARE
  v_kind text := upper(btrim(coalesce(p_kind,'')));
  v_version bigint;
  v_status text;
  v_domains bigint[] := '{}'::bigint[];
  v_contributors bigint[] := '{}'::bigint[];
  v_instances bigint[] := '{}'::bigint[];
  v_sections bigint[] := '{}'::bigint[];
  v_questions bigint[] := '{}'::bigint[];
  v_stages bigint[] := '{}'::bigint[];
  v_count int := 0;
BEGIN
  IF NOT p_confirm OR p_id IS NULL OR p_id <= 0 OR p_template_version_id IS NULL OR p_template_version_id <= 0 THEN
    RAISE EXCEPTION 'Explicit confirmation and valid item/version IDs are required';
  END IF;
  IF v_kind NOT IN ('DOMAIN','CONTRIBUTOR','TOOL','STAGE','OPTION','CONDITION','CONDITIONAL') THEN
    RAISE EXCEPTION 'Unsupported deletion type: %',v_kind;
  END IF;
  -- Resolve the parent version independently of the caller-supplied ID.
  IF v_kind='DOMAIN' THEN
    SELECT d.template_version_id INTO v_version FROM public.cra_tm_domains d WHERE d.id=p_id;
  ELSIF v_kind='CONTRIBUTOR' THEN
    SELECT d.template_version_id INTO v_version FROM public.cra_tm_contributor_assessments c JOIN public.cra_tm_domains d ON d.id=c.domain_id WHERE c.id=p_id;
  ELSIF v_kind='TOOL' THEN
    SELECT d.template_version_id INTO v_version FROM public.cra_tm_tool_instances i JOIN public.cra_tm_contributor_assessments c ON c.id=i.contributor_assessment_id JOIN public.cra_tm_domains d ON d.id=c.domain_id WHERE i.id=p_id;
  ELSIF v_kind='STAGE' THEN
    SELECT d.template_version_id INTO v_version FROM public.cra_tm_domain_review_stages s JOIN public.cra_tm_domains d ON d.id=s.domain_id WHERE s.id=p_id;
  ELSIF v_kind='OPTION' THEN
    SELECT d.template_version_id INTO v_version FROM public.cra_tm_tool_answer_options o JOIN public.cra_tm_tool_questions q ON q.id=o.question_id JOIN public.cra_tm_tool_sections s ON s.id=q.tool_section_id JOIN public.cra_tm_tool_instances i ON i.id=s.tool_instance_id JOIN public.cra_tm_contributor_assessments c ON c.id=i.contributor_assessment_id JOIN public.cra_tm_domains d ON d.id=c.domain_id WHERE o.id=p_id;
  ELSIF v_kind='CONDITION' THEN
    SELECT r.template_version_id INTO v_version FROM public.cra_tm_conditional_rule_conditions c JOIN public.cra_tm_conditional_rules r ON r.id=c.conditional_rule_id WHERE c.id=p_id;
  ELSE
    SELECT r.template_version_id INTO v_version FROM public.cra_tm_conditional_rules r WHERE r.id=p_id;
  END IF;
  IF v_version IS NULL THEN RAISE EXCEPTION 'Item % (%) no longer exists',p_id,v_kind; END IF;
  IF v_version <> p_template_version_id THEN RAISE EXCEPTION 'Item belongs to another template version'; END IF;
  SELECT vs.status_code INTO v_status FROM public.cra_tm_template_versions tv JOIN public.cra_tm_version_statuses vs ON vs.id=tv.status_id WHERE tv.id=v_version FOR UPDATE OF tv;
  IF v_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Only a DRAFT template version may be edited'; END IF;

  IF v_kind IN ('DOMAIN','CONTRIBUTOR','TOOL') THEN
    IF v_kind='DOMAIN' THEN v_domains:=ARRAY[p_id]; END IF;
    IF v_kind='CONTRIBUTOR' THEN v_contributors:=ARRAY[p_id]; END IF;
    IF v_kind='TOOL' THEN v_instances:=ARRAY[p_id]; END IF;
    IF v_kind='DOMAIN' THEN
      SELECT coalesce(array_agg(c.id),'{}'::bigint[]) INTO v_contributors FROM public.cra_tm_contributor_assessments c WHERE c.domain_id=ANY(v_domains);
      SELECT coalesce(array_agg(s.id),'{}'::bigint[]) INTO v_stages FROM public.cra_tm_domain_review_stages s WHERE s.domain_id=ANY(v_domains);
    END IF;
    IF v_kind IN ('DOMAIN','CONTRIBUTOR') THEN
      SELECT coalesce(array_agg(i.id),'{}'::bigint[]) INTO v_instances FROM public.cra_tm_tool_instances i WHERE i.contributor_assessment_id=ANY(v_contributors);
    END IF;
    SELECT coalesce(array_agg(s.id),'{}'::bigint[]) INTO v_sections FROM public.cra_tm_tool_sections s WHERE s.tool_instance_id=ANY(v_instances);
    SELECT coalesce(array_agg(q.id),'{}'::bigint[]) INTO v_questions FROM public.cra_tm_tool_questions q WHERE q.tool_section_id=ANY(v_sections);
    -- Polymorphic rule targets and condition sources have no FK. Never leave dangling references.
    IF EXISTS (SELECT 1 FROM public.cra_tm_conditional_rules r WHERE r.template_version_id=v_version AND (
      (r.target_type='DOMAIN' AND r.target_id=ANY(v_domains)) OR
      (r.target_type='CONTRIBUTOR' AND r.target_id=ANY(v_contributors)) OR
      (r.target_type='TOOL_INSTANCE' AND r.target_id=ANY(v_instances)) OR
      (r.target_type='TOOL_SECTION' AND r.target_id=ANY(v_sections)) OR
      (r.target_type='QUESTION' AND r.target_id=ANY(v_questions))
    )) THEN RAISE EXCEPTION 'Remove the conditional rules targeting this item or its children before deletion'; END IF;
    IF EXISTS (SELECT 1 FROM public.cra_tm_conditional_rule_conditions c JOIN public.cra_tm_conditional_rules r ON r.id=c.conditional_rule_id WHERE r.template_version_id=v_version AND c.source_type IN ('QUESTION','FORM_FIELD') AND c.source_id=ANY(v_questions)) THEN
      RAISE EXCEPTION 'A condition references a question in this item. Remove that condition first';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.cra_tm_conditional_rule_conditions c
      JOIN public.cra_tm_conditional_rules r ON r.id=c.conditional_rule_id
      WHERE r.template_version_id=v_version
        AND c.source_type='TOOL_OUTPUT' AND c.source_id=ANY(v_instances)
    ) THEN RAISE EXCEPTION 'A condition references this tool output. Remove that condition first'; END IF;
    -- Older per-contributor reviewable-item targets have polymorphic IDs.
    -- Reject rather than leave an orphan or cascade away established review configuration.
    IF EXISTS (SELECT 1 FROM public.cra_tm_reviewable_items ri WHERE
      (ri.item_type='CONTRIBUTOR_ASSESSMENT' AND ri.target_id=ANY(v_contributors)) OR
      (ri.item_type='TOOL_INSTANCE' AND ri.target_id=ANY(v_instances)) OR
      (ri.item_type='TOOL_SECTION' AND ri.target_id=ANY(v_sections)) OR
      (ri.item_type='TOOL_QUESTION' AND ri.target_id=ANY(v_questions))
    ) THEN RAISE EXCEPTION 'Legacy reviewable items reference this hierarchy. Preserve or migrate those review records before deletion'; END IF;
    -- Existing history, execution, review dependencies and external FKs are retained;
    -- restrictive constraints intentionally abort and roll back the whole call.
    DELETE FROM public.cra_tm_tool_answer_options o WHERE o.question_id=ANY(v_questions);
    DELETE FROM public.cra_tm_tool_questions q WHERE q.id=ANY(v_questions);
    DELETE FROM public.cra_tm_tool_sections s WHERE s.id=ANY(v_sections);
    DELETE FROM public.cra_tm_risk_issue_rules r WHERE r.tool_instance_id=ANY(v_instances);
    DELETE FROM public.cra_tm_tool_instances i WHERE i.id=ANY(v_instances);
    IF v_kind IN ('DOMAIN','CONTRIBUTOR') THEN
      DELETE FROM public.cra_tm_contributor_assessments c WHERE c.id=ANY(v_contributors);
    END IF;
    IF v_kind='DOMAIN' THEN
      DELETE FROM public.cra_tm_domain_review_stage_teams t WHERE t.domain_review_stage_id=ANY(v_stages);
      DELETE FROM public.cra_tm_domain_review_stages s WHERE s.id=ANY(v_stages);
      DELETE FROM public.cra_tm_domains d WHERE d.id=p_id;
    END IF;
  ELSIF v_kind='STAGE' THEN
    DELETE FROM public.cra_tm_domain_review_stage_teams t WHERE t.domain_review_stage_id=p_id;
    DELETE FROM public.cra_tm_domain_review_stages s WHERE s.id=p_id;
  ELSIF v_kind='OPTION' THEN
    DELETE FROM public.cra_tm_tool_answer_options o WHERE o.id=p_id;
  ELSIF v_kind='CONDITION' THEN
    DELETE FROM public.cra_tm_condition_answer_options o WHERE o.condition_id=p_id;
    DELETE FROM public.cra_tm_conditional_rule_conditions c WHERE c.id=p_id;
  ELSIF v_kind='CONDITIONAL' THEN
    DELETE FROM public.cra_tm_condition_answer_options o WHERE o.condition_id IN (SELECT c.id FROM public.cra_tm_conditional_rule_conditions c WHERE c.conditional_rule_id=p_id);
    DELETE FROM public.cra_tm_conditional_rule_conditions c WHERE c.conditional_rule_id=p_id;
    DELETE FROM public.cra_tm_conditional_rules r WHERE r.id=p_id;
  END IF;
  RETURN pg_catalog.jsonb_build_object('deleted',true,'kind',v_kind,'item_id',p_id,'template_version_id',v_version);
EXCEPTION WHEN foreign_key_violation THEN
  RAISE EXCEPTION 'Deletion blocked by linked history, assessments, approval records or other retained references. No records were deleted.' USING ERRCODE='23503';
END;
$$;
-- No public/anonymous deletion endpoint by default. To use this safely,
-- authenticate WeWeb users and grant access only after role/RLS review.
REVOKE ALL ON FUNCTION public.cra_tm_delete_draft_item(text,bigint,bigint,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cra_tm_delete_draft_item(text,bigint,bigint,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.cra_tm_delete_draft_item(text,bigint,bigint,boolean) TO authenticated;

-- The conditional editor now reads persisted option-ID mappings.
GRANT SELECT ON TABLE public.cra_tm_condition_answer_options TO authenticated;
