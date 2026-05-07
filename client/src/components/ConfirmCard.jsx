export default function ConfirmCard({ attendee, alreadyCheckedIn, onConfirm, onReject, loading }) {
  return (
    <div className="card">
      <h1 className="card__title">Is this you?</h1>
      <div className="confirm-name">{attendee.full_name || '(no name on file)'}</div>
      <div className="confirm-meta">
        {attendee.email && <div>{attendee.email}</div>}
        {attendee.phone && <div>{attendee.phone}</div>}
      </div>

      {alreadyCheckedIn && (
        <div className="banner banner--info">
          You're already checked in for today. Tap "Yes" to continue inside.
        </div>
      )}

      <div className="btn-row">
        <button
          type="button"
          className="btn btn--primary"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Just a moment…' : 'Yes, that’s me'}
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onReject}
          disabled={loading}
        >
          No, not me
        </button>
      </div>
    </div>
  );
}
