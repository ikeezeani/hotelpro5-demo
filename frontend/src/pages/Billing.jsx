import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useSettings } from '../context/SettingsContext.jsx';

const STATUS_BADGE = {
  unpaid: 'bg-red-100 text-red-800',
  partial: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
  void: 'bg-linen-200 text-ink-700',
  refunded: 'bg-linen-200 text-ink-700'
};

export default function Billing() {
  const { formatMoney } = useSettings();
  const [invoices, setInvoices] = useState([]);
  const [inHouse, setInHouse] = useState([]);
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ method: 'cash', amount: '' });

  const load = () => {
    api.get('/billing/invoices').then(({ data }) => setInvoices(data));
    api.get('/front-desk/in-house').then(({ data }) => setInHouse(data));
  };
  useEffect(load, []);

  const generateInvoice = async (folioId) => {
    try {
      const { data } = await api.post('/billing/invoices', { folioId });
      toast.success(`Invoice ${data.invoiceNumber} generated for ${formatMoney(data.total)}.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not generate invoice.');
    }
  };

  const recordPayment = async () => {
    try {
      await api.post('/billing/payments', { invoiceId: payModal.id, method: payForm.method, amount: parseFloat(payForm.amount) });
      toast.success('Payment recorded.');
      setPayModal(null);
      setPayForm({ method: 'cash', amount: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment failed.');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Billing</h1>
      <p className="text-ink-700 mb-6">Folios, invoices and payments.</p>

      <div className="card mb-6">
        <h2 className="font-semibold mb-3">Generate Invoice from Open Folio</h2>
        <div className="flex flex-wrap gap-2">
          {inHouse.filter((s) => s.folio_id).map((s) => (
            <button key={s.folio_id} className="btn-ghost" onClick={() => generateInvoice(s.folio_id)}>
              Room {s.room_number} — {s.first_name} {s.last_name}
            </button>
          ))}
          {!inHouse.length && <p className="text-sm text-ink-700">No open folios right now.</p>}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-700 border-b border-ink-900/10">
              <th className="py-2 pr-4">Invoice</th><th className="py-2 pr-4">Guest</th><th className="py-2 pr-4">Total</th>
              <th className="py-2 pr-4">Paid</th><th className="py-2 pr-4">Balance</th><th className="py-2 pr-4">Status</th><th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-ink-900/5">
                <td className="py-2 pr-4 font-mono text-xs">{inv.invoice_number}</td>
                <td className="py-2 pr-4">{inv.first_name ? `${inv.first_name} ${inv.last_name}` : '—'}</td>
                <td className="py-2 pr-4">{formatMoney(inv.total_amount)}</td>
                <td className="py-2 pr-4">{formatMoney(inv.amount_paid)}</td>
                <td className="py-2 pr-4">{formatMoney(inv.balance_due)}</td>
                <td className="py-2 pr-4"><span className={`badge ${STATUS_BADGE[inv.status]}`}>{inv.status}</span></td>
                <td className="py-2">
                  {['unpaid', 'partial'].includes(inv.status) && (
                    <button className="btn-accent !py-1 !px-3 text-xs" onClick={() => { setPayModal(inv); setPayForm({ method: 'cash', amount: inv.balance_due }); }}>
                      Record Payment
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!invoices.length && <tr><td colSpan={7} className="py-4 text-ink-700">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
          <div className="card w-full max-w-sm">
            <h2 className="font-semibold mb-4">Record Payment — {payModal.invoice_number}</h2>
            <label className="label">Payment Method</label>
            <select className="input mb-3" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              {['cash', 'card', 'bank_transfer', 'mobile_money', 'paystack', 'stripe', 'flutterwave'].map((m) => (
                <option key={m} value={m}>{m.replace('_', ' ')}</option>
              ))}
            </select>
            <label className="label">Amount</label>
            <input type="number" step="0.01" className="input mb-4" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setPayModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={recordPayment}>Confirm Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
