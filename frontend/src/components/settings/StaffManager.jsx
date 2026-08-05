import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';
import PasswordInput from '../PasswordInput.jsx';

const emptyForm = { fullName: '', email: '', username: '', password: '', roleId: '' };

export default function StaffManager() {
  const { user: currentUser } = useAuth();
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/auth/staff').then(({ data }) => setStaff(data));
  };
  useEffect(load, []);
  useEffect(() => {
    api.get('/auth/roles').then(({ data }) => setRoles(data));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/auth/staff', form);
      toast.success('Staff account created.');
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create staff account.');
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (member, roleId) => {
    try {
      await api.patch(`/auth/staff/${member.id}`, { roleId });
      toast.success(`${member.full_name}'s role updated.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update role.');
    }
  };

  const toggleStatus = async (member) => {
    const nextStatus = member.status === 'active' ? 'disabled' : 'active';
    try {
      await api.patch(`/auth/staff/${member.id}`, { status: nextStatus });
      toast.success(`${member.full_name} ${nextStatus === 'active' ? 'reactivated' : 'disabled'}.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update status.');
    }
  };

  const remove = async (member) => {
    if (!window.confirm(`Permanently delete ${member.full_name}'s account? This cannot be undone.`)) return;
    try {
      await api.delete(`/auth/staff/${member.id}`);
      toast.success('Staff account deleted.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete staff account.');
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card space-y-3">
        <h2 className="font-semibold">Add Staff Account</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Full Name</label>
            <input required className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Username</label>
            <input required className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <label className="label">Password</label>
            <PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" required />
          </div>
          <div className="col-span-2">
            <label className="label">Role</label>
            <select required className="input" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
              <option value="">Select role…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <button className="btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Staff Account'}</button>
      </form>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-3">Staff Accounts</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-700 border-b border-ink-900/10">
              <th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Username</th><th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Status</th><th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id} className="border-b border-ink-900/5">
                <td className="py-2 pr-4">{member.full_name}{member.id === currentUser?.id && <span className="text-xs text-ink-700"> (you)</span>}</td>
                <td className="py-2 pr-4">{member.username}</td>
                <td className="py-2 pr-4">
                  <select
                    className="input !py-1 !text-xs"
                    value={member.role_id}
                    onChange={(e) => changeRole(member, e.target.value)}
                    disabled={member.id === currentUser?.id}
                  >
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name.replace('_', ' ')}</option>)}
                  </select>
                </td>
                <td className="py-2 pr-4">
                  <span className={`badge ${member.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-linen-200 text-ink-700'}`}>
                    {member.status}
                  </span>
                </td>
                <td className="py-2 flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-ink-700 hover:text-ink-950"
                    onClick={() => toggleStatus(member)}
                    disabled={member.id === currentUser?.id}
                  >
                    {member.status === 'active' ? 'Disable' : 'Reactivate'}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-700 hover:text-red-900"
                    onClick={() => remove(member)}
                    disabled={member.id === currentUser?.id}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!staff.length && <tr><td colSpan={5} className="py-4 text-ink-700">No staff accounts yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
