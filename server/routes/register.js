import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { normalizeEmail, normalizePhone } from '../lib/normalize.js';
import { isValidDay } from '../../shared/eventConfig.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { full_name, email, phone, address, day } = req.body ?? {};

    if (!isValidDay(day)) {
      return res.status(400).json({
        error: 'invalid_day',
        message: 'day must be 1 or 2.'
      });
    }

    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      return res.status(400).json({
        error: 'invalid_name',
        message: 'Full name is required.'
      });
    }

    const emailNorm = normalizeEmail(email);
    const phoneNorm = normalizePhone(phone);

    if (!emailNorm && !phoneNorm) {
      return res.status(400).json({
        error: 'invalid_contact',
        message: 'A valid email or phone number is required.'
      });
    }

    if (emailNorm) {
      const { data: dup } = await supabase
        .from('attendees')
        .select('id')
        .eq('email_normalized', emailNorm)
        .maybeSingle();
      if (dup) {
        return res.status(409).json({
          error: 'duplicate_email',
          message: 'Someone already registered with that email. Use the lookup screen instead.'
        });
      }
    }

    if (phoneNorm) {
      const { data: dup } = await supabase
        .from('attendees')
        .select('id')
        .eq('phone_normalized', phoneNorm)
        .maybeSingle();
      if (dup) {
        return res.status(409).json({
          error: 'duplicate_phone',
          message: 'Someone already registered with that phone number. Use the lookup screen instead.'
        });
      }
    }

    const column = day === 1 ? 'day1_checkin' : 'day2_checkin';
    const now = new Date().toISOString();

    const { data: inserted, error: insertErr } = await supabase
      .from('attendees')
      .insert({
        full_name: full_name.trim(),
        email: email ? String(email).trim() : null,
        email_normalized: emailNorm,
        phone: phone ? String(phone).trim() : null,
        phone_normalized: phoneNorm,
        address: address ? String(address).trim() : null,
        source: 'manual',
        [column]: now
      })
      .select('id, full_name, email, phone, day1_checkin, day2_checkin')
      .single();

    if (insertErr) throw insertErr;

    await supabase.from('check_ins').insert({
      attendee_id: inserted.id,
      day,
      checked_in_at: now,
      source_ip: req.ip
    });

    res.json({ success: true, attendee: inserted });
  } catch (err) {
    next(err);
  }
});

export default router;
