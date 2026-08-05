import { useEffect, useState } from 'react';
import api from '../api/client';
import { useSettings } from '../context/SettingsContext.jsx';

export default function Dashboard() {
  const { formatMoney } = useSettings();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then(({ data }) => setData(data)).catch(() => setData(null));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
      <p className="text-ink-700 mb-6">Today's snapshot across the property.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Metric label="Occupancy" value={data ? `${data.rooms.occupancyRate}%` : '—'} sub={data ? `${data.rooms.occupied}/${data.rooms.total} rooms` : ''} />
        <Metric label="Arrivals Today" value={data?.arrivalsToday ?? '—'} />
        <Metric label="Departures Today" value={data?.departuresToday ?? '—'} />
        <Metric label="Revenue Today" value={data ? formatMoney(data.revenueToday) : '—'} accent />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-ink-700 mb-1">Housekeeping</p>
          <p className="text-3xl font-display">{data?.pendingHousekeepingTasks ?? '—'}</p>
          <p className="text-xs text-ink-700 mt-1">Tasks pending or in progress</p>
        </div>
        <div className="card">
          <p className="text-sm text-ink-700 mb-1">Low Stock Items</p>
          <p className="text-3xl font-display">{data?.lowStockItems ?? '—'}</p>
          <p className="text-xs text-ink-700 mt-1">At or below reorder level</p>
        </div>
        <div className="card">
          <p className="text-sm text-ink-700 mb-1">Outstanding Invoices</p>
          <p className="text-3xl font-display">{data ? formatMoney(data.outstandingInvoices.total) : '—'}</p>
          <p className="text-xs text-ink-700 mt-1">{data?.outstandingInvoices.count ?? 0} unpaid or partial</p>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, accent }) {
  return (
    <div className={`card ${accent ? 'bg-ink-950 text-linen-50 border-none' : ''}`}>
      <p className={`text-sm mb-1 ${accent ? 'text-linen-100/70' : 'text-ink-700'}`}>{label}</p>
      <p className="text-3xl font-display">{value}</p>
      {sub && <p className={`text-xs mt-1 ${accent ? 'text-linen-100/60' : 'text-ink-700'}`}>{sub}</p>}
    </div>
  );
}
