-- Per-company switches for automatic reminders / renewal alerts / renewal auto-invoice
CREATE TABLE IF NOT EXISTS notification_settings (
  company_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  auto_reminders TINYINT(1) NOT NULL DEFAULT 0,
  reminder_days VARCHAR(60) NOT NULL DEFAULT '3,7,15',
  renewal_alerts TINYINT(1) NOT NULL DEFAULT 0,
  renewal_auto_invoice TINYINT(1) NOT NULL DEFAULT 0,
  renewal_invoice_days_before INT NOT NULL DEFAULT 7,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_settings_company FOREIGN KEY (company_id) REFERENCES companies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per automatic message/action; the unique key stops the same thing happening twice
CREATE TABLE IF NOT EXISTS notification_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  kind VARCHAR(40) NOT NULL,          -- INVOICE_EMAIL | INVOICE_REMINDER | RENEWAL_ALERT | RENEWAL_INVOICE
  entity_type VARCHAR(20) NOT NULL,   -- INVOICE | RENEWAL
  entity_id BIGINT UNSIGNED NOT NULL,
  ref_key VARCHAR(80) NOT NULL,       -- e.g. overdue-7, due-2026-10-01, manual-<timestamp>
  channel VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
  recipient VARCHAR(255) NULL,
  status ENUM('PENDING','SENT','FAILED','SKIPPED') NOT NULL DEFAULT 'PENDING',
  error VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_notif_once (company_id, kind, entity_id, ref_key),
  KEY idx_notif_company_date (company_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
