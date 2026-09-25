-- Online payment links (Razorpay) per invoice
CREATE TABLE payment_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(20) NOT NULL DEFAULT 'RAZORPAY',
  provider_link_id VARCHAR(60) NOT NULL,
  short_url VARCHAR(255) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  status ENUM('CREATED','PAID','CANCELLED','EXPIRED') NOT NULL DEFAULT 'CREATED',
  provider_payment_id VARCHAR(60) NULL,
  payment_id BIGINT UNSIGNED NULL,          -- our payments.id once recorded
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_payment_links_provider (provider, provider_link_id),
  KEY idx_payment_links_invoice (invoice_id, status),
  CONSTRAINT fk_pl_company FOREIGN KEY (company_id) REFERENCES companies (id),
  CONSTRAINT fk_pl_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A gateway payment must never be recorded twice (webhook + sync can both fire)
ALTER TABLE payments
  ADD COLUMN gateway_payment_id VARCHAR(60) NULL AFTER reference_no,
  ADD UNIQUE KEY uk_payments_gateway (gateway_payment_id);

-- Customer portal: one secret link per customer (regenerate to revoke)
CREATE TABLE customer_portal (
  customer_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  token CHAR(48) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_access_at DATETIME NULL,
  UNIQUE KEY uk_customer_portal_token (token),
  CONSTRAINT fk_portal_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
  CONSTRAINT fk_portal_company FOREIGN KEY (company_id) REFERENCES companies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
