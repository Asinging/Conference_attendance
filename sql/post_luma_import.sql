-- Run AFTER importing Luma CSV into the attendees table.
-- This populates email_normalized and phone_normalized so lookups work.

-- 1. Mark imported rows as 'luma' if they came in without a source.
update attendees
set source = 'luma'
where source is null or source = '';

-- 2. Lowercase + trim email into email_normalized.
update attendees
set email_normalized = lower(trim(email))
where email is not null
  and trim(email) <> ''
  and email_normalized is null;

-- 3. Phone normalization (Nigeria): keep last 10 digits.
-- Strips '+', spaces, dashes, parentheses, and leading country code (234) / leading 0.
update attendees
set phone_normalized = right(regexp_replace(phone, '\D', '', 'g'), 10)
where phone is not null
  and trim(phone) <> ''
  and phone_normalized is null;

-- 4. Sanity check: rows missing both contact fields will violate the CHECK
-- constraint on insert, but rows imported before normalization may exist.
-- Run this to find any to clean up manually:
-- select id, full_name, email, phone from attendees
-- where email_normalized is null and phone_normalized is null;
