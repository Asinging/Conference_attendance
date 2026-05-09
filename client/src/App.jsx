import { Routes, Route, Navigate } from 'react-router-dom';
import CheckIn from './pages/CheckIn.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/checkin" element={<CheckIn />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/checkin" replace />} />
    </Routes>
  );
}
