import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◈', end: true },
  { to: '/front-desk', label: 'Front Desk', icon: '🛎' },
  { to: '/reservations', label: 'Reservations', icon: '📖' },
  { to: '/housekeeping', label: 'Housekeeping', icon: '🧺' },
  { to: '/pos', label: 'Point of Sale', icon: '🧾' },
  { to: '/inventory', label: 'Inventory', icon: '📦' },
  { to: '/billing', label: 'Billing', icon: '💳' },
  { to: '/guests', label: 'Guest CRM', icon: '👤' },
  { to: '/reports', label: 'Reports', icon: '📊' }
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { settings, formatMoney } = useSettings();

  return (
    <div className="min-h-screen flex bg-linen-50">
      <aside className="w-64 shrink-0 bg-ink-950 text-linen-100 flex flex-col">
        <div className="px-5 py-6 border-b border-white/10">
          <p className="font-display text-xl tracking-tight">HotelPro <span className="text-brass-400">5.0</span></p>
          <p className="text-xs text-linen-100/60 mt-0.5 truncate">{settings?.hotel_name || 'Your Hotel'}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive ? 'bg-brass-500 text-ink-950 font-medium' : 'text-linen-100/80 hover:bg-white/5 hover:text-linen-50'
                }`
              }
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive ? 'bg-brass-500 text-ink-950 font-medium' : 'text-linen-100/80 hover:bg-white/5 hover:text-linen-50'
              }`
            }
          >
            <span aria-hidden="true">⚙</span> Settings
          </NavLink>
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-sm font-medium truncate">{user?.full_name}</p>
          <p className="text-xs text-linen-100/60 capitalize mb-3">{user?.role?.replace('_', ' ')}</p>
          <button onClick={logout} className="btn-ghost w-full !text-linen-100/80 hover:!bg-white/10 justify-start px-0">
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-ink-900/10 flex items-center justify-between px-6">
          <div className="text-sm text-ink-700">
            Currency: <span className="font-medium text-ink-950">{settings?.currency_code} ({formatMoney(0).replace(/0\.00.*/, '').trim() || settings?.currency_symbol})</span>
          </div>
          <div className="text-sm text-ink-700">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
