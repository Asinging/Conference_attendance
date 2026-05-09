# Importing Luma Registrations into Supabase

## 1. Export from Luma
1. Open your Luma event → **Manage** → **Guests** → **Export Guests** (CSV).
2. Open the CSV in a spreadsheet. Common Luma columns:
   - `Name`
   - `Email`
   - `Phone Number`
   - `Approval Status` (filter to `approved` only)
   - `Created At`

## 2. Trim + rename columns

Edit the CSV so it has only these columns, in this order, with these exact headers:

| CSV header   | Notes |
|--------------|-------|
| `full_name`  | from Luma `Name` |
| `email`      | from Luma `Email` |
| `phone`      | from Luma `Phone Number` |
| `source`     | put the literal value `luma` in every row |

Delete every other column. Save the file.

## 3. Import into Supabase
1. Run `sql/setup.sql` in the Supabase SQL editor — this creates (or updates) the `attendees` and `check_ins` tables. Safe to re-run if the table already exists.
2. In the Supabase dashboard → **Table Editor** → `attendees` → **Insert** → **Import data from CSV**.
3. Upload your trimmed CSV. Match each CSV column to the matching `attendees` column. Leave unmatched columns (address, gender, occupation, etc.) blank — they will be NULL and that is fine for Luma imports.
4. Submit.

> **If Supabase rejects the upload with a constraint error**, open the SQL editor and run this one line first, then retry the upload:
> ```sql
> alter table attendees drop constraint if exists attendees_contact_present;
> ```
> The constraint is restored automatically when you run `post_luma_import.sql` in step 4.

## 4. Normalize the imported data
Open the SQL editor and run `sql/post_luma_import.sql`. This:
- Drops the contact constraint so normalization can run safely.
- Sets `source = 'luma'` on rows that came in without one.
- Fills `email_normalized` (lowercased, trimmed).
- Fills `phone_normalized` (last 10 digits — Nigeria format).
- Re-adds the contact constraint once all rows are normalized.

After this, the check-in app will be able to find imported guests by either email or phone.

## 5. Spot-check
```sql
select count(*) from attendees;
select count(*) from attendees where email_normalized is not null;
select count(*) from attendees where phone_normalized is not null;
select * from attendees order by created_at desc limit 5;
```

If any rows have neither `email_normalized` nor `phone_normalized`, the check-in app cannot find them — clean those up manually before the event.
