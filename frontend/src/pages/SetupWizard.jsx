import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import PasswordInput from '../components/PasswordInput.jsx';
import AuthBackground from '../components/AuthBackground.jsx';

const STEPS = ['Hotel Profile', 'Currency', 'Tax & Policies', 'Administrator', 'Review'];

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [currencies, setCurrencies] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    hotelName: '', legalName: '', address: '', city: '', state: '', country: '', phone: '', email: '',
    timezone: 'Africa/Lagos',
    currencyCode: 'USD', currencySymbol: '$', currencyPosition: 'before',
    taxPercent: 0, taxLabel: 'Tax', serviceChargePercent: 0, checkinTime: '14:00', checkoutTime: '12:00',
    admin: { fullName: '', email: '', username: '', password: '' }
  });

  useEffect(() => {
    api.get('/settings/currencies').then(({ data }) => setCurrencies(data)).catch(() => setCurrencies([]));
  }, []);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const updateAdmin = (field, value) => setForm((f) => ({ ...f, admin: { ...f.admin, [field]: value } }));

  const selectCurrency = (code) => {
    const c = currencies.find((x) => x.code === code);
    if (c) setForm((f) => ({ ...f, currencyCode: c.code, currencySymbol: c.symbol }));
  };

  const validateStep = () => {
    if (step === 0) return form.hotelName && form.address && form.city && form.country && form.phone && form.email;
    if (step === 1) return form.currencyCode && form.currencySymbol;
    if (step === 3) return form.admin.fullName && form.admin.email && form.admin.username && form.admin.password.length >= 8;
    return true;
  };

  const next = () => {
    if (!validateStep()) {
      toast.error('Please complete all required fields before continuing.');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    setSubmitting(true);
    try {
      await api.post('/setup/install', {
        ...form,
        checkinTime: `${form.checkinTime}:00`,
        checkoutTime: `${form.checkoutTime}:00`
      });
      toast.success('HotelPro 5.0 installed successfully!');
      onComplete();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Installation failed. Confirm the database schema has been migrated.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthBackground>
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <p className="font-display text-3xl text-linen-50 tracking-tight">HotelPro <span className="text-brass-400">5.0</span></p>
          <p className="text-linen-100/60 text-sm mt-1">Installation Wizard</p>
        </div>

        {/* Step indicator */}
        <ol className="flex items-center justify-between mb-6 text-xs text-linen-100/60">
          {STEPS.map((label, i) => (
            <li key={label} className={`flex-1 text-center pb-2 border-b-2 ${i <= step ? 'border-brass-400 text-brass-400' : 'border-white/10'}`}>
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        <div className="card">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Hotel Profile</h2>
              <Field label="Hotel Name *"><input className="input" value={form.hotelName} onChange={(e) => update('hotelName', e.target.value)} /></Field>
              <Field label="Legal / Registered Name"><input className="input" value={form.legalName} onChange={(e) => update('legalName', e.target.value)} /></Field>
              <Field label="Street Address *"><input className="input" value={form.address} onChange={(e) => update('address', e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="City *"><input className="input" value={form.city} onChange={(e) => update('city', e.target.value)} /></Field>
                <Field label="State / Province"><input className="input" value={form.state} onChange={(e) => update('state', e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Country *"><input className="input" value={form.country} onChange={(e) => update('country', e.target.value)} /></Field>
                <Field label="Timezone"><input className="input" value={form.timezone} onChange={(e) => update('timezone', e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Phone *"><input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} /></Field>
                <Field label="Email *"><input type="email" className="input" value={form.email} onChange={(e) => update('email', e.target.value)} /></Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Choose Your Currency</h2>
              <p className="text-sm text-ink-700">This sets the currency used across billing, POS, invoices and reports. You can change it later in Settings.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1">
                {currencies.map((c) => (
                  <button
                    type="button"
                    key={c.code}
                    onClick={() => selectCurrency(c.code)}
                    className={`text-left rounded-md border px-3 py-2 text-sm transition-colors ${
                      form.currencyCode === c.code ? 'border-brass-500 bg-brass-500/10' : 'border-ink-900/10 hover:border-ink-900/30'
                    }`}
                  >
                    <span className="font-medium">{c.code}</span> <span className="text-ink-700">{c.symbol}</span>
                    <p className="text-xs text-ink-700 truncate">{c.name}</p>
                  </button>
                ))}
              </div>
              <Field label="Symbol Position">
                <select className="input" value={form.currencyPosition} onChange={(e) => update('currencyPosition', e.target.value)}>
                  <option value="before">Before amount ({form.currencySymbol}100)</option>
                  <option value="after">After amount (100{form.currencySymbol})</option>
                </select>
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Tax &amp; Stay Policies</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Default Tax %"><input type="number" step="0.01" className="input" value={form.taxPercent} onChange={(e) => update('taxPercent', e.target.value)} /></Field>
                <Field label="Tax Label"><input className="input" value={form.taxLabel} onChange={(e) => update('taxLabel', e.target.value)} /></Field>
              </div>
              <Field label="Default Service Charge %"><input type="number" step="0.01" className="input" value={form.serviceChargePercent} onChange={(e) => update('serviceChargePercent', e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Standard Check-in Time"><input type="time" className="input" value={form.checkinTime} onChange={(e) => update('checkinTime', e.target.value)} /></Field>
                <Field label="Standard Check-out Time"><input type="time" className="input" value={form.checkoutTime} onChange={(e) => update('checkoutTime', e.target.value)} /></Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Create Administrator Account</h2>
              <p className="text-sm text-ink-700">This account has full access to every module and can create additional staff logins.</p>
              <Field label="Full Name *"><input className="input" value={form.admin.fullName} onChange={(e) => updateAdmin('fullName', e.target.value)} /></Field>
              <Field label="Email *"><input type="email" className="input" value={form.admin.email} onChange={(e) => updateAdmin('email', e.target.value)} /></Field>
              <Field label="Username *"><input className="input" value={form.admin.username} onChange={(e) => updateAdmin('username', e.target.value)} /></Field>
              <Field label="Password * (min 8 characters)">
                <PasswordInput value={form.admin.password} onChange={(e) => updateAdmin('password', e.target.value)} autoComplete="new-password" />
              </Field>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 text-sm">
              <h2 className="text-lg font-semibold mb-2">Review &amp; Install</h2>
              <SummaryRow label="Hotel">{form.hotelName}, {form.city}, {form.country}</SummaryRow>
              <SummaryRow label="Currency">{form.currencyCode} ({form.currencySymbol})</SummaryRow>
              <SummaryRow label="Tax">{form.taxPercent}% {form.taxLabel}</SummaryRow>
              <SummaryRow label="Service Charge">{form.serviceChargePercent}%</SummaryRow>
              <SummaryRow label="Check-in / Check-out">{form.checkinTime} / {form.checkoutTime}</SummaryRow>
              <SummaryRow label="Administrator">{form.admin.fullName} ({form.admin.username})</SummaryRow>
              <p className="text-xs text-ink-700 pt-2 border-t border-ink-900/10">
                Make sure the database schema has already been migrated (<code>npm run migrate</code> in /backend) before installing.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-ink-900/10">
            <button className="btn-ghost" onClick={back} disabled={step === 0}>Back</button>
            {step < STEPS.length - 1 ? (
              <button className="btn-accent" onClick={next}>Continue</button>
            ) : (
              <button className="btn-accent" onClick={finish} disabled={submitting}>
                {submitting ? 'Installing…' : 'Install HotelPro 5.0'}
              </button>
            )}
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function SummaryRow({ label, children }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-ink-700">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
