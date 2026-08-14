import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

/*
 * Safely read the saved HotelPro user from localStorage.
 *
 * This prevents corrupted, empty, undefined, null, or
 * old/invalid localStorage data from crashing the application.
 */
function getStoredUser() {
  try {
    const stored = localStorage.getItem('hp5_user');

    // Nothing saved yet.
    if (!stored || stored === 'undefined' || stored === 'null') {
      return null;
    }

    const parsed = JSON.parse(stored);

    // Make sure the parsed value is actually an object.
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem('hp5_user');
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn(
      'HotelPro: invalid saved user data. Clearing local session.',
      error
    );

    // Remove corrupted session data.
    localStorage.removeItem('hp5_user');
    localStorage.removeItem('hp5_token');

    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);

  /*
   * =========================================================
   * LOGIN
   * =========================================================
   */
  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login', {
      username,
      password
    });

    /*
     * Make sure the backend returned a valid login response.
     */
    if (!data?.token || !data?.user) {
      throw new Error(
        'Login failed: the server returned an invalid authentication response.'
      );
    }

    /*
     * Save the authenticated session.
     */
    localStorage.setItem('hp5_token', data.token);
    localStorage.setItem('hp5_user', JSON.stringify(data.user));

    setUser(data.user);

    return data.user;
  }, []);

  /*
   * =========================================================
   * LOGOUT
   * =========================================================
   */
  const logout = useCallback(() => {
    localStorage.removeItem('hp5_token');
    localStorage.removeItem('hp5_user');

    setUser(null);

    window.location.href = '/login';
  }, []);

  /*
   * =========================================================
   * PERMISSION CHECK
   * =========================================================
   */
  const can = useCallback(
    (module, action = 'read') => {
      if (!user?.permissions) {
        return false;
      }

      const permissions = user.permissions;

      /*
       * Global permissions.
       */
      if (
        Array.isArray(permissions.all) &&
        permissions.all.includes(action)
      ) {
        return true;
      }

      /*
       * Module-specific permissions.
       */
      if (
        Array.isArray(permissions[module]) &&
        permissions[module].includes(action)
      ) {
        return true;
      }

      return false;
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        can,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);