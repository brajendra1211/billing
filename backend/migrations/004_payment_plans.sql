-- Project payment plans: total value split into milestones (e.g. 30% / 40% / 30%)
CREATE TABLE payment_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  description VARCHAR(1000) NULL,
  item_id BIGINT UNSIGNED NULL,              -- item used on milestone invoices (HSN/SAC); auto item if NULL
  total_amount DECIMAL(14,2) NOT NULL,       -- taxable value, GST extra
  tax_percent DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  status ENUM('ACTIVE','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_plans_company (company_id, status),
  KEY idx_plans_customer (customer_id),
  CONSTRAINT fk_plans_company FOREIGN KEY (company_id) REFERENCES companies (id),
  CONSTRAINT fk_plans_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
  CONSTRAINT fk_plans_item FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_plan_milestones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  plan_id BIGINT UNSIGNED NOT NULL,
  company_id BIGINT UNSIGNED NOT NULL,
  seq INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  percent DECIMAL(6,2) NULL,
  amount DECIMAL(14,2) NOT NULL,              -- taxable value of this installment
  due_date DATE NULL,                          -- NULL = due on completion of the stage
  demand_no VARCHAR(60) NULL,                  -- UDL/2026-27/000001, assigned on first demand
  demand_count INT NOT NULL DEFAULT 0,
  last_demand_at DATETIME NULL,
  invoice_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_milestone_demand_no (company_id, demand_no),
  UNIQUE KEY uk_milestone_invoice (invoice_id),
  KEY idx_milestones_plan (plan_id, seq),
  KEY idx_milestones_due (company_id, due_date),
  CONSTRAINT fk_ms_plan FOREIGN KEY (plan_id) REFERENCES payment_plans (id) ON DELETE CASCADE,
  CONSTRAINT fk_ms_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Automation switches for milestones
ALTER TABLE notification_settings
  ADD COLUMN milestone_demands TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN milestone_demand_days INT NOT NULL DEFAULT 7,
  ADD COLUMN milestone_auto_invoice TINYINT(1) NOT NULL DEFAULT 0;
