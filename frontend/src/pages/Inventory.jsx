import { useState } from 'react';
import StockItems from '../components/inventory/StockItems.jsx';
import PurchaseOrders from '../components/inventory/PurchaseOrders.jsx';
import Suppliers from '../components/inventory/Suppliers.jsx';

const TABS = [
  { key: 'items', label: 'Stock Items' },
  { key: 'purchase-orders', label: 'Purchase Orders' },
  { key: 'suppliers', label: 'Suppliers' }
];

export default function Inventory() {
  const [tab, setTab] = useState('items');

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Inventory</h1>
      <p className="text-ink-700 mb-4">Stock, purchasing and suppliers across the property.</p>

      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'items' && <StockItems />}
      {tab === 'purchase-orders' && <PurchaseOrders />}
      {tab === 'suppliers' && <Suppliers />}
    </div>
  );
}
