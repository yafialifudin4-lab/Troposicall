begin;

alter table public.transactions
  add column if not exists customer_email text,
  add column if not exists receipt_email_sent_at timestamptz;

commit;
