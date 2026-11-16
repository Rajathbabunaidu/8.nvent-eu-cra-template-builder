-- DANGER: Only in a PRIVATE, ISOLATED Supabase test project with disposable
-- template data. Anonymous users could call the function. Never execute on
-- shared, public, enterprise or production projects.
-- Supabase dashboard SQL editor: run AFTER 01_draft_deletion_rpc_v1_1.sql
GRANT EXECUTE ON FUNCTION public.cra_tm_delete_draft_item(text,bigint,bigint,boolean) TO anon;
-- After testing, revoke the anonymous grant immediately:
-- REVOKE ALL ON FUNCTION public.cra_tm_delete_draft_item(text,bigint,bigint,boolean) FROM anon;

-- TEST ONLY: new visual condition editor reads answer-option mappings.
GRANT SELECT ON TABLE public.cra_tm_condition_answer_options TO anon;
-- REVOKE SELECT ON TABLE public.cra_tm_condition_answer_options FROM anon;
