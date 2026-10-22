-- Digitaler Kühlschrank: einmalig in phpMyAdmin (SQL-Reiter, Datenbank wählen) ausführen.
CREATE TABLE IF NOT EXISTS `fridge_items` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `ingredient_master_id` CHAR(36) NOT NULL,
  `amount` DOUBLE NOT NULL,
  `unit` VARCHAR(16) NOT NULL,
  `location` VARCHAR(16) NOT NULL DEFAULT 'fridge',
  `expires_at` DATE NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fridge_items_user_idx` (`user_id`, `location`),
  CONSTRAINT `fridge_items_ingredient_master_id_fkey` FOREIGN KEY (`ingredient_master_id`) REFERENCES `ingredients_master`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fridge_items_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
