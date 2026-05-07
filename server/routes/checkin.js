import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { isValidDay } from '../../shared/eventConfig.js';

const router = Router();

router.post('/checkin', async (req, res, next) => {
  try {
    const { attendee_id, day } = req.body ?? {};
    if (!attendee_id || !isValidDay(day)) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'attendee_id and day (1 or 2) are required.'
      });
    }

    const column = day === 1 ? 'day1_checkin' : 'day2_checkin';

    const { data: existing, error: fetchErr } = await supabase
      .from('attendees')
      .select('id, full_name, email, phone, day1_checkin, day2_checkin')
      .eq('id', attendee_id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Attendee not found.' });
    }

    if (existing[column]) {
      return res.json({
        success: true,
        alreadyCheckedIn: true,
        attendee: existing
      });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabase
      .from('attendees')
      .update({ [column]: now })
      .eq('id', attendee_id)
      .is(column, null)
      .select('id, full_name, email, phone, day1_checkin, day2_checkin')
      .maybeSingle();

    if (updateErr) throw updateErr;

    if (!updated) {
      const { data: refetch } = await supabase
        .from('attendees')
        .select('id, full_name, email, phone, day1_checkin, day2_checkin')
        .eq('id', attendee_id)
        .maybeSingle();
      return res.json({
        success: true,
        alreadyCheckedIn: true,
        attendee: refetch ?? existing
      });
    }

    await supabase.from('check_ins').insert({
      attendee_id,
      day,
      checked_in_at: now,
      source_ip: req.ip
    });

    res.json({ success: true, alreadyCheckedIn: false, attendee: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
