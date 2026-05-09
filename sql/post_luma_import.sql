-- Run AFTER importing Luma CSV into the attendees table.
-- This populates email_normalized and phone_normalized so lookups work,
-- then enforces the contact-present constraint.

-- 1. Drop the contact constraint if it exists from a previous run (safe no-op otherwise).
alter table attendees drop constraint if exists attendees_contact_present;

-- 2. Expand phone numbers stored in scientific notation (Excel/Sheets CSV export artifact).
-- e.g. "2.34816E+12" → "2348160000000"
update attendees
set phone = cast(cast(phone as numeric) as bigint)::text
where phone ~ '^[0-9.]+[eE][+\-]?[0-9]+$';

-- 3. Mark imported rows as 'luma' if they came in without a source.
update attendees
set source = 'luma'
where source is null or source = '';

-- 4. Remove duplicate emails — keep the row with check-in data, or the earliest if none.
delete from attendees
where id in (
  select id from (
    select id,
           row_number() over (
             partition by lower(trim(email))
             order by
               case when day1_checkin is not null or day2_checkin is not null then 0 else 1 end,
               created_at asc
           ) as rn
    from attendees
    where email is not null and trim(email) <> ''
  ) ranked
  where rn > 1
);

-- 5. Remove duplicate phones — same strategy.
delete from attendees
where id in (
  select id from (
    select id,
           row_number() over (
             partition by right(regexp_replace(phone, '\D', '', 'g'), 10)
             order by
               case when day1_checkin is not null or day2_checkin is not null then 0 else 1 end,
               created_at asc
           ) as rn
    from attendees
    where phone is not null and trim(phone) <> ''
      and length(regexp_replace(phone, '\D', '', 'g')) >= 10
  ) ranked
  where rn > 1
);

-- 6. Lowercase + trim email into email_normalized.
update attendees
set email_normalized = lower(trim(email))
where email is not null
  and trim(email) <> ''
  and email_normalized is null;

-- 7. Phone normalization (Nigeria): keep last 10 digits.
-- Strips '+', spaces, dashes, parentheses, and leading country code (234) / leading 0.
update attendees
set phone_normalized = right(regexp_replace(phone, '\D', '', 'g'), 10)
where phone is not null
  and trim(phone) <> ''
  and phone_normalized is null;

-- 8. Sanity check: find rows still missing both contact fields.
-- These cannot be looked up by the check-in app — clean them up manually.
-- select id, full_name, email, phone from attendees
-- where email_normalized is null and phone_normalized is null;

-- 9. Re-add the contact constraint now that normalization is complete.
alter table attendees add constraint attendees_contact_present
  check (email_normalized is not null or phone_normalized is not null);
