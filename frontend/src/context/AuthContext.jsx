import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('hp5_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('hp5_token', data.token);
    localStorage.setItem('hp5_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hp5_token');
    localStorage.removeItem('hp5_user');
    setUser(null);
    window.location.href = '/login';
  }, []);

  const can = useCallback(
    (module, action = 'read') => {
      if (!user?.permissions) return false;
      const perms = user.permissions;
      return (perms.all && perms.all.includes(action)) || (perms[module] && perms[module].includes(action));
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, can, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
