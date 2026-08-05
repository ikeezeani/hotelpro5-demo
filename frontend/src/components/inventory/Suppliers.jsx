import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', contactPerson: '', phone: '', email: '', address: '' });

  const load = () => {
    api.get('/inventory/suppliers').then(({ data }) => setSuppliers(data));
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory/suppliers', form);
      toast.success('Supplier added.');
      setShowForm(false);
      setForm({ name: '', contactPerson: '', phone: '', email: '', address: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not add supplier.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-ink-700">Vendors you order stock from.</p>
        <button className="btn-accent" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : 'New Supplier'}</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card mb-6 grid grid-cols-2 gap-4">
          <input required placeholder="Supplier name" className="input col-span-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Contact person" className="input" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          <input placeholder="Phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="Email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Address" className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <button className="btn-primary col-span-2">Add Supplier</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-700 border-b border-ink-900/10">
              <th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Contact</th><th className="py-2 pr-4">Phone</th><th className="py-2">Email</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b border-ink-900/5">
                <td className="py-2 pr-4">{s.name}</td>
                <td className="py-2 pr-4">{s.contact_person || '—'}</td>
                <td className="py-2 pr-4">{s.phone || '—'}</td>
                <td className="py-2">{s.email || '—'}</td>
              </tr>
            ))}
            {!suppliers.length && <tr><td colSpan={4} className="py-4 text-ink-700">No suppliers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
