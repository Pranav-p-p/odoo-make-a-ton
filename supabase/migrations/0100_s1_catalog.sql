-- =====================================================================
-- 0100 S1 catalog (owner: S1). Core already created the catalog tables and their RLS
-- (0001, 0002): admin writes, staff read; products and plans readable by every login.
-- Add SQL here only if S1 needs it (e.g. an "is the plan in use" check). Additive changes only.
-- =====================================================================
select 1;

-- ---------- Function privileges ---------------------------------------
-- Supabase grants EXECUTE on new functions to anon and authenticated by default. Close that,
-- then grant only what the API calls. Every new function in this file must be listed here.
revoke execute on all functions in schema public from public, anon;
