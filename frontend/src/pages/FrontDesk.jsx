import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useSettings } from '../context/SettingsContext.jsx';

const STATUS_COLORS = {
  available: 'bg-emerald-100 text-emerald-800',
  occupied: 'bg-ink-900 text-linen-50',
  reserved: 'bg-brass-400/30 text-brass-600',
  maintenance: 'bg-amber-100 text-amber-800',
  out_of_order: 'bg-red-100 text-red-800'
};

export default function FrontDesk() {
  const { formatMoney } = useSettings();
  const [rooms, setRooms] = useState([]);
  const [inHouse, setInHouse] = useState([]);
  const [pendingReservations, setPendingReservations] = useState([]);
  const [tab, setTab] = useState('board');

  const load = () => {
    api.get('/front-desk/rooms').then(({ data }) => setRooms(data));
    api.get('/front-desk/in-house').then(({ data }) => setInHouse(data));
    api.get('/reservations', { params: { status: 'confirmed' } }).then(({ data }) => setPendingReservations(data.data));
  };

  useEffect(load, []);

  const checkIn = async (reservationId) => {
    const availableRoom = rooms.find((r) => r.status === 'available');
    if (!availableRoom) return toast.error('No available rooms to assign.');
    try {
      await api.post('/front-desk/check-in', { reservationId, roomId: availableRoom.id });
      toast.success(`Checked in to room ${availableRoom.room_number}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Check-in failed.');
    }
  };

  const checkOut = async (stayId) => {
    try {
      await api.post('/front-desk/check-out', { stayId });
      toast.success('Guest checked out.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Check-out failed.');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Front Desk</h1>
      <p className="text-ink-700 mb-6">Room board, check-ins and check-outs.</p>

      <div className="flex gap-2 mb-4">
        {['board', 'arrivals', 'in-house'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} capitalize`}>{t.replace('-', ' ')}</button>
        ))}
      </div>

      {tab === 'board' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {rooms.map((r) => (
            <div key={r.id} className="card !p-3">
              <p className="font-display text-xl">{r.room_number}</p>
              <p className="text-xs text-ink-700 mb-2">{r.room_type_name} · Floor {r.floor}</p>
              <span className={`badge ${STATUS_COLORS[r.status]}`}>{r.status.replace('_', ' ')}</span>
              {r.housekeeping_status !== 'clean' && (
                <p className="text-xs text-amber-700 mt-1">HK: {r.housekeeping_status.replace('_', ' ')}</p>
              )}
            </div>
          ))}
          {!rooms.length && <p className="text-ink-700 col-span-full">No rooms configured yet — add rooms in Settings.</p>}
        </div>
      )}

      {tab === 'arrivals' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-700 border-b border-ink-900/10">
                <th className="py-2 pr-4">Guest</th><th className="py-2 pr-4">Room Type</th>
                <th className="py-2 pr-4">Check-in</th><th className="py-2 pr-4">Rate</th><th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pendingReservations.map((r) => (
                <tr key={r.id} className="border-b border-ink-900/5">
                  <td className="py-2 pr-4">{r.first_name} {r.last_name}</td>
                  <td className="py-2 pr-4">{r.room_type_name}</td>
                  <td className="py-2 pr-4">{r.check_in_date}</td>
                  <td className="py-2 pr-4">{formatMoney(r.rate_per_night)}</td>
                  <td className="py-2"><button className="btn-accent !py-1 !px-3" onClick={() => checkIn(r.id)}>Check in</button></td>
                </tr>
              ))}
              {!pendingReservations.length && <tr><td colSpan={5} className="py-4 text-ink-700">No confirmed arrivals pending.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'in-house' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-700 border-b border-ink-900/10">
                <th className="py-2 pr-4">Room</th><th className="py-2 pr-4">Guest</th>
                <th className="py-2 pr-4">Departure</th><th className="py-2 pr-4">Folio</th><th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {inHouse.map((s) => (
                <tr key={s.stay_id} className="border-b border-ink-900/5">
                  <td className="py-2 pr-4">{s.room_number}</td>
                  <td className="py-2 pr-4">{s.first_name} {s.last_name}</td>
                  <td className="py-2 pr-4">{s.check_out_date}</td>
                  <td className="py-2 pr-4">{s.folio_number}</td>
                  <td className="py-2"><button className="btn-primary !py-1 !px-3" onClick={() => checkOut(s.stay_id)}>Check out</button></td>
                </tr>
              ))}
              {!inHouse.length && <tr><td colSpan={5} className="py-4 text-ink-700">No guests currently in house.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
