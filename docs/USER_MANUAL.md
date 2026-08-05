# HotelPro 5.0 — User Manual

A complete guide to every module: what it does, how to use it day to day, and
how payments flow through the system.

---

## Contents

1. [Signing In](#1-signing-in)
2. [Dashboard](#2-dashboard)
3. [Front Desk](#3-front-desk)
4. [Reservations](#4-reservations)
5. [Housekeeping](#5-housekeeping)
6. [Point of Sale](#6-point-of-sale)
7. [Inventory](#7-inventory)
8. [Billing](#8-billing)
9. [Guest CRM](#9-guest-crm)
10. [Reports](#10-reports)
11. [Settings & Staff Roles](#11-settings--staff-roles)
12. [Payment Options](#12-payment-options)
13. [User Roles & Permissions](#13-user-roles--permissions)
14. [Automated Email Notifications](#14-automated-email-notifications)

---

## 1. Signing In

Go to your HotelPro 5.0 web address and sign in with the username/email and
password created during installation (or issued by your administrator). Your
session stays active for 8 hours by default; you'll be returned to the login
screen automatically if it expires.

---

## 2. Dashboard

The landing screen after login. At a glance you'll see:

- **Occupancy** — rooms occupied vs. total, as a live percentage
- **Arrivals / Departures today**
- **Revenue today** — total collected across folios and POS
- **Housekeeping** — count of pending/in-progress cleaning tasks
- **Low Stock Items** — inventory at or below its reorder level
- **Outstanding Invoices** — unpaid/partially paid balance across the property

This is a read-only summary — use the sidebar to act on anything you see here.

---

## 3. Front Desk

Three views, switchable by tab:

- **Board** — every room, color-coded by status (available, occupied,
  reserved, maintenance, out of order), with its housekeeping state shown
  underneath when it isn't clean.
- **Arrivals** — reservations confirmed for today. Click **Check in** to
  assign the next available room and open a folio automatically.
- **In-House** — currently occupied rooms. Click **Check out** to close the
  stay; the system blocks checkout if there's an unpaid folio balance and
  automatically queues a checkout-clean housekeeping task once it succeeds.

**What happens behind the scenes at check-in:** a `stay` record is created,
the room is marked occupied, and a folio is opened with the full-stay room
charge pre-loaded (nights × rate).

**What happens at check-out:** the stay is closed, the room flips to
available + dirty, the folio closes, and a housekeeping task is created.

---

## 4. Reservations

Central booking log across every channel (walk-in, phone, website, OTA,
corporate).

- **New Reservation** — capture guest details (existing or new), room type,
  dates, occupancy, source, and any special requests. The system defaults to
  the room type's base rate, but you can override it per booking.
- **Status flow**: `booked` → `confirmed` → `checked_in` → `checked_out`, or
  `cancelled` / `no_show` at any point before check-in. Use the action
  buttons in the list to confirm or cancel.
- Reservations don't reserve a specific physical room until check-in — only a
  room *type* — so the property can be managed flexibly right up to arrival.

---

## 5. Housekeeping

A four-column task board: **Pending → In Progress → Completed → Verified**.

- Tasks are created automatically on checkout (a `checkout_clean` task), or
  manually for stay-over cleans, deep cleans, or maintenance requests.
- Click the action button on a task card to advance it to the next stage.
  Marking a task **Verified** automatically flips the room's housekeeping
  status back to *clean*, making it available for front desk check-in.
- The **Room Housekeeping Status** grid below the board gives a quick visual
  read of every room's cleanliness state, independent of task history.

---

## 6. Point of Sale

For restaurants, bars, spas, gift shops, or any other revenue outlet.

1. Pick an **outlet** tab at the top.
2. Tap products to add them to the order — quantities stack automatically if
   you tap the same item twice.
3. Choose how the guest pays:
   - **Walk-in / pay now** — leave the room dropdown on its default; use
     **Take Payment** to close the order for cash/card settlement.
   - **Charge to Room** — select the guest's room from the dropdown (only
     in-house guests appear here) and use **Charge to Room** to post the
     total straight onto their open folio, ready to be paid at checkout.
4. Tax and service charge are applied automatically using your hotel's
   configured percentages (see Settings).

Selling a stock item (one flagged "sellable" in Inventory) automatically
decrements its quantity on hand and logs an inventory transaction — no manual
double entry required.

**Made a mistake on an order?** Every order in the **Recent Orders** list has
a **Void** action. Voiding an order automatically restores any stock it had
deducted (with its own logged transaction, so the reversal is traceable) —
you never need to manually re-add stock after voiding a mis-rung sale.

---

## 7. Inventory

Tracks stock for housekeeping supplies, F&B, bar, maintenance, and anything
else you stock — organized into three tabs.

### Stock Items

- **New Item** — name, unit of measure, starting quantity, reorder level, and
  unit cost. Tick **Sellable in POS** to also give it a selling price and
  make it appear as a POS product.
- Items highlighted in amber are at or below their reorder level.
- **Adjust** — record a manual stock correction or usage (enter a negative
  number to remove stock, e.g. for breakage or internal use).

### Purchase Orders

- **New Purchase Order** — optionally pick a supplier, then add as many line
  items as needed (item, quantity, unit cost). Selecting an item pre-fills
  its current unit cost, which you can override for this order. The running
  total updates as you type.
- New orders start in **ordered** status. Once the delivery arrives, click
  **Receive** on that order — this adds every line item's quantity to stock,
  updates each item's unit cost to what you paid, and logs the corresponding
  inventory transactions automatically. This action can't be undone, so
  double-check quantities before confirming.
- Order status badges: `draft` → `ordered` → `received` (or `cancelled`).

### Suppliers

- A simple vendor directory — name, contact person, phone, email, and
  address — so you can pick a supplier when creating a purchase order without
  retyping their details each time.

---

## 8. Billing

The financial heart of the system: folios → invoices → payments.

- **Folios** open automatically at check-in and accumulate charges (room,
  POS, tax, service charge, misc, discounts, adjustments) throughout the
  stay.
- **Generate Invoice from Open Folio** — turns a folio's running total into a
  formal invoice with its own number, ready for payment.
- **Record Payment** — pick a method (cash, card, bank transfer, mobile
  money, or a connected gateway) and amount. Partial payments are supported;
  the invoice status updates to `partial` or `paid` automatically, and the
  balance due recalculates in real time.
- Invoices can also be generated directly from a POS order for guests who
  aren't staying overnight.

---

## 9. Guest CRM

A searchable directory of every guest who has ever booked or been added
manually.

- **Search** by name, email, or phone from the left panel.
- Selecting a guest shows their **lifetime spend**, **loyalty points**,
  **full stay history**, and any **notes** staff have left (visible to all
  staff with CRM access — useful for allergies, preferences, or service
  recovery context).
- **VIP tier** (None / Silver / Gold / Platinum) is set from the guest's
  profile and is a good signal for staff to personalize service.
- Add a **New Guest** directly if you want to build a CRM profile before a
  reservation exists (e.g. for a corporate contact or a walk-in inquiry).

---

## 10. Reports

Thirty-day rolling view by default (extendable via the API's `from`/`to`
query parameters):

- **Room Revenue, POS Revenue, ADR (Average Daily Rate), RevPAR** (Revenue
  per Available Room) as headline KPIs.
- **Occupancy Rate** trend chart.
- **POS Revenue by Outlet** bar chart, plus a **Top Selling Items** table.
- **Low Stock Alerts** pulled straight from Inventory, plus total inventory
  valuation.
- Guest-level reporting (new vs. returning, top spenders) and a
  housekeeping-completion breakdown are available via the Reports API for
  custom dashboards or scheduled exports.

---

## 11. Settings & Staff Roles

Administrators can configure, in one screen:

- **Hotel profile** — name, currency, tax %, and service charge %. Currency
  changes take effect immediately across POS, Billing, and Reports — every
  screen that displays money reads this setting live.
- **Room types** — add, edit, or delete. A room type can't be deleted while
  rooms are still assigned to it; reassign or delete those rooms first.
- **Rooms** — add, edit, or delete. A currently-occupied room can't be
  deleted. Each room belongs to exactly one room type and drives
  availability, rates, and the Front Desk board.
- **Staff accounts** — a full management list, not just a creation form:
  - **Create** a new login with name, email, username, password, and role.
  - **Change role** inline from the staff list at any time.
  - **Disable / Reactivate** an account — disabling blocks sign-in without
    deleting history tied to that user (reservations they created, payments
    they received, etc. stay intact).
  - **Delete** permanently removes the account. Built-in safeguards: you
    can't disable, delete, or change your own role from this screen, and the
    system won't let you delete the last remaining Administrator account.

---

## Demo Data for Sales Presentations

For showing HotelPro 5.0 to a prospective client, a one-command demo dataset
is available that populates every module with realistic, current-looking
data — not just empty rooms.

From `backend/`:

```bash
npm run seed:demo
```

This creates, all at once:

- 3 room types and 13 rooms across 3 floors
- 11 guest profiles (including 2 VIP guests — Gold and Platinum tier — with
  CRM notes already attached)
- 3 guests currently **in-house** with open folios, including room-service
  charges already posted from the Restaurant and Spa
- 2 **confirmed arrivals** for today/tomorrow, ready to check in from Front
  Desk → Arrivals
- 4 **completed past stays** with generated invoices — 3 fully paid across
  different payment methods (card, Paystack, mobile money), 1 partially
  paid, so Billing and Reports show real variety
- 1 cancelled and 1 no-show reservation, for status realism
- 1 walk-in POS sale
- 5 housekeeping tasks spread across every status (pending → verified)
- 10 inventory items, 4 of them intentionally below their reorder level (so
  the Low Stock report and email digest have something to show), plus one
  pending purchase order ready to be received

All dates are calculated relative to the day you run the script, so the
dashboard, arrivals, and reports always look current — no matter when the
demo actually takes place.

**Re-running before another demo:** the script won't seed on top of existing
data by default (it checks room types first and stops if any exist). To
wipe and start fresh:

```bash
npm run seed:demo -- --reset
```

This clears all previously-seeded business data (rooms, guests,
reservations, invoices, inventory, etc.) and reseeds from scratch. It never
touches your hotel profile, currency setting, roles, or user accounts — so
your admin login keeps working.

**Before handing the system to a real client**, clear this demo data the
same way (`--reset`) and let them start with their real room types, rooms,
and staff — don't ship demo data into a live production install.

---

## 12. Payment Options

HotelPro 5.0 supports the following payment methods out of the box:

| Method | How it's recorded |
|---|---|
| **Cash** | Recorded directly in Billing → Record Payment |
| **Card** | Recorded directly in Billing → Record Payment (use your existing card terminal for the actual charge; HotelPro logs the settlement) |
| **Bank Transfer** | Recorded directly, with an optional reference number |
| **Mobile Money** | Recorded directly, with an optional reference number |
| **Paystack** | Automated: front-end collects payment via Paystack's checkout, then the app calls `/api/payments/paystack/verify` with the transaction reference to confirm and record it |
| **Stripe** | Automated: confirm a Payment Intent, then the app calls `/api/payments/stripe/confirm` to verify and record it |
| **Flutterwave** | Automated: front-end collects payment via Flutterwave, then the app calls `/api/payments/flutterwave/verify` to confirm and record it |
| **Credit** (in-house account / pay later) | Recorded as a payment method for corporate or house accounts that settle on invoice terms |

**Enabling a gateway:** add its secret key to `backend/.env` (see
`docs/INSTALL.md`, Section 8) and restart the API. Until a key is set, that
gateway's verify endpoint returns a clear "not configured" error instead of
failing silently — so you always know exactly which gateways are live.

All payments — however collected — land in the same `payments` table and
roll up into the same invoice balance, so your Billing and Reports views stay
consistent regardless of payment method.

---

## 13. User Roles & Permissions

Six roles ship by default; an administrator can create more via the database
if your property needs finer-grained access:

| Role | Typical access |
|---|---|
| **Admin** | Full access to every module, including staff management and settings |
| **Manager** | Read/write on Front Desk, Reservations, Housekeeping, POS, Inventory, Billing, CRM; read-only on Reports |
| **Front Desk** | Front Desk, Reservations, Guest CRM, Billing |
| **Housekeeping** | Housekeeping only |
| **POS** | Point of Sale (read/write), Inventory (read-only) |
| **Accountant** | Billing (read/write), Reports (read-only) |

Permissions are enforced on the server for every request, not just hidden in
the UI — so even a direct API call is checked against the signed-in user's
role.

---

## 14. Automated Email Notifications

HotelPro 5.0 sends three kinds of emails automatically once SMTP is
configured (see `docs/INSTALL.md`, Section 8, or set `SMTP_HOST`,
`SMTP_USER`, and `SMTP_PASSWORD` directly in `.env`). **The app works
perfectly well with SMTP left unconfigured** — emails are simply skipped and
logged, nothing else is affected.

| Email | Trigger | Recipient |
|---|---|---|
| **Booking Confirmation** | A reservation is created (Reservations → New Reservation) | The guest, if they have an email on file |
| **Payment Receipt** | A payment is recorded — cash, card, bank transfer, mobile money, or a verified gateway payment (Paystack/Stripe/Flutterwave) | The guest linked to that invoice, if they have an email on file |
| **Low Stock Digest** | Once daily (7:00 AM server time by default — change with `LOW_STOCK_DIGEST_CRON` in `.env`, using standard cron syntax) | Every active Admin and Manager account with an email on file |

Notes:

- Guests without an email address on file simply don't receive these emails
  — nothing fails or blocks the underlying action (reservation, payment).
- The low-stock digest only sends if at least one item is at or below its
  reorder level; an empty inventory report sends no email that day.
- From **Inventory → Stock Items**, click **Send Low Stock Digest Now** to
  trigger it on demand — useful for confirming your SMTP settings work
  without waiting for the daily schedule.
- Email delivery failures are logged (`backend/logs/error.log`) but never
  interrupt the guest-facing action that triggered them — a reservation or
  payment always succeeds even if the confirmation email doesn't go out.
- **For testing only, use Gmail.** For a live property, use a proper
  transactional provider (SendGrid, Brevo, Mailgun, or Amazon SES) — Gmail
  has daily sending limits and isn't built to carry production email
  traffic. Switching providers is just four lines in `.env`; see
  `docs/INSTALL.md`, Section 8, for the comparison and setup.

---

*For installation instructions, see `docs/INSTALL.md`. For questions not
covered here, check the inline validation messages in each form — they're
written to explain exactly what's missing or wrong.*
