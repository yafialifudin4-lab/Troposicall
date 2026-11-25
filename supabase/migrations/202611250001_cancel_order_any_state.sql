begin;

create or replace function public.update_order_state(
  p_transaction_id uuid,
  p_payment_status text default null,
  p_order_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_staff boolean := false;
  v_transaction public.transactions%rowtype;
begin
  select exists (
    select 1
    from public.admin
    where user_id = v_user_id
  ) into v_is_staff;

  if not v_is_staff then
    raise exception 'Only authenticated staff can update orders'
      using errcode = '42501';
  end if;

  if p_payment_status is null and p_order_status is null then
    raise exception 'At least one order status change is required';
  end if;

  select *
  into v_transaction
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transaction not found';
  end if;

  if p_payment_status = 'Dibatalkan' then
    if p_order_status is not null then
      raise exception 'Order cancellation cannot change preparation status';
    end if;

    update public.transactions
    set status = 'Dibatalkan'
    where id = p_transaction_id
    returning * into v_transaction;
  elsif p_payment_status is not null then
    if p_payment_status <> 'Lunas' then
      raise exception 'Only payment confirmation or cancellation is supported';
    end if;

    if v_transaction.status not in ('Menunggu', 'Lunas') then
      raise exception 'This transaction cannot be marked as paid';
    end if;

    update public.transactions
    set status = 'Lunas',
        amount_received = total
    where id = p_transaction_id
    returning * into v_transaction;
  end if;

  if p_order_status is not null then
    if v_transaction.status <> 'Lunas' then
      raise exception 'Payment must be confirmed before preparation starts';
    end if;

    if p_order_status = v_transaction.order_status then
      return jsonb_build_object(
        'id', v_transaction.id,
        'status', v_transaction.status,
        'order_status', v_transaction.order_status
      );
    end if;

    if not (
      (v_transaction.order_status = 'Baru' and p_order_status = 'Diproses')
      or (v_transaction.order_status = 'Diproses' and p_order_status = 'Siap')
      or (v_transaction.order_status = 'Siap' and p_order_status = 'Selesai')
    ) then
      raise exception 'Invalid order preparation status transition';
    end if;

    update public.transactions
    set order_status = p_order_status
    where id = p_transaction_id
    returning * into v_transaction;
  end if;

  return jsonb_build_object(
    'id', v_transaction.id,
    'status', v_transaction.status,
    'order_status', v_transaction.order_status
  );
end;
$$;

notify pgrst, 'reload schema';

commit;
