-- =====================================================================
-- HotelPro 5.0 — Production Database Schema (MySQL 8+)
-- Modules: Front Desk, Reservations, Housekeeping, POS, Inventory,
--          Billing, Guest CRM, Reports, Settings/Auth
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- SETTINGS / SYSTEM
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hotel_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  hotel_name VARCHAR(150) NOT NULL,
  legal_name VARCHAR(150),
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(150),
  website VARCHAR(150),
  logo_url VARCHAR(255),
  currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
  currency_symbol VARCHAR(5) NOT NULL DEFAULT '$',
  currency_position ENUM('before','after') NOT NULL DEFAULT 'before',
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  date_format VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
  tax_percent DECIMAL(6,3) NOT NULL DEFAULT 0.000,
  tax_label VARCHAR(30) DEFAULT 'Tax',
  service_charge_percent DECIMAL(6,3) NOT NULL DEFAULT 0.000,
  checkin_time TIME DEFAULT '14:00:00',
  checkout_time TIME DEFAULT '12:00:00',
  installed_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- AUTH / STAFF (RBAC)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,          -- admin, manager, front_desk, housekeeping, pos, accountant
  description VARCHAR(255),
  permissions JSON NOT NULL,                  -- {"reservations":["read","write"], ...}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role_id INT NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  avatar_url VARCHAR(255),
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  last_login_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(60),
  entity_id VARCHAR(60),
  details JSON,
  ip_address VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- FRONT DESK — Room inventory / Room types
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS room_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,                 -- Standard, Deluxe, Suite
  description TEXT,
  base_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  max_occupancy INT NOT NULL DEFAULT 2,
  amenities JSON,
  image_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rooms (
  id INT PRIMARY KEY AUTO_INCREMENT,
  room_type_id INT NOT NULL,
  room_number VARCHAR(20) NOT NULL UNIQUE,
  floor VARCHAR(20),
  status ENUM('available','occupied','reserved','maintenance','out_of_order') NOT NULL DEFAULT 'available',
  housekeeping_status ENUM('clean','dirty','inspected','cleaning_in_progress') NOT NULL DEFAULT 'clean',
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_type_id) REFERENCES room_types(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- GUEST CRM
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(50),
  id_type VARCHAR(40),
  id_number VARCHAR(80),
  nationality VARCHAR(80),
  address VARCHAR(255),
  city VARCHAR(100),
  country VARCHAR(100),
  date_of_birth DATE,
  vip_tier ENUM('none','silver','gold','platinum') NOT NULL DEFAULT 'none',
  loyalty_points INT NOT NULL DEFAULT 0,
  preferences JSON,
  blacklisted BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_guest_name (last_name, first_name),
  INDEX idx_guest_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS guest_notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  guest_id INT NOT NULL,
  user_id INT,
  note TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- RESERVATIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  confirmation_code VARCHAR(20) NOT NULL UNIQUE,
  guest_id INT NOT NULL,
  room_type_id INT NOT NULL,
  room_id INT,                                -- assigned at/near check-in
  source ENUM('walk_in','phone','website','ota','corporate') NOT NULL DEFAULT 'walk_in',
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  adults INT NOT NULL DEFAULT 1,
  children INT NOT NULL DEFAULT 0,
  rate_per_night DECIMAL(12,2) NOT NULL,
  status ENUM('booked','confirmed','checked_in','checked_out','cancelled','no_show') NOT NULL DEFAULT 'booked',
  special_requests TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (guest_id) REFERENCES guests(id),
  FOREIGN KEY (room_type_id) REFERENCES room_types(id),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_res_dates (check_in_date, check_out_date),
  INDEX idx_res_status (status)
) ENGINE=InnoDB;

