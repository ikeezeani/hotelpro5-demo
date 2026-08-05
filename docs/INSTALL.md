# HotelPro 5.0 — Installation Guide

This guide walks you through installing HotelPro 5.0 from scratch on a Linux, macOS,
or Windows server. It covers both the **guided installer** and a **manual** path if
you prefer full control.

---

## 1. Requirements

| Component | Minimum Version |
|---|---|
| Node.js    | 18.x or later |
| MySQL      | 8.0 or later (MariaDB 10.6+ also works) |
| npm        | 9.x or later |
| RAM        | 1 GB minimum, 2 GB+ recommended |
| OS         | Ubuntu 20.04+/Debian, macOS, or Windows 10+ |

You will also want a domain name and a reverse proxy (Nginx/Caddy) with HTTPS for
production deployments — see Section 7.

---

## 2. Get the Code

Unzip the HotelPro 5.0 package (or clone your repository) to your machine.

**Linux/macOS:**
```bash
unzip hotelpro5.zip -d /opt/hotelpro5
cd /opt/hotelpro5
```

**Windows:** right-click the zip file in File Explorer → **Extract All...** →
choose a destination (e.g. your Desktop) → **Extract**. Then in PowerShell:
```powershell
cd $env:USERPROFILE\Desktop\hotelpro5
```

You should see two folders: `backend/` and `frontend/`.

---

## 3. Install Dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

---

## 4. Create the Database

Log into MySQL and create an empty database and user (skip this if you'll let the
installer wizard create it for you — see Section 5, Option A):

```sql
CREATE DATABASE hotelpro5 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'hotelpro'@'localhost' IDENTIFIED BY 'a-strong-password';
GRANT ALL PRIVILEGES ON hotelpro5.* TO 'hotelpro'@'localhost';
FLUSH PRIVILEGES;
```

**Windows tip:** MySQL's Windows service sometimes defaults to Manual
startup, meaning it won't be running the next time you reboot — you'd then
see a "Can't connect to the database" screen for no obvious reason. Avoid
this now, in an **Administrator** PowerShell window (right-click PowerShell
→ "Run as administrator"):

```powershell
Set-Service -Name MYSQL80 -StartupType Automatic
```

(Use `Get-Service *mysql*` first if you're not sure of the exact service
name — it may be `MySQL80`, `MySQL`, or similar depending on your version.)

---

## 5. Run the Installation Wizard

You have two ways to install — pick whichever fits your workflow.

### Option A — CLI Wizard (recommended for first-time setup)

From the `backend/` folder:

```bash
npm run install-wizard
```

The wizard walks you through, in order:

