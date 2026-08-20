\set ON_ERROR_STOP on

\if :{?looker_password}
\else
  \echo 'Missing required psql variable: looker_password'
  \echo 'Usage: psql -v looker_password=strong_password -f scripts/setup-looker-readonly.sql'
  \quit 1
\endif

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'looker_readonly') THEN
    CREATE ROLE looker_readonly LOGIN;
  END IF;
END
$$;

ALTER ROLE looker_readonly WITH PASSWORD :'looker_password';

GRANT CONNECT ON DATABASE customer_hub TO looker_readonly;
GRANT USAGE ON SCHEMA public TO looker_readonly;

CREATE OR REPLACE VIEW public.looker_clients AS
SELECT
  c.id,
  c."clientNumber" AS client_number,
  c.name,
  c.phone,
  c."phoneNormalized" AS phone_normalized,
  c.email,
  c."createdAt" AS created_at,
  c."updatedAt" AS updated_at,
  c."leadCreatedAt" AS lead_created_at
FROM public.client c;

CREATE OR REPLACE VIEW public.looker_messages AS
SELECT
  m.id,
  m."clientId" AS client_id,
  c."clientNumber" AS client_number,
  c.name AS client_name,
  c.phone AS client_phone,
  c.email AS client_email,
  m."conversationId" AS conversation_id,
  m.channel,
  m.direction,
  m.text,
  m."externalMessageId" AS external_message_id,
  m."createdAt" AS created_at
FROM public.message m
JOIN public.client c ON c.id = m."clientId";

CREATE OR REPLACE VIEW public.looker_lead_sources AS
SELECT
  ls.id,
  ls."clientId" AS client_id,
  c."clientNumber" AS client_number,
  c.name AS client_name,
  ls."utmSource" AS utm_source,
  ls."utmMedium" AS utm_medium,
  ls."utmCampaign" AS utm_campaign,
  ls."utmContent" AS utm_content,
  ls."utmTerm" AS utm_term,
  ls.referrer,
  ls."landingPage" AS landing_page,
  ls."createdAt" AS created_at
FROM public.lead_source ls
JOIN public.client c ON c.id = ls."clientId";

GRANT SELECT ON ALL TABLES IN SCHEMA public TO looker_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO looker_readonly;