-- Front Desk stay record (created at check-in, drives folio/billing)
CREATE TABLE IF NOT EXISTS stays (
  id INT PRIMARY KEY AUTO_INCREMENT,
  reservation_id INT NOT NULL,
  room_id INT NOT NULL,
  guest_id INT NOT NULL,
  actual_check_in DATETIME,
  actual_check_out DATETIME,
  status ENUM('in_house','checked_out') NOT NULL DEFAULT 'in_house',
  checked_in_by INT,
  checked_out_by INT,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id),
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (guest_id) REFERENCES guests(id),
  FOREIGN KEY (checked_in_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (checked_out_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- HOUSEKEEPING
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  room_id INT NOT NULL,
  task_type ENUM('checkout_clean','stay_over_clean','deep_clean','maintenance','inspection') NOT NULL DEFAULT 'stay_over_clean',
  status ENUM('pending','in_progress','completed','verified') NOT NULL DEFAULT 'pending',
  priority ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  assigned_to INT,
  notes VARCHAR(255),
  started_at DATETIME,
  completed_at DATETIME,
  verified_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- INVENTORY
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  department ENUM('housekeeping','fnb','bar','maintenance','front_office','other') NOT NULL DEFAULT 'other'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT,
  sku VARCHAR(60) UNIQUE,
  name VARCHAR(120) NOT NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
  quantity_on_hand DECIMAL(12,2) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_sellable BOOLEAN NOT NULL DEFAULT FALSE,   -- true = also a POS product
  selling_price DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES inventory_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  type ENUM('purchase_in','usage_out','adjustment','pos_sale_out','transfer') NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,             -- positive for in, negative for out
  reference VARCHAR(100),                       -- e.g. PO number, order id
  user_id INT,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  contact_person VARCHAR(120),
  phone VARCHAR(50),
  email VARCHAR(150),
  address VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  po_number VARCHAR(30) NOT NULL UNIQUE,
  supplier_id INT,
  status ENUM('draft','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  ordered_by INT,
  received_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (ordered_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- POINT OF SALE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pos_outlets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,                 -- Restaurant, Bar, Spa, Gift Shop
  type ENUM('restaurant','bar','spa','laundry','minibar','shop','other') NOT NULL DEFAULT 'other'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pos_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(30) NOT NULL UNIQUE,
  outlet_id INT NOT NULL,
  guest_id INT,                                -- nullable for walk-in cash customers
  stay_id INT,                                  -- for room charge linkage
  status ENUM('open','paid','void','charged_to_room') NOT NULL DEFAULT 'open',
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  service_charge DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  opened_by INT,
  closed_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME,
  FOREIGN KEY (outlet_id) REFERENCES pos_outlets(id),
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL,
  FOREIGN KEY (stay_id) REFERENCES stays(id) ON DELETE SET NULL,
  FOREIGN KEY (opened_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pos_order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  item_id INT,                                  -- references inventory_items when sellable
  name VARCHAR(120) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(14,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES pos_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- BILLING / FOLIO / INVOICING / PAYMENTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stay_id INT NOT NULL,
  folio_number VARCHAR(30) NOT NULL UNIQUE,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME,
  FOREIGN KEY (stay_id) REFERENCES stays(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS folio_charges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  folio_id INT NOT NULL,
  charge_type ENUM('room','pos','tax','service_charge','misc','discount','adjustment') NOT NULL,
  description VARCHAR(255) NOT NULL,
  reference_table VARCHAR(50),                 -- e.g. 'pos_orders'
  reference_id INT,
  amount DECIMAL(14,2) NOT NULL,               -- negative for discounts
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (folio_id) REFERENCES folios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_number VARCHAR(30) NOT NULL UNIQUE,
  folio_id INT,
  pos_order_id INT,
  guest_id INT,
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  service_charge DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance_due DECIMAL(14,2) NOT NULL DEFAULT 0,
  status ENUM('unpaid','partial','paid','void','refunded') NOT NULL DEFAULT 'unpaid',
  currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
  issued_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (folio_id) REFERENCES folios(id) ON DELETE SET NULL,
  FOREIGN KEY (pos_order_id) REFERENCES pos_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL,
  FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_id INT NOT NULL,
  method ENUM('cash','card','bank_transfer','mobile_money','paystack','stripe','flutterwave','credit') NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
  transaction_ref VARCHAR(150),
  gateway_response JSON,
  status ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'completed',
  received_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- SEED: default roles
-- ---------------------------------------------------------------------
INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Full system access', JSON_OBJECT('all', JSON_ARRAY('read','write','delete'))),
('manager', 'Hotel manager', JSON_OBJECT(
  'front_desk', JSON_ARRAY('read','write'), 'reservations', JSON_ARRAY('read','write'),
  'housekeeping', JSON_ARRAY('read','write'), 'pos', JSON_ARRAY('read','write'),
  'inventory', JSON_ARRAY('read','write'), 'billing', JSON_ARRAY('read','write'),
  'crm', JSON_ARRAY('read','write'), 'reports', JSON_ARRAY('read')
)),
('front_desk', 'Front desk agent', JSON_OBJECT(
  'front_desk', JSON_ARRAY('read','write'), 'reservations', JSON_ARRAY('read','write'),
  'crm', JSON_ARRAY('read','write'), 'billing', JSON_ARRAY('read','write')
)),
('housekeeping', 'Housekeeping staff', JSON_OBJECT('housekeeping', JSON_ARRAY('read','write'))),
('pos', 'Point of sale cashier', JSON_OBJECT('pos', JSON_ARRAY('read','write'), 'inventory', JSON_ARRAY('read'))),
('accountant', 'Accounting / billing', JSON_OBJECT('billing', JSON_ARRAY('read','write'), 'reports', JSON_ARRAY('read')))
ON DUPLICATE KEY UPDATE description=VALUES(description);
