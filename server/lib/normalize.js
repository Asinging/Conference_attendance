const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return EMAIL_RE.test(trimmed) ? trimmed : null;
}

// Nigeria phone normalization: keep the last 10 digits.
// Handles: 08012345678, +2348012345678, 2348012345678, 234 801 234 5678, etc.
export function normalizePhone(value) {
  if (!value || typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export function detectInputType(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.includes('@')) return 'email';
  if (/\d/.test(trimmed)) return 'phone';
  return null;
}

export function normalizeIdentifier(raw) {
  const type = detectInputType(raw);
  if (type === 'email') {
    const email = normalizeEmail(raw);
    return email ? { type: 'email', value: email } : null;
  }
  if (type === 'phone') {
    const phone = normalizePhone(raw);
    return phone ? { type: 'phone', value: phone } : null;
  }
  return null;
}
