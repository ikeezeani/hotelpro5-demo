import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useSettings } from '../context/SettingsContext.jsx';

const STATUS_BADGE = {
  booked: 'bg-linen-200 text-ink-800',
  confirmed: 'bg-brass-400/30 text-brass-600',
  checked_in: 'bg-ink-900 text-linen-50',
  checked_out: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-red-100 text-red-800'
};

export default function Reservations() {
  const { formatMoney } = useSettings();
  const [reservations, setReservations] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    newGuest: { firstName: '', lastName: '', email: '', phone: '' },
    roomTypeId: '', checkInDate: '', checkOutDate: '', adults: 1, children: 0, source: 'walk_in', specialRequests: ''
  });

  const load = () => {
    api.get('/reservations').then(({ data }) => setReservations(data.data));
    api.get('/front-desk/room-types').then(({ data }) => setRoomTypes(data));
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/reservations', form);
      toast.success('Reservation created.');
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create reservation.');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id, status) => {
    try {
      await api.patch(`/reservations/${id}/status`, { status });
      toast.success('Status updated.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Reservations</h1>
          <p className="text-ink-700">Bookings across all channels.</p>
        </div>
        <button className="btn-accent" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : 'New Reservation'}</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card mb-6 space-y-4">
          <h2 className="font-semibold">Guest Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name</label>
              <input required className="input" value={form.newGuest.firstName}
                onChange={(e) => setForm({ ...form, newGuest: { ...form.newGuest, firstName: e.target.value } })} />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input required className="input" value={form.newGuest.lastName}
                onChange={(e) => setForm({ ...form, newGuest: { ...form.newGuest, lastName: e.target.value } })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={form.newGuest.email}
                onChange={(e) => setForm({ ...form, newGuest: { ...form.newGuest, email: e.target.value } })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.newGuest.phone}
                onChange={(e) => setForm({ ...form, newGuest: { ...form.newGuest, phone: e.target.value } })} />
            </div>
          </div>

          <h2 className="font-semibold pt-2">Stay Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Room Type</label>
              <select required className="input" value={form.roomTypeId} onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}>
                <option value="">Select room type…</option>
                {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name} — {formatMoney(rt.base_rate)}/night</option>)}
              </select>
            </div>
            <div>
              <label className="label">Booking Source</label>
              <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {['walk_in', 'phone', 'website', 'ota', 'corporate'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Check-in Date</label>
              <input required type="date" className="input" value={form.checkInDate} onChange={(e) => setForm({ ...form, checkInDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Check-out Date</label>
              <input required type="date" className="input" value={form.checkOutDate} onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Adults</label>
              <input type="number" min="1" className="input" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} />
            </div>
            <div>
              <label className="label">Children</label>
              <input type="number" min="0" className="input" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Special Requests</label>
            <textarea className="input" value={form.specialRequests} onChange={(e) => setForm({ ...form, specialRequests: e.target.value })} />
          </div>
          <button disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Create Reservation'}</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-700 border-b border-ink-900/10">
              <th className="py-2 pr-4">Code</th><th className="py-2 pr-4">Guest</th><th className="py-2 pr-4">Room Type</th>
              <th className="py-2 pr-4">Dates</th><th className="py-2 pr-4">Rate</th><th className="py-2 pr-4">Status</th><th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.id} className="border-b border-ink-900/5">
                <td className="py-2 pr-4 font-mono text-xs">{r.confirmation_code}</td>
                <td className="py-2 pr-4">{r.first_name} {r.last_name}</td>
                <td className="py-2 pr-4">{r.room_type_name}</td>
                <td className="py-2 pr-4">{r.check_in_date} → {r.check_out_date}</td>
                <td className="py-2 pr-4">{formatMoney(r.rate_per_night)}</td>
                <td className="py-2 pr-4"><span className={`badge ${STATUS_BADGE[r.status]}`}>{r.status.replace('_', ' ')}</span></td>
                <td className="py-2">
                  {r.status === 'booked' && <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => setStatus(r.id, 'confirmed')}>Confirm</button>}
                  {['booked', 'confirmed'].includes(r.status) && <button className="btn-ghost !py-1 !px-2 text-xs text-red-700" onClick={() => setStatus(r.id, 'cancelled')}>Cancel</button>}
                </td>
              </tr>
            ))}
            {!reservations.length && <tr><td colSpan={7} className="py-4 text-ink-700">No reservations yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
