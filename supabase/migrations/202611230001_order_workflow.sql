begin;

alter table public.products
  add column if not exists description text not null default '';

alter table public.transactions
  alter column cashier_id drop not null,
  add column if not exists order_status text not null default 'Baru';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_order_status_check'
  ) then
    alter table public.transactions
      add constraint transactions_order_status_check
      check (order_status in ('Baru', 'Diproses', 'Siap', 'Selesai'));
  end if;
end
$$;

alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
  on public.products
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Authenticated users can read products" on public.products;
drop policy if exists "Staff can read all products" on public.products;
create policy "Staff can read all products"
  on public.products
  for select
  to authenticated
  using (exists (
    select 1
    from public.admin
    where user_id = (select auth.uid())
  ));

drop policy if exists "Public can read store settings" on public.store_settings;
create policy "Public can read store settings"
  on public.store_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated users can read transactions" on public.transactions;
drop policy if exists "Staff can read transactions" on public.transactions;
create policy "Staff can read transactions"
  on public.transactions
  for select
  to authenticated
  using (exists (
    select 1
    from public.admin
    where user_id = (select auth.uid())
  ));

drop policy if exists "Authenticated users can read transaction items" on public.transaction_items;
drop policy if exists "Staff can read transaction items" on public.transaction_items;
create policy "Staff can read transaction items"
  on public.transaction_items
  for select
  to authenticated
  using (exists (
    select 1
    from public.admin
    where user_id = (select auth.uid())
  ));

grant select on public.products, public.store_settings to anon, authenticated;
grant select on public.admin, public.transactions, public.transaction_items to authenticated;
grant insert, update, delete on public.products to authenticated;
grant usage on schema public to anon, authenticated;

create or replace function public.create_order(
  p_channel text,
  p_customer_name text,
  p_service_type text,
  p_payment_method text,
  p_amount_received numeric,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_staff boolean := false;
  v_is_pos boolean := false;
  v_requested record;
  v_product public.products%rowtype;
  v_lines jsonb := '[]'::jsonb;
  v_receipt_items jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_payment_status text;
  v_transaction_id uuid;
  v_receipt_number text;
  v_created_at timestamptz;
  v_line jsonb;
begin
  if p_channel is null or p_channel not in ('customer', 'pos') then
    raise exception 'Unsupported order channel';
  end if;

  select exists (
    select 1
    from public.admin
    where user_id = v_user_id
  ) into v_is_staff;

  if p_channel = 'pos' and not v_is_staff then
    raise exception 'Only an authenticated staff member can create a POS transaction'
      using errcode = '42501';
  end if;

  v_is_pos := p_channel = 'pos';

  if p_service_type is null or p_service_type not in ('Makan di tempat', 'Bawa pulang') then
    raise exception 'Unsupported service type';
  end if;

  if p_payment_method is null or p_payment_method not in ('Tunai', 'QRIS') then
    raise exception 'Unsupported payment method';
  end if;

  if p_amount_received is null or p_amount_received < 0 then
    raise exception 'Received amount must be zero or greater';
  end if;

  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Order items must be a JSON array';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'An order must contain at least one item';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as entry(value)
    where nullif(entry.value ->> 'product_id', '') is null
      or coalesce((entry.value ->> 'quantity')::integer, 0) <= 0
  ) then
    raise exception 'Each order item needs a product ID and positive quantity';
  end if;

  if not v_is_pos then
    p_amount_received := 0;
  end if;

  for v_requested in
    select
      (entry.value ->> 'product_id')::uuid as product_id,
      sum((entry.value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as entry(value)
    group by (entry.value ->> 'product_id')::uuid
    order by (entry.value ->> 'product_id')::uuid
  loop
    select *
    into v_product
    from public.products
    where id = v_requested.product_id
    for update;

    if not found or not v_product.is_active then
      raise exception 'A product in this order is unavailable';
    end if;

    if v_product.stock < v_requested.quantity then
      raise exception 'Insufficient stock for product %', v_product.name;
    end if;

    v_total := v_total + (v_product.price * v_requested.quantity);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'quantity', v_requested.quantity,
      'unit_price', v_product.price,
      'line_total', v_product.price * v_requested.quantity
    ));
  end loop;

  if v_is_pos and p_payment_method = 'Tunai' and p_amount_received >= v_total then
    v_payment_status := 'Lunas';
  else
    v_payment_status := 'Menunggu';
  end if;

  insert into public.transactions (
    cashier_id,
    customer_name,
    service_type,
    payment_method,
    subtotal,
    tax,
    total,
    amount_received,
    status,
    order_status
  )
  values (
    case when v_is_pos then v_user_id else null end,
    nullif(btrim(p_customer_name), ''),
    p_service_type,
    p_payment_method,
    v_total,
    0,
    v_total,
    case when v_payment_status = 'Lunas' then p_amount_received else 0 end,
    v_payment_status,
    'Baru'
  )
  returning id, receipt_number, created_at
  into v_transaction_id, v_receipt_number, v_created_at;

  for v_line in
    select value
    from jsonb_array_elements(v_lines)
  loop
    insert into public.transaction_items (
      transaction_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      line_total
    )
    values (
      v_transaction_id,
      (v_line ->> 'product_id')::uuid,
      v_line ->> 'product_name',
      (v_line ->> 'quantity')::integer,
      (v_line ->> 'unit_price')::numeric,
      (v_line ->> 'line_total')::numeric
    );

    update public.products
    set stock = stock - (v_line ->> 'quantity')::integer
    where id = (v_line ->> 'product_id')::uuid;

    v_receipt_items := v_receipt_items || jsonb_build_array(jsonb_build_object(
      'product_name', v_line ->> 'product_name',
      'quantity', (v_line ->> 'quantity')::integer,
      'unit_price', (v_line ->> 'unit_price')::numeric,
      'line_total', (v_line ->> 'line_total')::numeric
    ));
  end loop;

  return jsonb_build_object(
    'id', v_transaction_id,
    'receipt_number', v_receipt_number,
    'customer_name', nullif(btrim(p_customer_name), ''),
    'payment_method', p_payment_method,
    'subtotal', v_total,
    'tax', 0,
    'total', v_total,
    'amount_received', case when v_payment_status = 'Lunas' then p_amount_received else 0 end,
    'status', v_payment_status,
    'order_status', 'Baru',
    'created_at', v_created_at,
    'transaction_items', v_receipt_items
  );
end;
$$;

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

  if p_payment_status is not null then
    if p_payment_status <> 'Lunas' then
      raise exception 'Only payment confirmation is supported';
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

revoke all on function public.create_order(text, text, text, text, numeric, jsonb) from public;
grant execute on function public.create_order(text, text, text, text, numeric, jsonb) to anon, authenticated;

revoke all on function public.update_order_state(uuid, text, text) from public;
grant execute on function public.update_order_state(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
