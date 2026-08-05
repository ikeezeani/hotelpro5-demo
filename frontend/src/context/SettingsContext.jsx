import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/client';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/settings');
      setSettings(data);
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const formatMoney = useCallback(
    (value) => {
      const amount = Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const symbol = settings?.currency_symbol || '$';
      return settings?.currency_position === 'after' ? `${amount}${symbol}` : `${symbol}${amount}`;
    },
    [settings]
  );

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh, formatMoney }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
