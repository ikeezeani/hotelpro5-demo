# HotelPro 5.0

A production-oriented hotel management system covering Front Desk,
Reservations, Housekeeping, Point of Sale, Inventory, Billing, Guest CRM, and
Reports — built with **React + Vite** on the frontend and **Node.js /
Express + MySQL** on the backend.

```
hotelpro5/
├── backend/                 Express API + MySQL schema
│   ├── config/               DB connection pool
│   ├── database/             schema.sql, migrate.js, seedDemo.js, waitForDb.js
│   ├── installer/            CLI installation wizard (npm run install-wizard)
│   ├── middleware/           auth (JWT + RBAC), error handling
│   ├── routes/                one file per module (front desk, reservations, …)
│   ├── utils/                 helpers, logger, currency list
│   ├── Dockerfile / docker-entrypoint.sh
│   ├── .env.example
│   └── server.js
├── frontend/                 React + Vite + Tailwind SPA
│   ├── src/
│   │   ├── api/               axios client
│   │   ├── context/           auth + settings (currency) providers
│   │   ├── layouts/           authenticated app shell
│   │   └── pages/             one page per module + Setup Wizard + Login
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml         one-command deployment (db + backend + frontend)
├── .env.example                Docker Compose environment template
└── docs/
    ├── INSTALL.md             step-by-step installation guide (manual + Docker)
    └── USER_MANUAL.md          features, workflows, payment options
```

## Quick Start — Docker (fastest)

```bash
cp .env.example .env
nano .env                        # set real passwords + a random JWT_SECRET
docker compose up -d --build
```

Open `http://localhost:5172` — you'll land on the in-app Setup Wizard
automatically (Hotel Profile → Currency → Tax & Policies → Administrator).

## Quick Start — Manual

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Run the guided installer (creates the DB, schema, hotel profile,
#    currency, tax settings, and your admin account)
cd ../backend
npm run install-wizard

# 3. Start both apps
npm start                 # backend, port 3000
cd ../frontend && npm run dev   # frontend, port 5172
```

Full details, including the alternative browser-based setup wizard and
production deployment notes, are in **[docs/INSTALL.md](docs/INSTALL.md)**.

For a tour of every module and how payments flow through the system, see
**[docs/USER_MANUAL.md](docs/USER_MANUAL.md)**.

## Tech Stack

- **Frontend:** React 18, Vite 5, Tailwind CSS, React Router, Recharts, Axios
- **Backend:** Node.js, Express, MySQL (mysql2), JWT auth, bcrypt, Helmet,
  rate limiting, Winston logging
- **Deployment:** Docker Compose (MySQL + API + Nginx-served frontend), or
  manual install with PM2 — see `docs/INSTALL.md`
- **Payments:** Cash / card / bank transfer / mobile money recorded directly;
  Paystack, Stripe, and Flutterwave supported via server-side verification
  endpoints

## Key Design Notes

- **Currency is configurable, not hardcoded.** It's chosen during
  installation (CLI or browser wizard) and stored in `hotel_settings`; every
  screen that displays money reads it live, so changing it in Settings takes
  effect everywhere immediately.
- **RBAC is enforced server-side.** Each of the six default roles (Admin,
  Manager, Front Desk, Housekeeping, POS, Accountant) has explicit
  module-level permissions checked on every API request — not just hidden
  buttons in the UI.
- **Financial data is transactional.** Check-in/out, POS checkout, and
  payment recording all run inside MySQL transactions to avoid partial
  writes (e.g. a room marked occupied without its folio being created).
- **This is a strong, working foundation — not a finished, battle-tested
  enterprise product.** It's real, functional code you can run today, but a
  live production rollout should still go through your own security review,
  load testing, and staff training before go-live.

## License

Provided as-is for your use. Add your own license file if you plan to
distribute or open-source this codebase.
