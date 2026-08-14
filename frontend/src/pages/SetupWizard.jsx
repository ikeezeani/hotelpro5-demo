import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import PasswordInput from '../components/PasswordInput.jsx';
import AuthBackground from '../components/AuthBackground.jsx';

const STEPS = [
  'Hotel Profile',
  'Currency',
  'Tax & Policies',
  'Administrator',
  'Review'
];

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [currencies, setCurrencies] = useState([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    hotelName: '',
    legalName: '',
    address: '',
    city: '',
    state: '',
    country: '',
    phone: '',
    email: '',

    timezone: 'Africa/Lagos',

    currencyCode: 'NGN',
    currencySymbol: '₦',
    currencyPosition: 'before',

    taxPercent: 0,
    taxLabel: 'Tax',
    serviceChargePercent: 0,

    checkinTime: '14:00',
    checkoutTime: '12:00',

    admin: {
      fullName: '',
      email: '',
      username: '',
      password: ''
    }
  });

  /*
   * =========================================================
   * LOAD CURRENCIES
   * =========================================================
   *
   * The API may return:
   *
   * 1. An array
   * 2. { currencies: [...] }
   * 3. { data: [...] }
   *
   * We normalize all three formats into one array.
   */

  useEffect(() => {
    let mounted = true;

    const loadCurrencies = async () => {
      setLoadingCurrencies(true);

      try {
        const response = await api.get('/settings/currencies');
        const data = response?.data;

        let currencyList = [];

        if (Array.isArray(data)) {
          currencyList = data;
        } else if (Array.isArray(data?.currencies)) {
          currencyList = data.currencies;
        } else if (Array.isArray(data?.data)) {
          currencyList = data.data;
        }

        if (mounted) {
          setCurrencies(currencyList);
        }

        console.log('HotelPro currency API response:', data);
        console.log('HotelPro normalized currencies:', currencyList);
      } catch (error) {
        console.error(
          'HotelPro failed to load currencies:',
          error
        );

        if (mounted) {
          setCurrencies([]);
        }
      } finally {
        if (mounted) {
          setLoadingCurrencies(false);
        }
      }
    };

    loadCurrencies();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * =========================================================
   * FORM HELPERS
   * =========================================================
   */

  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const updateAdmin = (field, value) => {
    setForm((current) => ({
      ...current,
      admin: {
        ...current.admin,
        [field]: value
      }
    }));
  };

  /*
   * =========================================================
   * CURRENCY SELECTION
   * =========================================================
   */

  const selectCurrency = (code) => {
    if (!Array.isArray(currencies)) {
      return;
    }

    const selectedCurrency = currencies.find(
      (currency) => currency?.code === code
    );

    if (!selectedCurrency) {
      return;
    }

    setForm((current) => ({
      ...current,
      currencyCode: selectedCurrency.code,
      currencySymbol: selectedCurrency.symbol || ''
    }));
  };

  /*
   * =========================================================
   * VALIDATION
   * =========================================================
   */

  const validateStep = () => {
    if (step === 0) {
      return Boolean(
        form.hotelName.trim() &&
        form.address.trim() &&
        form.city.trim() &&
        form.country.trim() &&
        form.phone.trim() &&
        form.email.trim()
      );
    }

    if (step === 1) {
      return Boolean(
        form.currencyCode &&
        form.currencySymbol
      );
    }

    if (step === 3) {
      return Boolean(
        form.admin.fullName.trim() &&
        form.admin.email.trim() &&
        form.admin.username.trim() &&
        form.admin.password.length >= 8
      );
    }

    return true;
  };

  /*
   * =========================================================
   * NEXT / BACK
   * =========================================================
   */

  const next = () => {
    if (!validateStep()) {
      toast.error(
        'Please complete all required fields before continuing.'
      );
      return;
    }

    setStep((current) =>
      Math.min(current + 1, STEPS.length - 1)
    );
  };

  const back = () => {
    setStep((current) =>
      Math.max(current - 1, 0)
    );
  };

  /*
   * =========================================================
   * INSTALL
   * =========================================================
   */

  const finish = async () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);

    try {
      await api.post('/setup/install', {
        ...form,

        checkinTime: `${form.checkinTime}:00`,
        checkoutTime: `${form.checkoutTime}:00`
      });

      toast.success(
        'HotelPro 5.0 installed successfully!'
      );

      if (typeof onComplete === 'function') {
        onComplete();
      }
    } catch (error) {
      console.error(
        'HotelPro installation failed:',
        error
      );

      const message =
        error?.response?.data?.error ||
        'Installation failed. Confirm the database schema has been migrated.';

      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <AuthBackground>
      <div className="w-full max-w-2xl">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="text-center mb-6">

          <p className="font-display text-3xl text-linen-50 tracking-tight">
            HotelPro{' '}
            <span className="text-brass-400">
              5.0
            </span>
          </p>

          <p className="text-linen-100/60 text-sm mt-1">
            Installation Wizard
          </p>

        </div>


        {/* =================================================
            STEP INDICATOR
        ================================================= */}

        <ol className="flex items-center justify-between mb-6 text-xs text-linen-100/60">

          {STEPS.map((label, index) => (
            <li
              key={label}
              className={`flex-1 text-center pb-2 border-b-2 ${
                index <= step
                  ? 'border-brass-400 text-brass-400'
                  : 'border-white/10'
              }`}
            >
              {index + 1}. {label}
            </li>
          ))}

        </ol>


        {/* =================================================
            MAIN CARD
        ================================================= */}

        <div className="card">

          {/* =================================================
              STEP 1 — HOTEL PROFILE
          ================================================= */}

          {step === 0 && (
            <div className="space-y-4">

              <h2 className="text-lg font-semibold">
                Hotel Profile
              </h2>

              <Field label="Hotel Name *">
                <input
                  className="input"
                  value={form.hotelName}
                  onChange={(event) =>
                    update(
                      'hotelName',
                      event.target.value
                    )
                  }
                />
              </Field>


              <Field label="Legal / Registered Name">
                <input
                  className="input"
                  value={form.legalName}
                  onChange={(event) =>
                    update(
                      'legalName',
                      event.target.value
                    )
                  }
                />
              </Field>


              <Field label="Street Address *">
                <input
                  className="input"
                  value={form.address}
                  onChange={(event) =>
                    update(
                      'address',
                      event.target.value
                    )
                  }
                />
              </Field>


              <div className="grid grid-cols-2 gap-4">

                <Field label="City *">
                  <input
                    className="input"
                    value={form.city}
                    onChange={(event) =>
                      update(
                        'city',
                        event.target.value
                      )
                    }
                  />
                </Field>


                <Field label="State / Province">
                  <input
                    className="input"
                    value={form.state}
                    onChange={(event) =>
                      update(
                        'state',
                        event.target.value
                      )
                    }
                  />
                </Field>

              </div>


              <div className="grid grid-cols-2 gap-4">

                <Field label="Country *">
                  <input
                    className="input"
                    value={form.country}
                    onChange={(event) =>
                      update(
                        'country',
                        event.target.value
                      )
                    }
                  />
                </Field>


                <Field label="Timezone">
                  <input
                    className="input"
                    value={form.timezone}
                    onChange={(event) =>
                      update(
                        'timezone',
                        event.target.value
                      )
                    }
                  />
                </Field>

              </div>


              <div className="grid grid-cols-2 gap-4">

                <Field label="Phone *">
                  <input
                    className="input"
                    value={form.phone}
                    onChange={(event) =>
                      update(
                        'phone',
                        event.target.value
                      )
                    }
                  />
                </Field>


                <Field label="Email *">
                  <input
                    type="email"
                    className="input"
                    value={form.email}
                    onChange={(event) =>
                      update(
                        'email',
                        event.target.value
                      )
                    }
                  />
                </Field>

              </div>

            </div>
          )}


          {/* =================================================
              STEP 2 — CURRENCY
          ================================================= */}

          {step === 1 && (
            <div className="space-y-4">

              <h2 className="text-lg font-semibold">
                Choose Your Currency
              </h2>

              <p className="text-sm text-ink-700">
                This sets the currency used across billing,
                POS, invoices and reports. You can change it
                later in Settings.
              </p>


              {loadingCurrencies ? (
                <div className="rounded-md border border-ink-900/10 p-4 text-sm text-ink-700">
                  Loading currencies...
                </div>
              ) : currencies.length === 0 ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                  Currency list could not be loaded.
                  <br />
                  You can continue with the default currency:
                  <strong className="ml-1">
                    {form.currencyCode} ({form.currencySymbol})
                  </strong>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1">

                  {currencies.map((currency) => (
                    <button
                      type="button"
                      key={currency.code}
                      onClick={() =>
                        selectCurrency(currency.code)
                      }
                      className={`text-left rounded-md border px-3 py-2 text-sm transition-colors ${
                        form.currencyCode === currency.code
                          ? 'border-brass-500 bg-brass-500/10'
                          : 'border-ink-900/10 hover:border-ink-900/30'
                      }`}
                    >

                      <span className="font-medium">
                        {currency.code}
                      </span>

                      <span className="text-ink-700">
                        {' '}
                        {currency.symbol}
                      </span>

                      <p className="text-xs text-ink-700 truncate">
                        {currency.name}
                      </p>

                    </button>
                  ))}

                </div>
              )}


              <Field label="Symbol Position">

                <select
                  className="input"
                  value={form.currencyPosition}
                  onChange={(event) =>
                    update(
                      'currencyPosition',
                      event.target.value
                    )
                  }
                >

                  <option value="before">
                    Before amount ({form.currencySymbol}100)
                  </option>

                  <option value="after">
                    After amount (100{form.currencySymbol})
                  </option>

                </select>

              </Field>

            </div>
          )}


          {/* =================================================
              STEP 3 — TAX & POLICIES
          ================================================= */}

          {step === 2 && (
            <div className="space-y-4">

              <h2 className="text-lg font-semibold">
                Tax &amp; Stay Policies
              </h2>


              <div className="grid grid-cols-2 gap-4">

                <Field label="Default Tax %">

                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={form.taxPercent}
                    onChange={(event) =>
                      update(
                        'taxPercent',
                        event.target.value
                      )
                    }
                  />

                </Field>


                <Field label="Tax Label">

                  <input
                    className="input"
                    value={form.taxLabel}
                    onChange={(event) =>
                      update(
                        'taxLabel',
                        event.target.value
                      )
                    }
                  />

                </Field>

              </div>


              <Field label="Default Service Charge %">

                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={form.serviceChargePercent}
                  onChange={(event) =>
                    update(
                      'serviceChargePercent',
                      event.target.value
                    )
                  }
                />

              </Field>


              <div className="grid grid-cols-2 gap-4">

                <Field label="Standard Check-in Time">

                  <input
                    type="time"
                    className="input"
                    value={form.checkinTime}
                    onChange={(event) =>
                      update(
                        'checkinTime',
                        event.target.value
                      )
                    }
                  />

                </Field>


                <Field label="Standard Check-out Time">

                  <input
                    type="time"
                    className="input"
                    value={form.checkoutTime}
                    onChange={(event) =>
                      update(
                        'checkoutTime',
                        event.target.value
                      )
                    }
                  />

                </Field>

              </div>

            </div>
          )}


          {/* =================================================
              STEP 4 — ADMINISTRATOR
          ================================================= */}

          {step === 3 && (
            <div className="space-y-4">

              <h2 className="text-lg font-semibold">
                Create Administrator Account
              </h2>

              <p className="text-sm text-ink-700">
                This account has full access to every module
                and can create additional staff logins.
              </p>


              <Field label="Full Name *">

                <input
                  className="input"
                  value={form.admin.fullName}
                  onChange={(event) =>
                    updateAdmin(
                      'fullName',
                      event.target.value
                    )
                  }
                />

              </Field>


              <Field label="Email *">

                <input
                  type="email"
                  className="input"
                  value={form.admin.email}
                  onChange={(event) =>
                    updateAdmin(
                      'email',
                      event.target.value
                    )
                  }
                />

              </Field>


              <Field label="Username *">

                <input
                  className="input"
                  value={form.admin.username}
                  onChange={(event) =>
                    updateAdmin(
                      'username',
                      event.target.value
                    )
                  }
                />

              </Field>


              <Field label="Password * (min 8 characters)">

                <PasswordInput
                  value={form.admin.password}
                  onChange={(event) =>
                    updateAdmin(
                      'password',
                      event.target.value
                    )
                  }
                  autoComplete="new-password"
                />

              </Field>

            </div>
          )}


          {/* =================================================
              STEP 5 — REVIEW
          ================================================= */}

          {step === 4 && (
            <div className="space-y-3 text-sm">

              <h2 className="text-lg font-semibold mb-2">
                Review &amp; Install
              </h2>


              <SummaryRow label="Hotel">
                {form.hotelName},{' '}
                {form.city},{' '}
                {form.country}
              </SummaryRow>


              <SummaryRow label="Currency">
                {form.currencyCode}{' '}
                ({form.currencySymbol})
              </SummaryRow>


              <SummaryRow label="Tax">
                {form.taxPercent}% {form.taxLabel}
              </SummaryRow>


              <SummaryRow label="Service Charge">
                {form.serviceChargePercent}%
              </SummaryRow>


              <SummaryRow label="Check-in / Check-out">
                {form.checkinTime} /{' '}
                {form.checkoutTime}
              </SummaryRow>


              <SummaryRow label="Administrator">
                {form.admin.fullName}{' '}
                ({form.admin.username})
              </SummaryRow>


              <p className="text-xs text-ink-700 pt-2 border-t border-ink-900/10">

                Make sure the database schema has already
                been migrated (
                <code>npm run migrate</code>
                {' '}in /backend) before installing.

              </p>

            </div>
          )}


          {/* =================================================
              NAVIGATION
          ================================================= */}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-ink-900/10">

            <button
              type="button"
              className="btn-ghost"
              onClick={back}
              disabled={step === 0}
            >
              Back
            </button>


            {step < STEPS.length - 1 ? (

              <button
                type="button"
                className="btn-accent"
                onClick={next}
              >
                Continue
              </button>

            ) : (

              <button
                type="button"
                className="btn-accent"
                onClick={finish}
                disabled={submitting}
              >
                {submitting
                  ? 'Installing…'
                  : 'Install HotelPro 5.0'}
              </button>

            )}

          </div>

        </div>

      </div>
    </AuthBackground>
  );
}


/*
 * =========================================================
 * REUSABLE FORM FIELD
 * =========================================================
 */

function Field({ label, children }) {
  return (
    <div>
      <label className="label">
        {label}
      </label>

      {children}
    </div>
  );
}


/*
 * =========================================================
 * REVIEW SUMMARY ROW
 * =========================================================
 */

function SummaryRow({ label, children }) {
  return (
    <div className="flex justify-between py-1">

      <span className="text-ink-700">
        {label}
      </span>

      <span className="font-medium text-right">
        {children}
      </span>

    </div>
  );
}