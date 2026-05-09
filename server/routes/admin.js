import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { normalizeEmail, normalizePhone } from '../lib/normalize.js';
import { DAY1_DATE, DAY2_DATE, TIMEZONE_OFFSET_HOURS } from '../../shared/eventConfig.js';

const router = Router();

const DAY_DATES = { 1: DAY1_DATE, 2: DAY2_DATE };

function toUtc(dateStr, timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const [yr, mo, dy] = dateStr.split('-').map(Number);
  const base = Date.UTC(yr, mo - 1, dy);
  return new Date(base + (h - TIMEZONE_OFFSET_HOURS) * 3600000 + m * 60000).toISOString();
}

router.get('/admin/attendees', async (req, res, next) => {
  try {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken || req.header('x-admin-token') !== adminToken) {
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid admin token.' });
    }

    const { day, gender, occupation, from, to } = req.query;
    const dayNum = day ? parseInt(day, 10) : null;

    let query = supabase
      .from('attendees')
      .select('id, full_name, email, phone, gender, occupation, address, day1_checkin, day2_checkin, source, created_at')
      .order('created_at', { ascending: true });

    if (dayNum === 1) query = query.not('day1_checkin', 'is', null);
    else if (dayNum === 2) query = query.not('day2_checkin', 'is', null);

    if (gender && gender !== 'all') query = query.ilike('gender', gender);
    if (occupation === 'student') query = query.ilike('occupation', '%student%');

    if (dayNum && DAY_DATES[dayNum]) {
      const col = dayNum === 1 ? 'day1_checkin' : 'day2_checkin';
      const date = DAY_DATES[dayNum];
      if (from) query = query.gte(col, toUtc(date, from));
      if (to) query = query.lte(col, toUtc(date, to));
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ attendees: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/import', async (req, res, next) => {
  try {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken || req.header('x-admin-token') !== adminToken) {
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid admin token.' });
    }

    const { rows } = req.body ?? {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'bad_request', message: 'rows must be a non-empty array.' });
    }

    // Load existing contacts for dedup check
    const { data: existing, error: fetchErr } = await supabase
      .from('attendees')
      .select('email_normalized, phone_normalized');
    if (fetchErr) throw fetchErr;

    const seenEmails = new Set(existing?.map(r => r.email_normalized).filter(Boolean));
    const seenPhones = new Set(existing?.map(r => r.phone_normalized).filter(Boolean));

    const toInsert = [];
    let skipped = 0;

    for (const raw of rows) {
      const emailNorm = normalizeEmail(raw.email);
      const phoneNorm = normalizePhone(raw.phone);

      if (!emailNorm && !phoneNorm) { skipped++; continue; }

      if ((emailNorm && seenEmails.has(emailNorm)) || (phoneNorm && seenPhones.has(phoneNorm))) {
        skipped++;
        continue;
      }

      const source = raw.source?.trim() || 'luma';

      toInsert.push({
        full_name:        raw.full_name?.trim()   || null,
        email:            raw.email?.trim()        || null,
        email_normalized: emailNorm,
        phone:            raw.phone?.trim()        || null,
        phone_normalized: phoneNorm,
        address:          raw.address?.trim()      || null,
        gender:           raw.gender?.trim()       || null,
        occupation:       raw.occupation?.trim()   || null,
        source:           ['luma', 'manual'].includes(source) ? source : 'luma',
      });

      if (emailNorm) seenEmails.add(emailNorm);
      if (phoneNorm) seenPhones.add(phoneNorm);
    }

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase.from('attendees').insert(toInsert);
      if (insertErr) throw insertErr;
    }

    res.json({ inserted: toInsert.length, skipped });
  } catch (err) {
    next(err);
  }
});

export default router;
