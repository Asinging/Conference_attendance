import { useEffect, useRef, useState } from 'react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(value) {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter your email or phone number.';
  if (trimmed.includes('@')) {
    return EMAIL_RE.test(trimmed.toLowerCase()) ? null : 'That email looks invalid.';
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10) return 'Phone number must have at least 10 digits.';
  return null;
}

export default function LookupForm({ onSubmit, loading, error }) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const validationError = touched ? validate(value) : null;
  const hasError = !!validationError;
  const inputMode = value.includes('@') ? 'email' : 'tel';

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (validate(value)) return;
    onSubmit(value.trim());
  };

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h1 className="card__title">Welcome</h1>
      <p className="card__subtitle">Enter your email or phone number to check in.</p>

      <label className="field">
        <span className="field__label">Email or phone</span>
        <input
          ref={inputRef}
          type="text"
          className={`field__input ${hasError ? 'field__input--error' : ''}`}
          value={value}
          inputMode={inputMode}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck="false"
          placeholder="you@example.com or 0801…"
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          disabled={loading}
        />
        {validationError && <span className="field__error">{validationError}</span>}
      </label>

      {error && <div className="banner banner--error">{error}</div>}

      <button type="submit" className="btn btn--primary" disabled={loading}>
        {loading ? 'Checking…' : 'Continue'}
      </button>
    </form>
  );
}
