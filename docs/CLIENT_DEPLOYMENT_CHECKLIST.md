# HotelPro 5.0 — Client Deployment Checklist

Quick-reference only — no explanations. For full detail, see `docs/INSTALL.md`.
Use one of the two paths below, not both.

---

## Path A — Docker (recommended)

**Prerequisites:** Docker Desktop installed and running on the target
machine — that's it. Unlike Path B, this needs **no** separate MySQL
install, **no** Node.js, **no** `npm install` — all of that happens
automatically inside the containers.

```powershell
# 1. Get the code onto the server, then:
cd hotelpro5

# 2. Environment file
copy .env.example .env
notepad .env
```

In `.env`, set these three (everything else can stay default):
```ini
MYSQL_ROOT_PASSWORD=<new random password>
MYSQL_PASSWORD=<new random password>
JWT_SECRET=<paste output of the command below>
```

Generate the JWT secret (no Node.js required):
```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | % {[char]$_})
```

```powershell
# 3. Launch
docker compose up -d --build

# 4. Verify
docker compose ps
```

Open `http://localhost:5172` (or the client's domain) → complete the in-app
Setup Wizard (Hotel Profile → Currency → Tax & Policies → Administrator).

**Done.** Give the client their URL + admin login. Nothing else to configure.

---

## Path B — Manual (Node.js + MySQL installed separately)

**Prerequisites:** Node 18+, MySQL 8+ installed and running on the target machine.

```powershell
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ../backend

# 2. Run the CLI wizard — creates the DB, schema, hotel profile, currency,
#    tax settings, admin account, and writes backend/.env automatically
npm run install-wizard
```

It'll ask for: MySQL host/port/user/password/db name → hotel details →
currency → tax/policies → check-in/out times → admin account. It generates
the JWT secret itself — you don't type one in.

```powershell
# 3. Start both apps (two separate terminal windows)
npm start                              # backend, from /backend
cd ..\frontend && npm run dev          # frontend, from /frontend
```

Open `http://localhost:5172` → log in with the admin account from Step 2.

---

## Optional — Loading a Sales Demo

If this install is for showing a prospective client (not a real go-live),
load a realistic demo dataset instead of starting from an empty system:

```powershell
cd backend
npm run seed:demo
```

Populates in-house guests, invoices, POS sales, housekeeping tasks, and
low-stock inventory across every module in one shot. Full breakdown of
what it creates: `docs/USER_MANUAL.md`, "Demo Data for Sales Presentations".

Re-running before another demo (wipes and reseeds business data only):
```powershell
npm run seed:demo -- --reset
```

**Never leave demo data in a system you're actually handing off as
production** — clear it (`--reset` with no further seeding, or a fresh
install) before the client's real go-live.

---

## Before handing off to the client

- [ ] Change any default/demo data — don't ship with `npm run seed:demo` data live
- [ ] Confirm currency and tax % match the client's actual location
- [ ] Add real room types and rooms under **Settings**
- [ ] Create staff accounts with appropriate roles (not everyone as Admin)
- [ ] If using payment gateways, add the keys to `.env` and restart
      (see `docs/INSTALL.md`, Section 8)
- [ ] If using email, confirm SMTP is a **production provider** (SendGrid,
      Brevo, Mailgun, Amazon SES) — not a Gmail app password left over from
      testing; Gmail has daily sending limits and isn't meant for live traffic
      (see `docs/INSTALL.md`, Section 8)
- [ ] For a public-facing deployment: put a reverse proxy with HTTPS in front
      (see `docs/INSTALL.md`, Section 7) — don't expose it over plain HTTP
- [ ] Give the client: URL, admin username, admin password (via a secure
      channel, not email/chat in plaintext)
- [ ] Keep your own copy of the `.env` (or root `.env` for Docker) somewhere
      safe — it's the only place the DB password and JWT secret live

---

## If something won't start (quick triage)

| Symptom | Fix |
|---|---|
| `EADDRINUSE` on port 3000 or 5172 | `netstat -ano \| findstr :<port>` → `taskkill /PID <pid> /F` |
| Setup Wizard reappears after already installing | You're pointing at a folder with no `.env`, or the DB doesn't have `installed_at` set — check `Test-Path .env` and re-point it at the right database |
| Can't connect to MySQL | Confirm the service is running: `Get-Service *mysql*` → `Start-Service <name>` (must be **Administrator** PowerShell, or this fails silently with an "OpenError") |
| MySQL keeps being `Stopped` after every reboot | Set it to auto-start once: `Set-Service -Name MYSQL80 -StartupType Automatic` (Administrator PowerShell) — fixes it permanently |
| `Start-Service` / `dism.exe` errors about elevation/permissions | Not running PowerShell as Administrator — right-click it → "Run as administrator" |
| Docker Desktop: "Virtualization support not detected" | Administrator PowerShell → `wsl --install` → restart the machine → relaunch Docker Desktop (full detail: `docs/INSTALL.md`, Section 6a) |
| Docker containers won't start | `docker compose logs -f backend` — usually the `db` container is still initializing, wait ~30s and retry |
