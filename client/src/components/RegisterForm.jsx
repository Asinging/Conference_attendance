import { useEffect, useRef, useState } from 'react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENDER_OPTIONS = ['Female', 'Male', 'Prefer not to say'];

function validate({ full_name, email, phone, address, gender, occupation }) {
  const errors = {};
  if (!full_name.trim()) errors.full_name = 'Full name is required.';

  const hasEmail = !!email.trim();
  const hasPhone = !!phone.trim();
  if (!hasEmail && !hasPhone) {
    errors.email = 'Provide an email or phone number.';
    errors.phone = 'Provide an email or phone number.';
  }
  if (hasEmail && !EMAIL_RE.test(email.trim().toLowerCase())) {
    errors.email = 'That email looks invalid.';
  }
  if (hasPhone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) errors.phone = 'Phone number must have at least 10 digits.';
  }
  if (!address.trim()) errors.address = 'Address is required.';
  if (!gender) errors.gender = 'Please select an option.';
  if (!occupation.trim()) errors.occupation = 'Occupation is required.';
  return errors;
}

export default function RegisterForm({ initialIdentifier, onSubmit, onCancel, loading, error }) {
  const isInitialEmail = initialIdentifier?.includes('@');
  const [form, setForm] = useState({
    full_name: '',
    email: isInitialEmail ? initialIdentifier : '',
    phone: !isInitialEmail && initialIdentifier ? initialIdentifier : '',
    address: '',
    gender: '',
    occupation: ''
  });
  const [touched, setTouched] = useState({});
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const errors = validate(form);
  const hasErrors = Object.keys(errors).length > 0;

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const blur = (key) => () => setTouched((t) => ({ ...t, [key]: true }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched({
      full_name: true,
      email: true,
      phone: true,
      address: true,
      gender: true,
      occupation: true
    });
    if (hasErrors) return;
    onSubmit({
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim(),
      gender: form.gender,
      occupation: form.occupation.trim()
    });
  };

  const fieldError = (key) => (touched[key] ? errors[key] : null);

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h1 className="card__title">First time here?</h1>
      <p className="card__subtitle">We couldn't find your record. Tell us a bit about you.</p>

      <label className="field">
        <span className="field__label">Full name</span>
        <input
          ref={nameRef}
          type="text"
          className={`field__input ${fieldError('full_name') ? 'field__input--error' : ''}`}
          value={form.full_name}
          onChange={setField('full_name')}
          onBlur={blur('full_name')}
          disabled={loading}
          autoCapitalize="words"
        />
        {fieldError('full_name') && <span className="field__error">{fieldError('full_name')}</span>}
      </label>

      <label className="field">
        <span className="field__label">Email</span>
        <input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          className={`field__input ${fieldError('email') ? 'field__input--error' : ''}`}
          value={form.email}
          onChange={setField('email')}
          onBlur={blur('email')}
          disabled={loading}
        />
        {fieldError('email') && <span className="field__error">{fieldError('email')}</span>}
      </label>

      <label className="field">
        <span className="field__label">Phone</span>
        <input
          type="tel"
          inputMode="tel"
          className={`field__input ${fieldError('phone') ? 'field__input--error' : ''}`}
          value={form.phone}
          onChange={setField('phone')}
          onBlur={blur('phone')}
          disabled={loading}
        />
        {fieldError('phone') && <span className="field__error">{fieldError('phone')}</span>}
      </label>

      <label className="field">
        <span className="field__label">Gender</span>
        <select
          className={`field__input ${fieldError('gender') ? 'field__input--error' : ''}`}
          value={form.gender}
          onChange={setField('gender')}
          onBlur={blur('gender')}
          disabled={loading}
        >
          <option value="">Select…</option>
          {GENDER_OPTIONS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        {fieldError('gender') && <span className="field__error">{fieldError('gender')}</span>}
      </label>

      <label className="field">
        <span className="field__label">Occupation</span>
        <input
          type="text"
          className={`field__input ${fieldError('occupation') ? 'field__input--error' : ''}`}
          value={form.occupation}
          onChange={setField('occupation')}
          onBlur={blur('occupation')}
          disabled={loading}
          autoCapitalize="words"
        />
        {fieldError('occupation') && <span className="field__error">{fieldError('occupation')}</span>}
      </label>

      <label className="field">
        <span className="field__label">Address</span>
        <textarea
          rows={2}
          className={`field__input ${fieldError('address') ? 'field__input--error' : ''}`}
          value={form.address}
          onChange={setField('address')}
          onBlur={blur('address')}
          disabled={loading}
        />
        {fieldError('address') && <span className="field__error">{fieldError('address')}</span>}
      </label>

      {error && <div className="banner banner--error">{error}</div>}

      <div className="btn-row">
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Saving…' : 'Register & check in'}
        </button>
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={loading}>
          Back
        </button>
      </div>
    </form>
  );
}
