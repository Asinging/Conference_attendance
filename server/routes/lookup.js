import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { normalizeIdentifier } from '../lib/normalize.js';

const router = Router();

router.post('/lookup', async (req, res, next) => {
  try {
    const { identifier, day } = req.body ?? {};
    const normalized = normalizeIdentifier(identifier);
    if (!normalized) {
      return res.status(400).json({
        error: 'invalid_identifier',
        message: 'Enter a valid email or phone number.'
      });
    }

    const column = normalized.type === 'email' ? 'email_normalized' : 'phone_normalized';
    const { data, error } = await supabase
      .from('attendees')
      .select('id, full_name, email, phone, day1_checkin, day2_checkin, source')
      .eq(column, normalized.value)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.json({ found: false });

    const alreadyCheckedInToday =
      day === 1 ? !!data.day1_checkin : day === 2 ? !!data.day2_checkin : false;

    res.json({ found: true, attendee: data, alreadyCheckedInToday });
  } catch (err) {
    next(err);
  }
});

export default router;
