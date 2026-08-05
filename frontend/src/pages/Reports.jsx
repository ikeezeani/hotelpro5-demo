import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';
import api from '../api/client';
import { useSettings } from '../context/SettingsContext.jsx';

export default function Reports() {
  const { formatMoney } = useSettings();
  const [occupancy, setOccupancy] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [posSales, setPosSales] = useState(null);
  const [inventoryReport, setInventoryReport] = useState(null);

  useEffect(() => {
    api.get('/reports/occupancy').then(({ data }) => setOccupancy(data));
    api.get('/reports/revenue').then(({ data }) => setRevenue(data));
    api.get('/reports/pos-sales').then(({ data }) => setPosSales(data));
    api.get('/reports/inventory').then(({ data }) => setInventoryReport(data));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Reports</h1>
      <p className="text-ink-700 mb-6">Occupancy, revenue and operational performance — last 30 days.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Room Revenue" value={revenue ? formatMoney(revenue.roomRevenue) : '—'} />
        <Stat label="POS Revenue" value={revenue ? formatMoney(revenue.posRevenue) : '—'} />
        <Stat label="ADR" value={revenue ? formatMoney(revenue.adr) : '—'} />
        <Stat label="RevPAR" value={revenue ? formatMoney(revenue.revPar) : '—'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h2 className="font-semibold mb-4">Occupancy Rate</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={occupancy?.data || []}>
              <CartesianGrid stroke="#1E332F" strokeOpacity={0.08} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="occupancyRate" stroke="#C08F3E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">POS Revenue by Outlet</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={posSales?.byOutlet || []}>
              <CartesianGrid stroke="#1E332F" strokeOpacity={0.08} />
              <XAxis dataKey="outlet" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatMoney(v)} />
              <Bar dataKey="revenue" fill="#0F1B1A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-3">Top Selling Items</h2>
          <table className="w-full text-sm">
            <tbody>
              {(posSales?.topItems || []).map((i) => (
                <tr key={i.name} className="border-b border-ink-900/5">
                  <td className="py-2">{i.name}</td>
                  <td className="py-2 text-right">{i.qty_sold}</td>
                  <td className="py-2 text-right">{formatMoney(i.revenue)}</td>
                </tr>
              ))}
              {!posSales?.topItems?.length && <tr><td className="py-2 text-ink-700">No sales recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-3">Low Stock Alerts</h2>
          <table className="w-full text-sm">
            <tbody>
              {(inventoryReport?.lowStock || []).map((i) => (
                <tr key={i.id} className="border-b border-ink-900/5">
                  <td className="py-2">{i.name}</td>
                  <td className="py-2 text-right text-amber-700">{i.quantity_on_hand} / {i.reorder_level} {i.unit}</td>
                </tr>
              ))}
              {!inventoryReport?.lowStock?.length && <tr><td className="py-2 text-ink-700">Stock levels are healthy.</td></tr>}
            </tbody>
          </table>
          {inventoryReport && <p className="text-xs text-ink-700 mt-3">Total inventory value: {formatMoney(inventoryReport.totalInventoryValue)}</p>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card">
      <p className="text-sm text-ink-700 mb-1">{label}</p>
      <p className="text-2xl font-display">{value}</p>
    </div>
  );
}
