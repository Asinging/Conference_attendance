import { useState } from 'react';
import { EVENT_NAME } from '../../../shared/eventConfig.js';
import { useEventDay } from '../hooks/useEventDay.js';
import { lookup, checkin, register, getApiErrorMessage } from '../api/index.js';
import LookupForm from '../components/LookupForm.jsx';
import ConfirmCard from '../components/ConfirmCard.jsx';
import RegisterForm from '../components/RegisterForm.jsx';
import SuccessScreen from '../components/SuccessScreen.jsx';
import DayBadge from '../components/DayBadge.jsx';

export default function CheckIn() {
  const day = useEventDay();
  const [step, setStep] = useState('lookup');
  const [identifier, setIdentifier] = useState('');
  const [attendee, setAttendee] = useState(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setStep('lookup');
    setIdentifier('');
    setAttendee(null);
    setAlreadyCheckedIn(false);
    setError(null);
  };

  const handleLookup = async (value) => {
    if (day !== 1 && day !== 2) {
      setError('Today is not an event day. Please check in on the event date.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await lookup(value, day);
      setIdentifier(value);
      if (res.found) {
        setAttendee(res.attendee);
        setAlreadyCheckedIn(!!res.alreadyCheckedInToday);
        setStep('confirm');
      } else {
        setStep('register');
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!attendee) return;
    setError(null);
    setLoading(true);
    try {
      const res = await checkin(attendee.id, day);
      setAttendee(res.attendee);
      setAlreadyCheckedIn(!!res.alreadyCheckedIn);
      setStep('success');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    setAttendee(null);
    setAlreadyCheckedIn(false);
    setStep('lookup');
    setIdentifier('');
    setError(null);
  };

  const handleRegister = async (payload) => {
    setError(null);
    setLoading(true);
    try {
      const res = await register({ ...payload, day });
      setAttendee(res.attendee);
      setAlreadyCheckedIn(false);
      setStep('success');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="page__header">
        <div className="page__brand">{EVENT_NAME}</div>
        <DayBadge day={day} />
      </header>

      <main className="page__main">
        {step === 'lookup' && (
          <LookupForm onSubmit={handleLookup} loading={loading} error={error} />
        )}
        {step === 'confirm' && attendee && (
          <ConfirmCard
            attendee={attendee}
            alreadyCheckedIn={alreadyCheckedIn}
            onConfirm={handleConfirm}
            onReject={handleReject}
            loading={loading}
          />
        )}
        {step === 'register' && (
          <RegisterForm
            initialIdentifier={identifier}
            onSubmit={handleRegister}
            onCancel={reset}
            loading={loading}
            error={error}
          />
        )}
        {step === 'success' && attendee && (
          <SuccessScreen
            attendee={attendee}
            day={day}
            alreadyCheckedIn={alreadyCheckedIn}
            onReset={reset}
          />
        )}
      </main>
    </div>
  );
}
