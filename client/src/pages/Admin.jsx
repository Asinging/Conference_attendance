import { useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// ── CSV header → DB column mapping ───────────────────────────────────────────
// Strips all emoji, non-ASCII, and punctuation then matches on keywords.
function normalizeHeader(raw) {
  return raw
    .replace(/[^\x00-\x7F]/g, ' ')  // emoji, smart quotes, accents → space
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')    // punctuation/underscores → space
    .trim();
}

function mapHeader(raw) {
  const h = normalizeHeader(raw);
  if (h === 'name' || h === 'full name')           return 'full_name';
  if (h === 'email')                                return 'email';
  if (h === 'phone number' || h === 'phone')        return 'phone';
  if (h === 'gender')                               return 'gender';
  if (h.includes('address'))                        return 'address';
  if (h.includes('category') ||
      h.includes('occupation') ||
      h.includes('profession') ||
      h.includes('describes'))                      return 'occupation';
  if (h === 'utm source' || h === 'source')         return 'source';
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const str = text.replace(/^﻿/, ''); // strip BOM
  const rows = [];
  let row = [], field = '', inQuote = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i], next = str[i + 1];
    if (inQuote) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && next === '\n') i++;
        row.push(field); field = '';
        if (row.some(f => f.trim())) rows.push(row);
        row = [];
      } else { field += ch; }
    }
  }
  row.push(field);
  if (row.some(f => f.trim())) rows.push(row);
  return rows;
}

function expandScientific(str) {
  if (!str) return str;
  const s = str.trim();
  return /^[\d.]+[eE][+\-]?\d+$/.test(s) ? Math.round(Number(s)).toString() : s;
}

function mapRows(rawRows) {
  if (rawRows.length < 2) return { mapped: [], headerMap: [] };
  const headers = rawRows[0].map(h => h.trim());
  const dbKeys  = headers.map(h => mapHeader(h));

  // Build header map for debug display: [{ original, normalized, dbKey }]
  const headerMap = headers.map((h, i) => ({
    original:   h,
    normalized: normalizeHeader(h),
    dbKey:      dbKeys[i],
  }));

  const mapped = rawRows.slice(1).map(cols => {
    const obj = { source: 'luma' }; // always luma for CSV imports
    dbKeys.forEach((key, i) => {
      if (key && key !== 'source') obj[key] = expandScientific(cols[i] ?? '');
    });
    return obj;
  }).filter(r => r.email || r.phone);

  return { mapped, headerMap };
}

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function displayPhone(phone) {
  if (!phone) return '—';
  const s = expandScientific(phone.trim());
  const digits = s.replace(/\D/g, '');
  // Nigerian international (+234 XXX XXX XXXX — 13 digits)
  if (digits.length === 13 && digits.startsWith('234')) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  // Nigerian local (0XXX XXX XXXX — 11 digits)
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  // 10-digit normalized
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return s;
}

function csvEscape(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }

