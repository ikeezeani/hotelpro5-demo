import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import api from './api/client';
import { useAuth } from './context/AuthContext.jsx';

import SetupWizard from './pages/SetupWizard.jsx';
import Login from './pages/Login.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import FrontDesk from './pages/FrontDesk.jsx';
import Reservations from './pages/Reservations.jsx';
import Housekeeping from './pages/Housekeeping.jsx';
import PointOfSale from './pages/PointOfSale.jsx';
import Inventory from './pages/Inventory.jsx';
import Billing from './pages/Billing.jsx';
import GuestCRM from './pages/GuestCRM.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [status, setStatus] = useState({ loading: true, installed: null, dbUnreachable: false, serverUnreachable: false });

  const checkStatus = () => {
    setStatus((s) => ({ ...s, loading: true }));
    api.get('/setup/status')
      .then(({ data }) => setStatus({ loading: false, installed: data.installed, dbUnreachable: !!data.dbUnreachable, serverUnreachable: false }))
      .catch(() => setStatus({ loading: false, installed: false, dbUnreachable: false, serverUnreachable: true }));
  };

  useEffect(checkStatus, []);

  if (status.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-950">
        <p className="text-linen-100 font-display text-lg">Loading HotelPro 5.0…</p>
      </div>
    );
  }

  if (status.serverUnreachable) {
    return (
      <ConnectionProblem
        title="Can't reach the HotelPro 5.0 server"
        message="The web app can't connect to the backend API. Make sure the backend is running (npm start in /backend), then try again."
        onRetry={checkStatus}
      />
    );
  }

  if (status.dbUnreachable) {
    return (
      <ConnectionProblem
        title="Can't connect to the database"
        message="The backend is running but can't reach MySQL. Check that your MySQL service is running and that backend/.env has the correct DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME, then try again."
        onRetry={checkStatus}
      />
    );
  }

  if (!status.installed) {
    return (
      <Routes>
        <Route path="*" element={<SetupWizard onComplete={() => setStatus({ ...status, loading: false, installed: true })} />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="front-desk" element={<FrontDesk />} />
        <Route path="reservations" element={<Reservations />} />
        <Route path="housekeeping" element={<Housekeeping />} />
        <Route path="pos" element={<PointOfSale />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="billing" element={<Billing />} />
        <Route path="guests" element={<GuestCRM />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ConnectionProblem({ title, message, onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4">
      <div className="max-w-md w-full card text-center">
        <p className="text-3xl mb-3">⚠️</p>
        <h1 className="font-display text-xl mb-2">{title}</h1>
        <p className="text-sm text-ink-700 mb-5">{message}</p>
        <button className="btn-primary w-full" onClick={onRetry}>Try Again</button>
      </div>
    </div>
  );
}
