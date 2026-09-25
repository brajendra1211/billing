-- 1) billing_months as a real column (was only encoded in the description text)
ALTER TABLE invoice_items
  ADD COLUMN billing_months DECIMAL(8,2) NOT NULL DEFAULT 1.00 AFTER qty;

-- Backfill from descriptions like "... | Billing: 14 x 12 months @ 660/month"
UPDATE invoice_items
SET billing_months = CAST(
      SUBSTRING_INDEX(SUBSTRING_INDEX(REGEXP_SUBSTR(description, 'x [0-9.]+ months'), ' ', 2), ' ', -1)
      AS DECIMAL(8,2))
WHERE description REGEXP 'Billing: [0-9.]+ x [0-9.]+ months';

-- 2) Credit notes reduce an invoice's due amount
ALTER TABLE invoices
  ADD COLUMN credit_total DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER paid_total;

CREATE TABLE credit_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  financial_year VARCHAR(9) NOT NULL,
  prefix VARCHAR(30) NOT NULL,
  cn_number INT NOT NULL,
  cn_no VARCHAR(60) NOT NULL,
  cn_date DATE NOT NULL,
  reason VARCHAR(255) NOT NULL,
  is_interstate TINYINT(1) NOT NULL DEFAULT 0,
  taxable_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  cgst_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  sgst_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  igst_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  refund_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  refund_mode VARCHAR(30) NULL,
  refund_reference VARCHAR(120) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_credit_notes_company_no (company_id, cn_no),
  KEY idx_credit_notes_invoice (invoice_id),
  KEY idx_credit_notes_company_date (company_id, cn_date),
  CONSTRAINT fk_cn_company FOREIGN KEY (company_id) REFERENCES companies (id),
  CONSTRAINT fk_cn_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id),
  CONSTRAINT fk_cn_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
  CONSTRAINT fk_cn_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE credit_note_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  credit_note_id BIGINT UNSIGNED NOT NULL,
  invoice_item_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NULL,
  description VARCHAR(500) NULL,
  hsn_sac VARCHAR(20) NULL,
  qty DECIMAL(12,2) NOT NULL,
  rate DECIMAL(14,2) NOT NULL,
  tax_percent DECIMAL(5,2) NOT NULL,
  taxable_amount DECIMAL(14,2) NOT NULL,
  cgst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  sgst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  igst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(14,2) NOT NULL,
  KEY idx_cni_note (credit_note_id),
  KEY idx_cni_invoice_item (invoice_item_id),
  CONSTRAINT fk_cni_note FOREIGN KEY (credit_note_id) REFERENCES credit_notes (id) ON DELETE CASCADE,
  CONSTRAINT fk_cni_invoice_item FOREIGN KEY (invoice_item_id) REFERENCES invoice_items (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
