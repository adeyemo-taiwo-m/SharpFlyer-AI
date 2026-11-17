-- Phase 12: AI design and revision request kinds. Existing RLS on ai_requests remains unchanged.
alter table public.ai_requests drop constraint if exists ai_requests_kind_check;
alter table public.ai_requests add constraint ai_requests_kind_check check (kind in ('copy_suggestions', 'background_removal', 'design_specs', 'design_revisions'));
