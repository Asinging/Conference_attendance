import { Routes, Route, Navigate } from 'react-router-dom';
import CheckIn from './pages/CheckIn.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/checkin" element={<CheckIn />} />
      <Route path="*" element={<Navigate to="/checkin" replace />} />
    </Routes>
  );
}
