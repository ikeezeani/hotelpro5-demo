import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { useSettings } from '../../context/SettingsContext.jsx';

export default function StockItems() {
  const { formatMoney } = useSettings();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', unit: 'pcs', quantityOnHand: 0, reorderLevel: 0, unitCost: 0, isSellable: false, sellingPrice: 0 });

  const load = () => {
    api.get('/inventory/items').then(({ data }) => setItems(data));
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory/items', form);
      toast.success('Item added.');
      setShowForm(false);
      setForm({ name: '', unit: 'pcs', quantityOnHand: 0, reorderLevel: 0, unitCost: 0, isSellable: false, sellingPrice: 0 });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not add item.');
    }
  };

  const adjustStock = async (item) => {
    const qty = window.prompt(`Adjust stock for "${item.name}" (use negative numbers to remove stock):`, '0');
    const n = parseFloat(qty);
    if (!n) return;
    try {
      await api.post('/inventory/transactions', {
        itemId: item.id,
        type: n < 0 ? 'usage_out' : 'adjustment',
        quantity: Math.abs(n),
        notes: 'Manual adjustment'
      });
      toast.success('Stock adjusted.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Adjustment failed.');
    }
  };

  const sendDigestNow = async () => {
    try {
      await api.post('/inventory/low-stock-digest/send-now');
      toast.success('Low stock digest triggered — check email if SMTP is configured.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send digest.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-ink-700">Stock levels across housekeeping, F&amp;B and other departments.</p>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={sendDigestNow}>Send Low Stock Digest Now</button>
          <button className="btn-accent" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : 'New Item'}</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card mb-6 grid grid-cols-2 gap-4">
          <input required placeholder="Item name" className="input col-span-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Unit (pcs, kg, bottle…)" className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <input type="number" placeholder="Starting quantity" className="input" value={form.quantityOnHand} onChange={(e) => setForm({ ...form, quantityOnHand: e.target.value })} />
          <input type="number" placeholder="Reorder level" className="input" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
          <input type="number" placeholder="Unit cost" className="input" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isSellable} onChange={(e) => setForm({ ...form, isSellable: e.target.checked })} /> Sellable in POS
          </label>
          {form.isSellable && (
            <input type="number" placeholder="Selling price" className="input" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
          )}
          <button className="btn-primary col-span-2">Add Item</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-700 border-b border-ink-900/10">
              <th className="py-2 pr-4">Item</th><th className="py-2 pr-4">Qty on hand</th><th className="py-2 pr-4">Reorder level</th>
              <th className="py-2 pr-4">Unit cost</th><th className="py-2 pr-4">Sellable</th><th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className={`border-b border-ink-900/5 ${i.quantity_on_hand <= i.reorder_level ? 'bg-amber-50' : ''}`}>
                <td className="py-2 pr-4">{i.name}</td>
                <td className="py-2 pr-4">{i.quantity_on_hand} {i.unit}</td>
                <td className="py-2 pr-4">{i.reorder_level}</td>
                <td className="py-2 pr-4">{formatMoney(i.unit_cost)}</td>
                <td className="py-2 pr-4">{i.is_sellable ? formatMoney(i.selling_price) : '—'}</td>
                <td className="py-2"><button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => adjustStock(i)}>Adjust</button></td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={6} className="py-4 text-ink-700">No inventory items yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
