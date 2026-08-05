import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';

const emptyForm = { room_type_id: '', room_number: '', floor: '' };

export default function RoomsManager({ roomTypes }) {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/front-desk/rooms').then(({ data }) => setRooms(data));
  };
  useEffect(load, []);

  const startEdit = (room) => {
    setEditingId(room.id);
    setForm({ room_type_id: room.room_type_id, room_number: room.room_number, floor: room.floor || '' });
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
        await api.put(`/front-desk/rooms/${editingId}`, form);
        toast.success('Room updated.');
      } else {
        await api.post('/front-desk/rooms', form);
        toast.success('Room added.');
      }
      cancelEdit();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save room.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (room) => {
    if (!window.confirm(`Delete room ${room.room_number}? This cannot be undone.`)) return;
    try {
      await api.delete(`/front-desk/rooms/${room.id}`);
      toast.success('Room deleted.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete room.');
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-semibold">{editingId ? 'Edit Room' : 'Add Room'}</h2>
      <div>
        <label className="label">Room Type</label>
        <select required className="input" value={form.room_type_id} onChange={(e) => setForm({ ...form, room_type_id: e.target.value })}>
          <option value="">Select room type…</option>
          {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Room Number</label>
        <input required className="input" value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} />
      </div>
      <div>
        <label className="label">Floor</label>
        <input className="input" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update Room' : 'Add Room'}</button>
        {editingId && <button type="button" className="btn-ghost" onClick={cancelEdit}>Cancel</button>}
      </div>

      <div className="pt-2 space-y-1 max-h-64 overflow-y-auto">
        {rooms.map((room) => (
          <div key={room.id} className="flex items-center justify-between text-sm border-b border-ink-900/5 py-1.5">
            <span>Room {room.room_number} — {room.room_type_name}{room.floor ? ` · Floor ${room.floor}` : ''}</span>
            <span className="flex gap-2">
              <button type="button" className="text-xs text-ink-700 hover:text-ink-950" onClick={() => startEdit(room)}>Edit</button>
              <button type="button" className="text-xs text-red-700 hover:text-red-900" onClick={() => remove(room)}>Delete</button>
            </span>
          </div>
        ))}
        {!rooms.length && <p className="text-sm text-ink-700">No rooms configured yet.</p>}
      </div>
    </form>
  );
}