function downloadCSV(attendees) {
  const headers = ['#', 'Name', 'Email', 'Phone', 'Gender', 'Occupation', 'Address', 'Day 1 Check-in', 'Day 2 Check-in', 'Source'];
  const rows = attendees.map((a, i) => [
    i + 1, a.full_name, a.email ?? '', displayPhone(a.phone),
    a.gender ?? '', a.occupation ?? '', a.address ?? '',
    fmt(a.day1_checkin), fmt(a.day2_checkin), a.source,
  ].map(csvEscape).join(','));
  const csv = [headers.map(csvEscape).join(','), ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendees-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

async function apiGet(token, params) {
  const entries = Object.entries(params).filter(([, v]) => v !== '' && v != null);
  const qs = entries.length ? '?' + new URLSearchParams(entries).toString() : '';
  const res = await fetch(`${API_BASE}/api/admin/attendees${qs}`, { headers: { 'x-admin-token': token } });
  if (res.status === 401) throw new Error('Invalid admin token.');
  if (!res.ok) throw new Error('Server error. Please try again.');
  return res.json();
}

async function apiImport(token, rows) {
  const res = await fetch(`${API_BASE}/api/admin/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify({ rows }),
  });
  if (res.status === 401) throw new Error('Invalid admin token.');
  if (!res.ok) throw new Error('Server error. Please try again.');
  return res.json();
}

// ── Chip button ───────────────────────────────────────────────────────────────
function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '8px 16px', minHeight: 'auto', fontSize: '0.88rem',
      borderRadius: 8, cursor: 'pointer', fontWeight: 600,
      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
      background: active ? 'var(--accent)' : 'var(--surface)',
      color: active ? 'var(--accent-ink)' : 'var(--ink)',
      transition: 'all 0.12s',
    }}>
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Admin() {
  const stored = sessionStorage.getItem('admin_token') || '';
  const [token, setToken]     = useState(stored);
  const [authed, setAuthed]   = useState(!!stored);
  const [tokenInput, setTI]   = useState('');

  const [tab, setTab]         = useState('attendees'); // 'attendees' | 'import'

  // ── Attendees tab state
  const [filters, setFilters] = useState({ day: '', gender: '', occupation: '', from: '', to: '' });
  const [attendees, setAttendees] = useState(null);

  // ── Import tab state
  const fileRef               = useRef(null);
  const [preview, setPreview] = useState(null); // { rows, mapped }
  const [importResult, setImportResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (key) => (val) => setFilters(f => ({ ...f, [key]: val }));

  function handleLoginSubmit(e) {
    e.preventDefault();
    const t = tokenInput.trim();
    if (!t) return;
    sessionStorage.setItem('admin_token', t);
    setToken(t); setAuthed(true);
  }

  function handleLogout() {
    sessionStorage.removeItem('admin_token');
    setAuthed(false); setToken(''); setTI(''); setAttendees(null); setError('');
  }

  // ── Attendees fetch ────────────────────────────────────────────────────────
  async function handleFetch() {
    setLoading(true); setError('');
    try {
      const { attendees: data } = await apiGet(token, filters);
      setAttendees(data);
    } catch (err) {
      setError(err.message);
      if (err.message.includes('Invalid')) { sessionStorage.removeItem('admin_token'); setAuthed(false); }
    } finally { setLoading(false); }
  }

  // ── CSV file picked ────────────────────────────────────────────────────────
  function handleFilePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(null); setImportResult(null); setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rawRows = parseCSV(ev.target.result);
        const { mapped, headerMap } = mapRows(rawRows);
        if (mapped.length === 0) { setError('No data rows found or no rows have email/phone.'); return; }
        setPreview({ mapped, headerMap });
      } catch {
        setError('Could not parse the CSV file.');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  // ── Import submit ──────────────────────────────────────────────────────────
  async function handleImport() {
    if (!preview?.mapped?.length) return;
    setLoading(true); setError(''); setImportResult(null);
    try {
      const result = await apiImport(token, preview.mapped);
      setImportResult(result);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err.message);
      if (err.message.includes('Invalid')) { sessionStorage.removeItem('admin_token'); setAuthed(false); }
    } finally { setLoading(false); }
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <form onSubmit={handleLoginSubmit} className="card" style={{ gap: 'var(--space)', maxWidth: 380 }}>
          <h1 className="card__title" style={{ fontSize: '1.3rem' }}>Admin sign-in</h1>
          <label className="field">
            <span className="field__label">Admin token</span>
            <input type="password" className="field__input" value={tokenInput}
              onChange={e => setTI(e.target.value)} autoFocus autoComplete="current-password" />
          </label>
          {error && <div className="banner banner--error">{error}</div>}
          <button type="submit" className="btn btn--primary" disabled={!tokenInput.trim()}>Sign in</button>
        </form>
      </div>
    );
  }

  // ── Admin panel ────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 20px', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>

        {/* Header */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>Admin</h1>
          <button className="btn btn--ghost" onClick={handleLogout}
            style={{ padding: '8px 16px', minHeight: 'auto', fontSize: '0.85rem' }}>Sign out</button>
        </div>

        {/* Tabs */}
        <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[['attendees', 'Attendees'], ['import', 'Import CSV']].map(([id, label]) => (
            <Chip key={id} active={tab === id} onClick={() => { setTab(id); setError(''); }}>
              {label}
            </Chip>
          ))}
        </div>

        {/* ── ATTENDEES TAB ───────────────────────────────────────────────── */}
        {tab === 'attendees' && (
          <>
            {/* Filter card */}
            <div className="no-print" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '20px 20px 16px', marginBottom: 20 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 16 }}>

                <div>
                  <div style={labelStyle}>Day</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['', 'All'], ['1', 'Day 1'], ['2', 'Day 2']].map(([val, label]) => (
                      <Chip key={val} active={filters.day === val}
                        onClick={() => { set('day')(val); set('from')(''); set('to')(''); }}>
                        {label}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Gender</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['', 'All'], ['Female', 'Female'], ['Male', 'Male']].map(([val, label]) => (
                      <Chip key={val} active={filters.gender === val} onClick={() => set('gender')(val)}>
                        {label}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Category</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['', 'All'], ['student', 'Students']].map(([val, label]) => (
                      <Chip key={val} active={filters.occupation === val} onClick={() => set('occupation')(val)}>
                        {label}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>

              {filters.day && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
                  <label className="field" style={{ flex: '1 1 150px', maxWidth: 200 }}>
                    <span className="field__label">Check-in from</span>
                    <input type="time" className="field__input" value={filters.from} onChange={e => set('from')(e.target.value)} />
                  </label>
                  <label className="field" style={{ flex: '1 1 150px', maxWidth: 200 }}>
                    <span className="field__label">Check-in to</span>
                    <input type="time" className="field__input" value={filters.to} onChange={e => set('to')(e.target.value)} />
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn btn--primary" onClick={handleFetch} disabled={loading}
                  style={{ padding: '10px 28px', minHeight: 'auto' }}>
                  {loading ? 'Loading…' : 'Fetch'}
                </button>
                {error && <span style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</span>}
              </div>
            </div>

            {/* Results */}
            {attendees !== null && (
              <>
                <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {attendees.length} {attendees.length === 1 ? 'attendee' : 'attendees'}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn--ghost" onClick={() => downloadCSV(attendees)} disabled={!attendees.length}
                      style={{ padding: '8px 16px', minHeight: 'auto', fontSize: '0.88rem' }}>Download CSV</button>
                    <button className="btn btn--ghost" onClick={() => window.print()} disabled={!attendees.length}
                      style={{ padding: '8px 16px', minHeight: 'auto', fontSize: '0.88rem' }}>Download PDF</button>
                  </div>
                </div>

                {attendees.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ink-soft)', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}>
                    No attendees match the selected filters.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', borderRadius: 'var(--radius)', border: '1px solid var(--line)', background: 'var(--surface)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: '#f7f6f1', borderBottom: '2px solid var(--line)' }}>
                          {['#', 'Name', 'Email', 'Phone', 'Gender', 'Occupation', 'Address', 'Day 1', 'Day 2'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-soft)', whiteSpace: 'nowrap', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {attendees.map((a, i) => (
                          <tr key={a.id} style={{ borderBottom: '1px solid var(--line)' }}>
                            <td style={td}>{i + 1}</td>
                            <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{a.full_name}</td>
                            <td style={td}>{a.email ?? '—'}</td>
                            <td style={{ ...td, whiteSpace: 'nowrap' }}>{displayPhone(a.phone)}</td>
                            <td style={td}>{a.gender ?? '—'}</td>
                            <td style={td}>{a.occupation ?? '—'}</td>
                            <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.address ?? ''}>{a.address ?? '—'}</td>
                            <td style={{ ...td, whiteSpace: 'nowrap', color: a.day1_checkin ? '#1f7a3a' : 'var(--ink-soft)' }}>{fmt(a.day1_checkin)}</td>
                            <td style={{ ...td, whiteSpace: 'nowrap', color: a.day2_checkin ? '#1f7a3a' : 'var(--ink-soft)' }}>{fmt(a.day2_checkin)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── IMPORT TAB ──────────────────────────────────────────────────── */}
        {tab === 'import' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '24px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>Import from CSV</h2>
            <p style={{ margin: '0 0 20px', color: 'var(--ink-soft)', fontSize: '0.93rem' }}>
              Upload a Luma export CSV. Columns are mapped automatically. Duplicate emails/phones are skipped.
            </p>

            {/* Column mapping legend */}
            <div style={{ background: '#f7f6f1', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: '0.83rem', color: 'var(--ink-soft)' }}>
              <strong style={{ color: 'var(--ink)' }}>Column mapping (Luma CSV → database):</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '4px 0', marginTop: 8 }}>
                {[
                  ['name', 'full_name'],
                  ['email', 'email'],
                  ['phone_number', 'phone'],
                  ['gender', 'gender'],
                  ['🏠 What\'s your address?', 'address'],
                  ['👷🏼‍♂️ What Category Best Describes You?', 'occupation'],
                  ['(any column)', 'source = luma (always)'],
                ].map(([from, to]) => (
                  <div key={from} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <code style={{ background: '#eceae3', padding: '2px 6px', borderRadius: 4, fontSize: '0.8rem', color: 'var(--ink)' }}>{from}</code>
                    <span>→</span>
                    <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{to}</span>
                  </div>
                ))}
              </div>
            </div>

            <label className="field" style={{ marginBottom: 16 }}>
              <span className="field__label">CSV file</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="field__input"
                style={{ padding: '10px 14px' }} onChange={handleFilePick} />
            </label>

            {error && <div className="banner banner--error" style={{ marginBottom: 16 }}>{error}</div>}

            {importResult && (
              <div className="banner banner--info" style={{ marginBottom: 16 }}>
                Import complete: <strong>{importResult.inserted}</strong> inserted,{' '}
                <strong>{importResult.skipped}</strong> skipped (duplicates or no contact info).
              </div>
            )}

            {/* Preview */}
            {preview && (
              <>
                {/* Header mapping debug */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, fontSize: '0.88rem' }}>
                    Column mapping detected:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {preview.headerMap.map((h, i) => (
                      <span key={i} style={{
                        fontSize: '0.78rem', padding: '3px 8px', borderRadius: 6,
                        background: h.dbKey ? '#e6f4ea' : '#fde7e7',
                        color: h.dbKey ? '#1f7a3a' : '#b3261e',
                        border: `1px solid ${h.dbKey ? '#b6dfc2' : '#f5c2c2'}`,
                      }}>
                        {h.dbKey ? `${h.original} → ${h.dbKey}` : `${h.original} (ignored)`}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.93rem' }}>
                  Preview — {preview.mapped.length} rows detected
                </div>
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--line)', marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f7f6f1', borderBottom: '2px solid var(--line)' }}>
                        {['full_name', 'email', 'phone', 'gender', 'occupation', 'address', 'source'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--ink-soft)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.mapped.slice(0, 5).map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                          {['full_name', 'email', 'phone', 'gender', 'occupation', 'address', 'source'].map(key => (
                            <td key={key} style={{ padding: '8px 12px', color: 'var(--ink-soft)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {key === 'phone' ? displayPhone(row[key]) : (row[key] || '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.mapped.length > 5 && (
                  <div style={{ color: 'var(--ink-soft)', fontSize: '0.83rem', marginBottom: 16 }}>
                    … and {preview.mapped.length - 5} more rows
                  </div>
                )}
                <button className="btn btn--primary" onClick={handleImport} disabled={loading}
                  style={{ padding: '10px 28px', minHeight: 'auto' }}>
                  {loading ? 'Importing…' : `Import ${preview.mapped.length} rows`}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          table { font-size: 9px !important; }
          th, td { padding: 5px 7px !important; }
        }
      `}</style>
    </div>
  );
}

const labelStyle = {
  fontSize: '0.78rem', color: 'var(--ink-soft)', fontWeight: 600,
  marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em',
};
const td = { padding: '10px 14px', color: 'var(--ink-soft)' };
