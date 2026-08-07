import { useState } from 'react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
      isActive ? 'bg-brass-500 text-ink-950 font-medium' : 'text-linen-100/80 hover:bg-white/5 hover:text-linen-50'
    }`;

  return (
    <div className="min-h-screen flex bg-linen-50">
      {/* Mobile sidebar overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-64 shrink-0 bg-ink-950 text-linen-100 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <div className="px-5 py-6 border-b border-white/10 flex items-center justify-between">
          <div className="min-w-0">
            <p className="font-display text-xl tracking-tight">HotelPro <span className="text-brass-400">5.0</span></p>
            <p className="text-xs text-linen-100/60 mt-0.5 truncate">{settings?.hotel_name || 'Your Hotel'}</p>
          </div>
          {/* Close button (mobile only) */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-linen-100/80 hover:text-linen-50 p-1"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={navLinkClass}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/settings"
            onClick={() => setSidebarOpen(false)}
            className={navLinkClass}
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

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <header className="h-16 bg-white border-b border-ink-900/10 flex items-center justify-between px-4 md:px-6">
          {/* Hamburger (mobile only) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 text-ink-800 hover:text-ink-950 rounded-md"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="text-sm text-ink-700 hidden sm:block">
            Currency: <span className="font-medium text-ink-950">{settings?.currency_code} ({formatMoney(0).replace(/0\.00.*/, '').trim() || settings?.currency_symbol})</span>
          </div>
          <div className="text-sm text-ink-700 text-right">
            {new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}