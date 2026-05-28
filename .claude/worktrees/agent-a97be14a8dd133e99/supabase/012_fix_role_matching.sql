create or replace function public.is_manager()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.app_users au
    where au.auth_user_id = auth.uid()
      and (
        au.role ilike '%مدير%عام%'
        or au.role ilike '%مدير%معرض%'
        or au.role ilike '%admin%'
        or au.role ilike '%owner%'
        or au.full_name ilike '%المدير العام%'
      )
  )
$$;
