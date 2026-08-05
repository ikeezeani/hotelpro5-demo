import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useSettings } from '../context/SettingsContext.jsx';

export default function PointOfSale() {
  const { settings, formatMoney } = useSettings();
  const [outlets, setOutlets] = useState([]);
  const [items, setItems] = useState([]);
  const [outletId, setOutletId] = useState('');
  const [cart, setCart] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [inHouse, setInHouse] = useState([]);
  const [linkStay, setLinkStay] = useState('');

  const load = () => {
    api.get('/pos/outlets').then(({ data }) => { setOutlets(data); if (data[0]) setOutletId(data[0].id); });
    api.get('/inventory/items', { params: { sellable: true } }).then(({ data }) => setItems(data));
    api.get('/pos/orders').then(({ data }) => setRecentOrders(data.slice(0, 8)));
    api.get('/front-desk/in-house').then(({ data }) => setInHouse(data));
  };
  useEffect(load, []);

  const addToCart = (item) => {
    setCart((c) => {
      const existing = c.find((i) => i.itemId === item.id);
      if (existing) return c.map((i) => (i.itemId === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...c, { itemId: item.id, name: item.name, quantity: 1, unitPrice: Number(item.selling_price) }];
    });
  };

  const subtotal = cart.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const taxAmount = subtotal * ((settings?.tax_percent || 0) / 100);
  const serviceCharge = subtotal * ((settings?.service_charge_percent || 0) / 100);
  const total = subtotal + taxAmount + serviceCharge;

  const voidOrder = async (order) => {
    if (!window.confirm(`Void order ${order.order_number}? Any stock it deducted will be restored.`)) return;
    try {
      await api.patch(`/pos/orders/${order.id}/void`);
      toast.success('Order voided — stock restored.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not void this order.');
    }
  };


  const checkout = async (chargeToRoom) => {
    if (!cart.length) return toast.error('Cart is empty.');
    try {
      const stay = inHouse.find((s) => String(s.stay_id) === linkStay);
      const { data } = await api.post('/pos/orders', {
        outletId, items: cart,
        stayId: chargeToRoom ? stay?.stay_id : undefined,
        guestId: chargeToRoom ? undefined : undefined,
        taxPercent: settings?.tax_percent || 0,
        serviceChargePercent: settings?.service_charge_percent || 0
      });
      if (chargeToRoom && stay) {
        await api.post(`/pos/orders/${data.id}/charge-to-room`);
        toast.success(`Charged ${formatMoney(data.total)} to room ${stay.room_number}.`);
      } else {
        toast.success(`Order ${data.orderNumber} created — ${formatMoney(data.total)}.`);
      }
      setCart([]);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Checkout failed.');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Point of Sale</h1>
      <p className="text-ink-700 mb-6">Restaurant, bar, spa and shop sales.</p>

      <div className="flex gap-2 mb-4">
        {outlets.map((o) => (
          <button key={o.id} onClick={() => setOutletId(o.id)} className={`btn ${outletId === o.id ? 'btn-primary' : 'btn-ghost'}`}>{o.name}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
          {items.map((item) => (
            <button key={item.id} onClick={() => addToCart(item)} className="card !p-3 text-left hover:border-brass-500 border border-transparent">
              <p className="font-medium text-sm">{item.name}</p>
              <p className="text-xs text-ink-700">{formatMoney(item.selling_price)}</p>
            </button>
          ))}
          {!items.length && <p className="text-ink-700 col-span-full">No sellable items yet — add products in Inventory.</p>}
        </div>

        <div className="card h-fit">
          <h2 className="font-semibold mb-3">Current Order</h2>
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {cart.map((i) => (
              <div key={i.itemId} className="flex justify-between text-sm">
                <span>{i.quantity}× {i.name}</span>
                <span>{formatMoney(i.quantity * i.unitPrice)}</span>
              </div>
            ))}
            {!cart.length && <p className="text-xs text-ink-700">Tap items to add them to the order.</p>}
          </div>
          <div className="border-t border-ink-900/10 pt-2 text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
            <div className="flex justify-between"><span>{settings?.tax_label || 'Tax'}</span><span>{formatMoney(taxAmount)}</span></div>
            <div className="flex justify-between"><span>Service charge</span><span>{formatMoney(serviceCharge)}</span></div>
            <div className="flex justify-between font-semibold text-base pt-1"><span>Total</span><span>{formatMoney(total)}</span></div>
          </div>

          <select className="input mt-4" value={linkStay} onChange={(e) => setLinkStay(e.target.value)}>
            <option value="">Walk-in / pay now</option>
            {inHouse.map((s) => <option key={s.stay_id} value={s.stay_id}>Room {s.room_number} — {s.first_name} {s.last_name}</option>)}
          </select>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button className="btn-primary" onClick={() => checkout(false)}>Take Payment</button>
            <button className="btn-accent" onClick={() => checkout(true)} disabled={!linkStay}>Charge to Room</button>
          </div>
        </div>
      </div>

      <h2 className="font-semibold mt-8 mb-3">Recent Orders</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-ink-700 border-b border-ink-900/10"><th className="py-2 pr-4">Order</th><th className="py-2 pr-4">Outlet</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Status</th><th className="py-2"></th></tr></thead>
          <tbody>
            {recentOrders.map((o) => (
              <tr key={o.id} className="border-b border-ink-900/5">
                <td className="py-2 pr-4 font-mono text-xs">{o.order_number}</td>
                <td className="py-2 pr-4">{o.outlet_name}</td>
                <td className="py-2 pr-4">{formatMoney(o.total_amount)}</td>
                <td className="py-2 pr-4 capitalize">{o.status.replace('_', ' ')}</td>
                <td className="py-2">
                  {o.status !== 'void' && (
                    <button className="text-xs text-red-700 hover:text-red-900" onClick={() => voidOrder(o)}>Void</button>
                  )}
                </td>
              </tr>
            ))}
            {!recentOrders.length && <tr><td colSpan={5} className="py-4 text-ink-700">No orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
