import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { useSettings } from '../../context/SettingsContext.jsx';

export default function HotelProfileForm() {
  const { settings, refresh } = useSettings();
  const [form, setForm] = useState(null);
  const [currencies, setCurrencies] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);
  useEffect(() => {
    api.get('/settings/currencies').then(({ data }) => setCurrencies(data));
  }, []);

  if (!form) return null;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', form);
      toast.success('Settings saved.');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="card space-y-4">
      <h2 className="font-semibold">Hotel Profile &amp; Currency</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Hotel Name</label>
          <input className="input" value={form.hotel_name || ''} onChange={(e) => setForm({ ...form, hotel_name: e.target.value })} />
        </div>
        <div>
          <label className="label">Currency</label>
          <select
            className="input"
            value={form.currency_code}
            onChange={(e) => {
              const c = currencies.find((x) => x.code === e.target.value);
              setForm({ ...form, currency_code: c.code, currency_symbol: c.symbol });
            }}
          >
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tax %</label>
          <input type="number" step="0.01" className="input" value={form.tax_percent || 0} onChange={(e) => setForm({ ...form, tax_percent: e.target.value })} />
        </div>
        <div>
          <label className="label">Service Charge %</label>
          <input type="number" step="0.01" className="input" value={form.service_charge_percent || 0} onChange={(e) => setForm({ ...form, service_charge_percent: e.target.value })} />
        </div>
      </div>
      <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
    </form>
  );
}
