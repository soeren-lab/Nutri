-- Wasser-Tracking: einmalig in phpMyAdmin (SQL-Reiter, Datenbank wählen) ausführen.
CREATE TABLE IF NOT EXISTS `water_entries` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `date` DATE NOT NULL,
  `amount_ml` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `water_entries_user_date_idx` (`user_id`, `date`),
  CONSTRAINT `water_entries_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
