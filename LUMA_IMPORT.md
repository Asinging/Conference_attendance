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
1. Run `sql/setup.sql` in the Supabase SQL editor first — this creates the `attendees` and `check_ins` tables.
2. In the Supabase dashboard → **Table Editor** → `attendees` → **Insert** → **Import data from CSV**.
3. Upload your trimmed CSV. Match each CSV column to the matching `attendees` column.
4. Submit.

## 4. Normalize the imported data
Open the SQL editor and run `sql/post_luma_import.sql`. This:
- Sets `source = 'luma'` on rows that came in without one.
- Fills `email_normalized` (lowercased, trimmed).
- Fills `phone_normalized` (last 10 digits — Nigeria format).

After this, the check-in app will be able to find imported guests by either email or phone.

## 5. Spot-check
```sql
select count(*) from attendees;
select count(*) from attendees where email_normalized is not null;
select count(*) from attendees where phone_normalized is not null;
select * from attendees order by created_at desc limit 5;
```

If any rows have neither `email_normalized` nor `phone_normalized`, the check-in app cannot find them — clean those up manually before the event.
