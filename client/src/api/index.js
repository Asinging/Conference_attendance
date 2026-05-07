import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const token = import.meta.env.VITE_EVENT_TOKEN || '';

const api = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 10000,
  headers: { 'x-event-token': token }
});

export async function lookup(identifier, day) {
  const { data } = await api.post('/lookup', { identifier, day });
  return data;
}

export async function checkin(attendee_id, day) {
  const { data } = await api.post('/checkin', { attendee_id, day });
  return data;
}

export async function register(payload) {
  const { data } = await api.post('/register', payload);
  return data;
}

export function getApiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return err?.response?.data?.message || err?.message || fallback;
}