1. **Database connection** — host, port, user, password, database name (it creates
   the database automatically if it doesn't exist yet).
2. **Schema installation** — creates all tables, indexes, and default roles.
3. **Hotel profile** — name, address, phone, email, timezone.
4. **Currency selection** — choose from 20 built-in currencies (USD, EUR, GBP, NGN,
   ZAR, KES, GHS, INR, AED, and more), plus whether the symbol shows before or
   after the amount.
5. **Tax & policies** — default tax %, tax label, service charge %, standard
   check-in/check-out times.
6. **Administrator account** — the first login, with full access to every module.
7. **Configuration file** — writes `backend/.env` with a freshly generated JWT
   secret, so you never have to edit it by hand for a first install.

At the end you'll see a summary and next-step instructions.

### Option B — Browser-based Setup Wizard

If you'd rather configure the database yourself and use a guided web UI for the
rest:

```bash
cd backend
cp .env.example .env        # edit DB_HOST / DB_USER / DB_PASSWORD / DB_NAME
npm run migrate             # applies database/schema.sql
npm start                   # starts the API on port 3000
```

Then, in another terminal:

```bash
cd frontend
npm run dev                 # starts the web app on port 5172
```

Open `http://localhost:5172` in your browser. Because no administrator account
exists yet, HotelPro 5.0 automatically shows the **Setup Wizard** instead of the
login screen. It walks through the same five steps as the CLI wizard (Hotel
Profile → Currency → Tax & Policies → Administrator → Review) and finishes by
calling the installer API — no manual database work beyond Step 4 above.

---

## 6. Start the Application

```bash
# Terminal 1 — API
cd backend
npm start          # production
# or: npm run dev  # auto-reloads on file changes (requires nodemon, already a devDependency)

# Terminal 2 — Web app
cd frontend
npm run dev         # development server on http://localhost:5172
# or, for production:
npm run build        # outputs static files to frontend/dist
```

Log in with the administrator account you created during installation.

### Optional: Load Demo Data

To explore the system with sample rooms, POS outlets, and inventory items:

```bash
cd backend
npm run seed:demo
```

---

## 6a. One-Command Deployment with Docker Compose

If you have Docker and Docker Compose installed, you can skip Sections 3–6
entirely — this spins up MySQL, the API, and the web app together, each in
its own container, with the schema applied automatically on first boot.

### Windows Prerequisite: WSL2 Must Be Enabled First

Docker Desktop on Windows requires WSL2 (Windows Subsystem for Linux) and
the Virtual Machine Platform feature. If you install Docker Desktop without
these already enabled, it will open with an error like **"Virtualization
support not detected."** Check and fix this *before* installing Docker
Desktop to save yourself a step:

1. Confirm CPU virtualization is on at the hardware level: open **Task
   Manager** (`Ctrl+Shift+Esc`) → **Performance** tab → **CPU** → look for
   **Virtualization: Enabled** in the bottom-right details. If it says
   **Disabled**, it needs to be turned on in your PC's BIOS/UEFI settings
   (varies by manufacturer — this is separate from the Windows-level fix
   below).
2. Open **PowerShell as Administrator** (right-click PowerShell → "Run as
   administrator" — required, or the next commands fail with "Elevated
   permissions are required").
3. Run:
   ```powershell
   wsl --install
   ```
   This enables WSL2 and the Virtual Machine Platform feature together in
   one step.
4. **Restart your computer** — these changes do not take effect until reboot.
5. After restarting, open Docker Desktop again — it should start cleanly.

If you already have Docker Desktop installed and hit the virtualization
error, the same fix applies — just do Steps 2–5 above, then relaunch Docker
Desktop.

### Steps

```bash
# From the project root (the folder with docker-compose.yml)
cp .env.example .env
nano .env    # set real passwords and a random JWT_SECRET — see the file for how

docker compose up -d --build
```

What happens:

1. **`db`** — starts MySQL 8 and creates the database/user from your `.env`
   values. A healthcheck makes sure it's actually ready to accept
   connections before anything else starts.
2. **`backend`** — waits for the database, then automatically applies
   `database/schema.sql` (safe to re-run — every table uses
   `CREATE TABLE IF NOT EXISTS`), then starts the API on the port you chose
   (`API_PORT` in `.env`, default `3000`).
3. **`frontend`** — builds the React app and serves it through Nginx on
   `APP_HTTP_PORT` (default `5172`). Nginx also reverse-proxies `/api/*`
   straight to the backend container, so the browser only ever talks to one
   origin.

Once the containers are healthy, open `http://localhost:5172` (or whatever
`APP_HTTP_PORT` you chose). Because no administrator account exists yet,
you'll land on the **Setup Wizard** automatically — walk through Hotel
Profile → **Currency** → Tax & Policies → Administrator → Review, exactly as
described in Section 5, Option B.

**Useful commands:**

```bash
docker compose logs -f backend      # tail API logs
docker compose ps                   # see container status/health
docker compose down                 # stop everything (data persists in named volumes)
docker compose down -v              # stop AND wipe the database volume — careful!
docker compose up -d --build        # rebuild after pulling code changes
```

**Generating a strong `JWT_SECRET`:**

Node.js is **not required** for the Docker path — everything runs inside
containers. Use whichever of these is available on the machine you're
setting up on:

```bash
# If Node.js happens to be installed on this machine:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Linux/Mac — no Node required:
openssl rand -hex 48

# Windows PowerShell — no Node required:
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | % {[char]$_})
```

Any of these produces a long random string — paste the output into
`JWT_SECRET=` in `.env`. If none of these tools are available either, typing
40+ random keyboard characters yourself works fine too; it just needs to be
long and unpredictable.

**Data persistence:** MySQL data lives in the named volume
`hotelpro5_db_data`, and API logs in `hotelpro5_backend_logs` — both survive
`docker compose down` (but not `docker compose down -v`).

### Windows Quick Start (PowerShell + Docker Desktop)

If you're on Windows, here's the same process with PowerShell-specific
commands:

1. **Install Docker Desktop** from https://www.docker.com/products/docker-desktop/
   if you don't have it, then launch it and wait until it says "Docker is
   running."
2. Confirm it's working:
   ```powershell
   docker --version
   docker compose version
   ```
3. Go to the project folder (adjust the path if you unzipped it somewhere
   other than your Desktop):
   ```powershell
   cd $env:USERPROFILE\Desktop\hotelpro5
   ```
4. Create your environment file:
   ```powershell
   copy .env.example .env
   notepad .env
   ```
   Set real values for `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, and
   `JWT_SECRET`, then save and close Notepad. To generate a random
   `JWT_SECRET`, run this first (works with no Node.js required) and paste
   the output in:
   ```powershell
   -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | % {[char]$_})
   ```
   (If you happen to have Node.js installed already, `node -e
   "console.log(require('crypto').randomBytes(48).toString('hex'))"` works
   too — but it's not required for the Docker path.)
5. Start everything:
   ```powershell
   docker compose up -d --build
   ```
   First run takes a few minutes — it's downloading MySQL and building both
   images.
6. Check status:
   ```powershell
   docker compose ps
   ```
   You want `db`, `backend`, and `frontend` all showing as running/healthy.
7. Open **http://localhost:5172** in your browser — you'll land on the Setup
   Wizard automatically.

---

## 7. Production Deployment Notes

*The notes below apply whether you're running the containers directly on a
server or deploying the manual (non-Docker) setup from Sections 3–6.*

- **Process manager:** *(skip this if you're using Docker Compose — the
  `restart: unless-stopped` policy already handles this)* run the API with
  [PM2](https://pm2.keymetrics.io/) or a systemd service so it restarts
  automatically:
  ```bash
  npm install -g pm2
  pm2 start server.js --name hotelpro5-api
  pm2 save
  ```
- **Frontend:** run `npm run build` in `frontend/` and serve the `dist/` folder
  as static files via Nginx, Caddy, or any static host. Point API calls at your
  backend URL (see `vite.config.js` if you need to change the `/api` proxy
  target for a split-domain deployment).
- **HTTPS:** terminate TLS at your reverse proxy (Nginx/Caddy/Cloudflare) in
  front of both the frontend and `PORT=3000` backend.
- **Environment variables:** never commit `backend/.env` — it contains your
  database password, JWT secret, and payment gateway keys. `.gitignore` already
  excludes it.
- **Backups:** schedule regular `mysqldump` backups of your database.
- **Firewall:** only expose ports 80/443 publicly; keep MySQL (3306) and the API
  port (3000, if not proxied) restricted to localhost or an internal network.

---

## 8. Adding Payment Gateways & Email Later

Payment gateway keys and SMTP credentials are both optional at install time —
the system runs fine without either. To enable them later, edit
`backend/.env` (or the root `.env` if you're using Docker Compose) and
restart:

```ini
# Payment gateways
PAYSTACK_SECRET_KEY=sk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxx

# Email (booking confirmations, payment receipts, daily low-stock digest)
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_FROM="Your Hotel <no-reply@yourhotel.com>"
LOW_STOCK_DIGEST_CRON=0 7 * * *   # optional — defaults to 7:00 AM daily
```

Any standard SMTP provider works (e.g. SendGrid, Mailgun, Amazon SES, Brevo,
Gmail with an app password, or your own mail server). Once set, restart the
API — manually with `npm start`/`pm2 restart hotelpro5-api`, or with
`docker compose restart backend` — and:

- New reservations email a booking confirmation to the guest automatically.
- Recording a payment (any method) emails a receipt to the guest.
- A daily digest of low-stock inventory items is emailed to Admin/Manager
  accounts — trigger it manually anytime from **Inventory → Stock Items →
  Send Low Stock Digest Now** to confirm your settings work.

**Choosing a provider — testing vs. production:**

| | Good for | Not good for |
|---|---|---|
| **Gmail (app password)** | Quick testing, verifying the wiring works, low-volume personal use | Production traffic — Gmail enforces daily sending limits (roughly 500/day on a free account) and can flag or throttle automated sending patterns; it's not designed to be a transactional email backend |
| **SendGrid / Brevo / Mailgun / Amazon SES** | Production — built for exactly this (booking confirmations, receipts, automated digests), with proper deliverability, sending analytics, and no realistic volume limit for a single hotel | — |

**Recommendation:** use Gmail only to confirm the feature works end-to-end
during setup or a demo. Before a real client goes live, switch
`SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD` to a proper transactional provider —
SendGrid and Brevo both have free tiers that comfortably cover a single
property's volume, and setup is the same few `.env` lines. Nothing else in
the app changes; the switch is purely those four environment variables.

See **`docs/USER_MANUAL.md`, Section 14** for full details on what each email
contains and when it's skipped (e.g. a guest with no email on file).

---

## 9. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Wizard fails to connect to MySQL | Check host/port/credentials; confirm MySQL is running (`sudo systemctl status mysql`) |
| "Default roles are missing" during web setup | Run `npm run migrate` before using the browser setup wizard |
| Frontend shows a blank page | Confirm the backend is running on port 3000 and `vite.config.js`'s proxy target matches |
| 401 errors after login | Check `JWT_SECRET` is set in `.env` and hasn't changed since the token was issued |
| Currency symbol not updating | Currency is stored server-side in `hotel_settings` — update it under **Settings** in the app, not just `.env` |
| `docker compose up` — backend keeps restarting | Check `docker compose logs backend`; usually means `db` hasn't finished initializing yet on a slow disk — the entrypoint retries automatically for ~60 seconds before giving up |
| `docker compose up` — "port is already allocated" | Another process is using `APP_HTTP_PORT` or `API_PORT` on the host — change the values in your root `.env` and re-run. **Common cause:** a manually-started backend (`npm start` in `/backend`) is still running from earlier testing — stop it first (`Ctrl+C` in that window, or `netstat -ano \| findstr :3000` → `taskkill /PID <pid> /F`), then retry `docker compose up -d` |
| Setup Wizard reappears after a Docker install that already worked before | This is expected if you're pointing at a **different** MySQL — the manual install and the Docker install use two separate databases by default (Docker's lives inside its own container volume). Running both on the same machine is fine for testing, but they are not the same data — don't be surprised each shows its own separate Setup Wizard / login on first use |
| Windows: `docker` / `docker compose` not recognized | Docker Desktop isn't installed or isn't running — install it from docker.com, launch it, and wait for "Docker is running" before trying again |
| Windows: `docker compose up` hangs or fails immediately | Open Docker Desktop and check its Settings → General has WSL 2 (or Hyper-V) enabled; restart Docker Desktop and retry |
| App shows "Can't connect to the database" screen | This is expected, working behavior — not an error to panic over. It means the backend is running but MySQL isn't reachable. Check the MySQL service is running (`Get-Service *mysql*` on Windows) and that `backend/.env` has the right `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`, then click **Try Again** |
| Windows: MySQL service is `Stopped` after every reboot | MySQL's startup type is likely set to Manual. Fix it permanently (Administrator PowerShell): `Set-Service -Name MYSQL80 -StartupType Automatic` — it will then start automatically every time Windows boots, no manual `Start-Service` needed again |
| Windows: `Start-Service` fails with "Cannot open ... service" | You're not running PowerShell as Administrator. Right-click PowerShell → "Run as administrator" and try again — this applies to any `Start-Service`, `Set-Service`, or `dism.exe` command |
| Windows: `dism.exe` fails with "Error: 740 — Elevated permissions are required" | Same cause as above — re-open PowerShell as Administrator |
| Windows: backend fails to start with `EADDRINUSE: address already in use :::3000` | Another process (often an old backend instance that didn't fully close) is holding the port. Find and stop it: `netstat -ano \| findstr :3000` (note the PID at the end of the line), then `taskkill /PID <that_number> /F`, then `npm start` again |
| Docker Desktop: "Virtualization support not detected" | See "Windows Prerequisite: WSL2 Must Be Enabled First" in Section 6a — check Task Manager for hardware-level virtualization, then run `wsl --install` in an Administrator PowerShell window and restart |
| App shows "Can't reach the HotelPro 5.0 server" screen | The frontend can't reach the backend at all — confirm the backend is actually running (`npm start` in `/backend`, or `docker compose ps` shows it healthy) |
| Setup Wizard reappears even though you already installed | As of this version, this should no longer happen silently — you'll see one of the two connection-error screens above instead if the cause is a database/server outage. If you still land on the wizard, check you're pointing at the right folder/`.env` — see the Client Deployment Checklist for the fastest way to diagnose this |

---

You're all set. Continue to `docs/USER_MANUAL.md` for a tour of every module.
