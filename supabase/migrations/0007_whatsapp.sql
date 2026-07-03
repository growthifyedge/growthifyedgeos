-- =============================================================================
-- Growthify Edge OS — 0007 WHATSAPP (contacts, messages, indexes)
-- Stores every inbound/outbound WhatsApp message that flows through the
-- Cloud API webhook (app/api/whatsapp/route.ts) so the app has a full history
-- and can drive auto-replies. Run AFTER 0001–0006.
-- =============================================================================

-- Direction of a stored message.
do $$ begin
  create type wa_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- WHATSAPP CONTACTS  (one row per customer phone number we've talked to)
-- -----------------------------------------------------------------------------
create table if not exists public.whatsapp_contacts (
  id             uuid primary key default gen_random_uuid(),
  wa_id          text not null unique,          -- customer number in intl format, e.g. 923001234567
  profile_name   text,                          -- WhatsApp display name (sent by Meta)
  last_message_at timestamptz,                  -- timestamp of the most recent message either way
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- WHATSAPP MESSAGES  (append-only log of everything sent & received)
-- -----------------------------------------------------------------------------
create table if not exists public.whatsapp_messages (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid references public.whatsapp_contacts (id) on delete cascade,
  wa_id         text not null,                  -- customer number (denormalised for easy filtering)
  direction     wa_direction not null,
  wa_message_id text unique,                    -- Meta's message id (used for idempotency / dedupe)
  body          text,                           -- message text
  msg_type      text not null default 'text',   -- text | image | audio | button | etc.
  status        text,                           -- for outbound: sent | delivered | read | failed
  raw           jsonb,                           -- full raw payload from Meta, for debugging
  created_at    timestamptz not null default now()
);

create index if not exists idx_wa_messages_contact on public.whatsapp_messages (contact_id);
create index if not exists idx_wa_messages_wa_id   on public.whatsapp_messages (wa_id);
create index if not exists idx_wa_messages_created on public.whatsapp_messages (created_at desc);

-- -----------------------------------------------------------------------------
-- RLS: the webhook uses the SERVICE ROLE key (bypasses RLS). For the admin UI,
-- allow admins to read the history. No client writes — all writes go through
-- the server-side webhook route.
-- -----------------------------------------------------------------------------
alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_messages enable row level security;

do $$ begin
  create policy "admin reads wa contacts"
    on public.whatsapp_contacts for select
    using (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin reads wa messages"
    on public.whatsapp_messages for select
    using (public.is_admin());
exception when duplicate_object then null; end $$;
