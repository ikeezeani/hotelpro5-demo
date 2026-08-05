import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { useSettings } from '../../context/SettingsContext.jsx';

const STATUS_BADGE = {
  draft: 'bg-linen-200 text-ink-700',
  ordered: 'bg-brass-400/30 text-brass-600',
  received: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800'
};

const emptyLine = () => ({ itemId: '', quantity: 1, unitCost: 0 });

export default function PurchaseOrders() {
  const { formatMoney } = useSettings();
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState([emptyLine()]);

  const load = () => {
    api.get('/inventory/purchase-orders').then(({ data }) => setOrders(data));
    api.get('/inventory/suppliers').then(({ data }) => setSuppliers(data));
    api.get('/inventory/items').then(({ data }) => setItems(data));
  };
  useEffect(load, []);

  const updateLine = (idx, field, value) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      // Pre-fill unit cost from the item's current cost when an item is selected
      if (field === 'itemId') {
        const item = items.find((i) => String(i.id) === String(value));
        if (item) next[idx].unitCost = item.unit_cost;
      }
      return next;
    });
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);

  const resetForm = () => {
    setSupplierId('');
    setLines([emptyLine()]);
    setShowForm(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.itemId && l.quantity > 0);
    if (!validLines.length) {
      toast.error('Add at least one line item with a quantity.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/inventory/purchase-orders', {
        supplierId: supplierId || null,
        items: validLines.map((l) => ({ itemId: Number(l.itemId), quantity: Number(l.quantity), unitCost: Number(l.unitCost) }))
      });
      toast.success(`Purchase order ${data.poNumber} created.`);
      resetForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create purchase order.');
    } finally {
      setSaving(false);
    }
  };

  const receive = async (po) => {
    if (!window.confirm(`Mark ${po.po_number} as received? This will add its items to stock and cannot be undone.`)) return;
    try {
      await api.post(`/inventory/purchase-orders/${po.id}/receive`);
      toast.success(`${po.po_number} received — stock updated.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not receive this order.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-ink-700">Order stock from suppliers and receive it into inventory.</p>
        <button className="btn-accent" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : 'New Purchase Order'}</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card mb-6 space-y-4">
          <div>
            <label className="label">Supplier</label>
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">No specific supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Line Items</label>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <select
                    className="input col-span-5"
                    value={line.itemId}
                    onChange={(e) => updateLine(idx, 'itemId', e.target.value)}
                  >
                    <option value="">Select item…</option>
                    {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                  </select>
                  <input
                    type="number" min="0" step="0.01" placeholder="Qty"
                    className="input col-span-2"
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                  />
                  <input
                    type="number" min="0" step="0.01" placeholder="Unit cost"
                    className="input col-span-3"
                    value={line.unitCost}
                    onChange={(e) => updateLine(idx, 'unitCost', e.target.value)}
                  />
                  <span className="col-span-1 text-sm text-ink-700 text-right">
                    {formatMoney((Number(line.quantity) || 0) * (Number(line.unitCost) || 0))}
                  </span>
                  <button type="button" className="col-span-1 text-red-700 text-xs" onClick={() => removeLine(idx)} disabled={lines.length === 1}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-ghost !py-1 !px-2 text-xs mt-2" onClick={addLine}>+ Add line</button>
          </div>

          <div className="flex items-center justify-between border-t border-ink-900/10 pt-3">
            <span className="font-semibold">Total: {formatMoney(total)}</span>
            <button className="btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Purchase Order'}</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-700 border-b border-ink-900/10">
              <th className="py-2 pr-4">PO Number</th><th className="py-2 pr-4">Supplier</th><th className="py-2 pr-4">Total</th>
              <th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Created</th><th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((po) => (
              <tr key={po.id} className="border-b border-ink-900/5">
                <td className="py-2 pr-4 font-mono text-xs">{po.po_number}</td>
                <td className="py-2 pr-4">{po.supplier_name || '—'}</td>
                <td className="py-2 pr-4">{formatMoney(po.total_amount)}</td>
                <td className="py-2 pr-4"><span className={`badge ${STATUS_BADGE[po.status]}`}>{po.status}</span></td>
                <td className="py-2 pr-4">{new Date(po.created_at).toLocaleDateString()}</td>
                <td className="py-2">
                  {po.status === 'ordered' && (
                    <button className="btn-accent !py-1 !px-3 text-xs" onClick={() => receive(po)}>Receive</button>
                  )}
                </td>
              </tr>
            ))}
            {!orders.length && <tr><td colSpan={6} className="py-4 text-ink-700">No purchase orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
