import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import AuthBackground from '../components/AuthBackground.jsx';

export default function Login() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch (err) {
      const message = typeof err.response?.data?.error === 'string' ? err.response.data.error : 'Invalid credentials.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthBackground>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-display text-3xl text-linen-50 tracking-tight">HotelPro <span className="text-brass-400">5.0</span></p>
          <p className="text-linen-100/60 text-sm mt-1">{settings?.hotel_name || 'Hotel Management System'}</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Username or Email</label>
            <input
              className="input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <PasswordInput
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </AuthBackground>
  );
}
