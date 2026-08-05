import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useSettings } from '../context/SettingsContext.jsx';

export default function GuestCRM() {
  const { formatMoney } = useSettings();
  const [guests, setGuests] = useState([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  const search = () => {
    api.get('/guests', { params: { q } }).then(({ data }) => setGuests(data.data));
  };
  useEffect(search, [q]);

  const openGuest = (id) => api.get(`/guests/${id}`).then(({ data }) => setSelected(data));

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      await api.post(`/guests/${selected.id}/notes`, { note });
      setNote('');
      openGuest(selected.id);
    } catch { toast.error('Could not save note.'); }
  };

  const setVip = async (tier) => {
    try {
      await api.put(`/guests/${selected.id}`, { vipTier: tier });
      openGuest(selected.id);
      toast.success('VIP tier updated.');
    } catch { toast.error('Update failed.'); }
  };

  const createGuest = async (e) => {
    e.preventDefault();
    try {
      await api.post('/guests', form);
      toast.success('Guest profile created.');
      setShowForm(false);
      setForm({ firstName: '', lastName: '', email: '', phone: '' });
      search();
    } catch (err) { toast.error(err.response?.data?.error || 'Could not create guest.'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Guest CRM</h1>
          <p className="text-ink-700">Profiles, stay history and preferences.</p>
        </div>
        <button className="btn-accent" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : 'New Guest'}</button>
      </div>

      {showForm && (
        <form onSubmit={createGuest} className="card mb-6 grid grid-cols-2 gap-4">
          <input required placeholder="First name" className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <input required placeholder="Last name" className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <input placeholder="Email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <button className="btn-primary col-span-2">Save Guest</button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <input placeholder="Search guests…" className="input mb-3" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="space-y-2 max-h-[32rem] overflow-y-auto">
            {guests.map((g) => (
              <button key={g.id} onClick={() => openGuest(g.id)} className={`card !p-3 w-full text-left ${selected?.id === g.id ? 'border-brass-500' : ''}`}>
                <p className="font-medium text-sm">{g.first_name} {g.last_name}</p>
                <p className="text-xs text-ink-700">{g.email || g.phone || 'No contact info'}</p>
                {g.vip_tier !== 'none' && <span className="badge bg-brass-400/30 text-brass-600 mt-1 capitalize">{g.vip_tier}</span>}
              </button>
            ))}
            {!guests.length && <p className="text-sm text-ink-700">No guests found.</p>}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <div className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-display">{selected.first_name} {selected.last_name}</h2>
                  <p className="text-sm text-ink-700">{selected.email} {selected.phone && `· ${selected.phone}`}</p>
                </div>
                <select className="input !w-40" value={selected.vip_tier} onChange={(e) => setVip(e.target.value)}>
                  {['none', 'silver', 'gold', 'platinum'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <Stat label="Lifetime Spend" value={formatMoney(selected.lifetimeSpend)} />
                <Stat label="Loyalty Points" value={selected.loyalty_points} />
                <Stat label="Stays" value={selected.stayHistory.length} />
              </div>

              <h3 className="font-semibold mb-2">Stay History</h3>
              <div className="space-y-1 mb-6 text-sm">
                {selected.stayHistory.map((s) => (
                  <div key={s.id} className="flex justify-between border-b border-ink-900/5 py-1">
                    <span>Room {s.room_number}</span>
                    <span className="text-ink-700">{s.check_in_date} → {s.check_out_date}</span>
                  </div>
                ))}
                {!selected.stayHistory.length && <p className="text-ink-700">No previous stays.</p>}
              </div>

              <h3 className="font-semibold mb-2">Notes</h3>
              <div className="space-y-2 mb-3 text-sm">
                {selected.notes.map((n) => (
                  <div key={n.id} className="bg-linen-50 rounded-md p-2">
                    <p>{n.note}</p>
                    <p className="text-xs text-ink-700 mt-1">{n.author || 'Staff'} · {new Date(n.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="input" placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn-primary" onClick={addNote}>Add</button>
              </div>
            </div>
          ) : (
            <div className="card text-ink-700">Select a guest to view their profile.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-linen-50 rounded-md p-3">
      <p className="text-xs text-ink-700">{label}</p>
      <p className="text-lg font-display">{value}</p>
    </div>
  );
}
