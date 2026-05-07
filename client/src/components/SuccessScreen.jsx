import { useEffect } from 'react';

export default function SuccessScreen({ attendee, day, alreadyCheckedIn, onReset }) {
  useEffect(() => {
    const t = setTimeout(onReset, 8000);
    return () => clearTimeout(t);
  }, [onReset]);

  const headline = alreadyCheckedIn ? 'You’re already in.' : 'You’re checked in.';
  const subline = attendee.full_name
    ? `See you inside, ${attendee.full_name.split(' ')[0]}.`
    : 'See you inside.';

  return (
    <div className="card card--success">
      <div className="success-mark" aria-hidden>✓</div>
      <h1 className="card__title">{headline}</h1>
      <p className="card__subtitle">{subline}</p>
      <div className="success-meta">Day {day}</div>
      <button type="button" className="btn btn--ghost" onClick={onReset}>
        Done
      </button>
    </div>
  );
}
