-- OPTIONAL: DISPOSABLE TEST PROJECT ONLY.
-- The user's current WeWeb connection has no Supabase Auth. Granting this RPC
-- to anon exposes draft removal to anyone with the public project URL/key.
-- DO NOT run on production or a shared development dataset.
GRANT EXECUTE ON FUNCTION public.cra_tm_remove_draft_item(text,bigint,bigint,boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.cra_tm_restore_draft_item(text,bigint,bigint,boolean) TO anon;
NOTIFY pgrst, 'reload schema';
-- To revoke once testing is finished:
-- REVOKE EXECUTE ON FUNCTION public.cra_tm_remove_draft_item(text,bigint,bigint,boolean) FROM anon;
-- REVOKE EXECUTE ON FUNCTION public.cra_tm_restore_draft_item(text,bigint,bigint,boolean) FROM anon;
