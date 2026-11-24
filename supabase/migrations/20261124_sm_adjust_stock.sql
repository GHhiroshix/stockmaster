create or replace function public.sm_adjust_stock(
  p_product_id bigint,
  p_new_qty integer,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company uuid := public.current_company_id();
  v_user uuid := auth.uid();
  v_old_qty integer;
  v_name text;
  v_jan text;
  v_user_name text;
  v_user_email text;
begin
  if v_company is null then
    raise exception 'user is not associated with a company' using errcode = 'SM004';
  end if;
  if not public.is_company_admin() then
    raise exception 'only company admins can adjust stock' using errcode = 'SM005';
  end if;
  if p_new_qty is null or p_new_qty < 0 then
    raise exception 'quantity must be >= 0' using errcode = 'SM003';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'reason is required' using errcode = 'SM003';
  end if;

  select p.qty, p.name, p.jan into v_old_qty, v_name, v_jan
    from public.products p
   where p.id = p_product_id
     and p.company_id = v_company;

  if not found then
    raise exception 'product not found in your company' using errcode = 'P0002';
  end if;

  update public.products p
     set qty = p_new_qty
   where p.id = p_product_id
     and p.company_id = v_company;

  select pr.name, pr.email into v_user_name, v_user_email
    from public.profiles pr
   where pr.id = v_user;

  insert into public.sm_audit_logs
    (company_id, user_id, user_name, user_email, action, target_name, target_jan, qty, detail)
  values
    (v_company,
     v_user,
     v_user_name,
     v_user_email,
     'stock_adjust',
     v_name,
     v_jan,
     p_new_qty,
     jsonb_build_object('from', v_old_qty, 'to', p_new_qty, 'reason', btrim(p_reason)));

  return jsonb_build_object(
    'product_id', p_product_id,
    'old_qty', v_old_qty,
    'new_qty', p_new_qty
  );
end;
$$;

revoke execute on function public.sm_adjust_stock(bigint, integer, text) from public, anon;
grant execute on function public.sm_adjust_stock(bigint, integer, text) to authenticated;
