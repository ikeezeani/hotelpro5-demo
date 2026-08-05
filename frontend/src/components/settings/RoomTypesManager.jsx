import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { useSettings } from '../../context/SettingsContext.jsx';

const emptyForm = { name: '', base_rate: '', max_occupancy: 2 };

export default function RoomTypesManager({ onChange }) {
  const { formatMoney } = useSettings();
  const [roomTypes, setRoomTypes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/front-desk/room-types').then(({ data }) => {
      setRoomTypes(data);
      onChange?.(data);
    });
  };
  useEffect(load, []);

  const startEdit = (rt) => {
    setEditingId(rt.id);
    setForm({ name: rt.name, base_rate: rt.base_rate, max_occupancy: rt.max_occupancy });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/front-desk/room-types/${editingId}`, form);
        toast.success('Room type updated.');
      } else {
        await api.post('/front-desk/room-types', form);
        toast.success('Room type added.');
      }
      cancelEdit();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save room type.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (rt) => {
    if (!window.confirm(`Delete room type "${rt.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/front-desk/room-types/${rt.id}`);
      toast.success('Room type deleted.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete room type.');
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-semibold">{editingId ? 'Edit Room Type' : 'Add Room Type'}</h2>
      <div>
        <label className="label">Name</label>
        <input required placeholder="e.g. Deluxe Room" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="label">Base Rate per Night</label>
        <input required type="number" className="input" value={form.base_rate} onChange={(e) => setForm({ ...form, base_rate: e.target.value })} />
      </div>
      <div>
        <label className="label">Max Occupancy</label>
        <input type="number" className="input" value={form.max_occupancy} onChange={(e) => setForm({ ...form, max_occupancy: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update Room Type' : 'Add Room Type'}</button>
        {editingId && <button type="button" className="btn-ghost" onClick={cancelEdit}>Cancel</button>}
      </div>

      <div className="pt-2 space-y-1">
        {roomTypes.map((rt) => (
          <div key={rt.id} className="flex items-center justify-between text-sm border-b border-ink-900/5 py-1.5">
            <span>{rt.name} — {formatMoney(rt.base_rate)}/night</span>
            <span className="flex gap-2">
              <button type="button" className="text-xs text-ink-700 hover:text-ink-950" onClick={() => startEdit(rt)}>Edit</button>
              <button type="button" className="text-xs text-red-700 hover:text-red-900" onClick={() => remove(rt)}>Delete</button>
            </span>
          </div>
        ))}
        {!roomTypes.length && <p className="text-sm text-ink-700">No room types yet.</p>}
      </div>
    </form>
  );
}
