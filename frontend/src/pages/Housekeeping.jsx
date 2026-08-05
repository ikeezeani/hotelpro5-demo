import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';

const COLUMNS = ['pending', 'in_progress', 'completed', 'verified'];

export default function Housekeeping() {
  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);

  const load = () => {
    api.get('/housekeeping/tasks').then(({ data }) => setTasks(data));
    api.get('/housekeeping/room-status').then(({ data }) => setRooms(data));
  };
  useEffect(load, []);

  const advance = async (task) => {
    const next = { pending: 'in_progress', in_progress: 'completed', completed: 'verified' }[task.status];
    if (!next) return;
    try {
      await api.patch(`/housekeeping/tasks/${task.id}`, { status: next });
      toast.success(`Marked as ${next.replace('_', ' ')}.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed.');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Housekeeping</h1>
      <p className="text-ink-700 mb-6">Room cleaning and maintenance tasks.</p>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
        {COLUMNS.map((col) => (
          <div key={col} className="card !p-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-700 mb-3">{col.replace('_', ' ')}</h2>
            <div className="space-y-2">
              {tasks.filter((t) => t.status === col).map((t) => (
                <div key={t.id} className="bg-linen-50 rounded-md p-3 border border-ink-900/5">
                  <p className="font-medium text-sm">Room {t.room_number}</p>
                  <p className="text-xs text-ink-700 capitalize">{t.task_type.replace('_', ' ')} · {t.priority}</p>
                  {t.assigned_to_name && <p className="text-xs text-ink-700 mt-1">Assigned: {t.assigned_to_name}</p>}
                  {col !== 'verified' && (
                    <button onClick={() => advance(t)} className="btn-ghost !py-1 !px-2 text-xs mt-2">
                      Mark {({ pending: 'in progress', in_progress: 'completed', completed: 'verified' })[col]}
                    </button>
                  )}
                </div>
              ))}
              {!tasks.filter((t) => t.status === col).length && <p className="text-xs text-ink-700">No tasks.</p>}
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-semibold mb-3">Room Housekeeping Status</h2>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {rooms.map((r) => (
          <div key={r.id} className="card !p-3 text-center">
            <p className="font-display text-lg">{r.room_number}</p>
            <p className={`text-xs mt-1 capitalize ${r.housekeeping_status === 'clean' ? 'text-emerald-700' : 'text-amber-700'}`}>
              {r.housekeeping_status.replace('_', ' ')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
