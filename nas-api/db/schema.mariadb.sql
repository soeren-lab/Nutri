SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `email_confirmed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_sign_in_at` DATETIME(3) NULL,
  `user_meta` LONGTEXT NULL,
  `app_meta` LONGTEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `token_hash` CHAR(64) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`token_hash`),
  KEY `refresh_tokens_user_idx` (`user_id`),
  CONSTRAINT `refresh_tokens_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `storage_objects` (
  `bucket` VARCHAR(64) NOT NULL,
  `path` VARCHAR(500) NOT NULL,
  `owner_id` CHAR(36) NULL,
  `mime` VARCHAR(100) NULL,
  `size` BIGINT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`bucket`, `path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `achievements` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `achievement_key` VARCHAR(255) NOT NULL,
  `unlocked_at` DATETIME(3) NOT NULL,
  `progress_value` DOUBLE NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `achievements_user_id_achievement_key_key` (`user_id`, `achievement_key`),
  CONSTRAINT `achievements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ai_suggestion_cache` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `meal_slot` VARCHAR(255) NOT NULL,
  `date` DATE NOT NULL,
  `kcal_bucket` INT NOT NULL,
  `protein_bucket` INT NOT NULL,
  `carbs_bucket` INT NOT NULL,
  `fat_bucket` INT NOT NULL,
  `suggestions` LONGTEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ai_suggestion_cache_user_id_meal_slot_date_kcal_bucket_prot_` (`user_id`, `meal_slot`, `date`, `kcal_bucket`, `protein_bucket`, `carbs_bucket`, `fat_bucket`),
  KEY `ai_suggestion_cache_expires_idx` (`expires_at`),
  CONSTRAINT `ai_suggestion_cache_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `body_measurements` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `date` DATE NOT NULL,
  `weight_kg` DOUBLE NULL,
  `body_fat_percent` DOUBLE NULL,
  `note` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `body_measurements_user_id_date_key` (`user_id`, `date`),
  CONSTRAINT `body_measurements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `brands` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `is_published` TINYINT(1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `brands_user_id_name_key` (`user_id`, `name`),
  CONSTRAINT `brands_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `component_variants` (
  `id` CHAR(36) NOT NULL,
  `component_id` CHAR(36) NOT NULL,
  `label` TEXT NOT NULL,
  `sort_order` INT NOT NULL,
  `is_default` TINYINT(1) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `component_variants_component_id_idx` (`component_id`),
  CONSTRAINT `component_variants_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `recipe_components`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cookbook_members` (
  `id` CHAR(36) NOT NULL,
  `cookbook_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `role` TEXT NOT NULL,
  `added_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cookbook_members_cookbook_id_user_id_key` (`cookbook_id`, `user_id`),
  KEY `cookbook_members_cookbook_id_idx` (`cookbook_id`),
  KEY `cookbook_members_user_id_idx` (`user_id`),
  CONSTRAINT `cookbook_members_cookbook_id_fkey` FOREIGN KEY (`cookbook_id`) REFERENCES `cookbooks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cookbook_recipes` (
  `id` CHAR(36) NOT NULL,
  `cookbook_id` CHAR(36) NOT NULL,
  `recipe_id` CHAR(36) NOT NULL,
  `sort_order` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cookbook_recipes_cookbook_id_recipe_id_key` (`cookbook_id`, `recipe_id`),
  KEY `cookbook_recipes_cookbook_id_idx` (`cookbook_id`),
  CONSTRAINT `cookbook_recipes_cookbook_id_fkey` FOREIGN KEY (`cookbook_id`) REFERENCES `cookbooks`(`id`) ON DELETE CASCADE,
  CONSTRAINT `cookbook_recipes_recipe_id_fkey` FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cookbooks` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `title` TEXT NOT NULL,
  `description` TEXT NULL,
  `cover_image_url` TEXT NULL,
  `share_token` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cookbooks_share_token_key` (`share_token`),
  KEY `cookbooks_user_id_idx` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `credit_ledger` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `kind` TEXT NOT NULL,
  `amount_usd` DECIMAL(14,6) NOT NULL,
  `balance_after_usd` DECIMAL(14,6) NOT NULL,
  `note` TEXT NULL,
  `model` TEXT NULL,
  `input_tokens` INT NULL,
  `output_tokens` INT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `credit_ledger_user_created_idx` (`user_id`, `created_at`),
  CONSTRAINT `credit_ledger_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `favorites` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `recipe_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `favorites_user_id_recipe_id_key` (`user_id`, `recipe_id`),
  CONSTRAINT `favorites_recipe_id_fkey` FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON DELETE CASCADE,
  CONSTRAINT `favorites_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `friend_requests` (
  `id` CHAR(36) NOT NULL,
  `sender_id` CHAR(36) NOT NULL,
  `receiver_id` CHAR(36) NOT NULL,
  `status` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `responded_at` DATETIME(3) NULL,
  `sender_seen_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `friend_requests_unique_pair` (`sender_id`, `receiver_id`),
  KEY `idx_friend_requests_receiver` (`receiver_id`, `status`),
  KEY `idx_friend_requests_sender` (`sender_id`, `status`),
  CONSTRAINT `friend_requests_receiver_id_fkey` FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `friend_requests_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `friendships` (
  `id` CHAR(36) NOT NULL,
  `user_id_a` CHAR(36) NOT NULL,
  `user_id_b` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `friendships_unique` (`user_id_a`, `user_id_b`),
  KEY `idx_friendships_a` (`user_id_a`),
  KEY `idx_friendships_b` (`user_id_b`),
  CONSTRAINT `friendships_user_id_a_fkey` FOREIGN KEY (`user_id_a`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `friendships_user_id_b_fkey` FOREIGN KEY (`user_id_b`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ingredients` (
  `id` CHAR(36) NOT NULL,
  `recipe_id` CHAR(36) NOT NULL,
  `name` TEXT NOT NULL,
  `amount` DOUBLE NULL,
  `unit` TEXT NULL,
  `sort_order` INT NOT NULL,
  `calories` DOUBLE NULL,
  `protein_g` DOUBLE NULL,
  `carbs_g` DOUBLE NULL,
  `fat_g` DOUBLE NULL,
  `ingredient_master_id` CHAR(36) NULL,
  `component_id` CHAR(36) NULL,
  `variant_id` CHAR(36) NULL,
  `product_group` TEXT NULL,
  `fiber_g` DOUBLE NULL,
  `sugar_g` DOUBLE NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ingredients_component_id` (`component_id`),
  KEY `ingredients_recipe_idx` (`recipe_id`),
  KEY `ingredients_variant_id_idx` (`variant_id`),
  CONSTRAINT `ingredients_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `recipe_components`(`id`) ON DELETE CASCADE,
  CONSTRAINT `ingredients_ingredient_master_id_fkey` FOREIGN KEY (`ingredient_master_id`) REFERENCES `ingredients_master`(`id`) ON DELETE SET NULL,
  CONSTRAINT `ingredients_recipe_id_fkey` FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON DELETE CASCADE,
  CONSTRAINT `ingredients_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `component_variants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ingredients_master` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `name` TEXT NOT NULL,
  `unit` TEXT NOT NULL,
  `calories` DOUBLE NULL,
  `protein_g` DOUBLE NULL,
  `carbs_g` DOUBLE NULL,
  `fat_g` DOUBLE NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `density_g_per_ml` DOUBLE NULL,
  `image_url` TEXT NULL,
  `brand_id` CHAR(36) NULL,
  `category` TEXT NOT NULL,
  `archived` TINYINT(1) NOT NULL,
  `is_published` TINYINT(1) NOT NULL,
  `published_version` INT NOT NULL,
  `source_ingredient_id` CHAR(36) NULL,
  `imported_version` INT NULL,
  `dismissed_version` INT NULL,
  `subcategory` TEXT NULL,
  `published_at` DATETIME(3) NULL,
  `fiber_g` DOUBLE NULL,
  `sugar_g` DOUBLE NULL,
  `source_updated_at` DATETIME(3) NULL,
  `dismissed_source_updated_at` DATETIME(3) NULL,
  `source` TEXT NULL,
  `source_barcode` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ingredients_master_brand_id` (`brand_id`),
  KEY `ingredients_master_archived_idx` (`user_id`, `archived`),
  KEY `ingredients_master_published_idx` (`is_published`),
  KEY `ingredients_master_source_idx` (`source_ingredient_id`),
  KEY `ingredients_master_user_barcode_idx` (`user_id`, `source_barcode`),
  CONSTRAINT `ingredients_master_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE SET NULL,
  CONSTRAINT `ingredients_master_source_ingredient_id_fkey` FOREIGN KEY (`source_ingredient_id`) REFERENCES `ingredients_master`(`id`) ON DELETE SET NULL,
  CONSTRAINT `ingredients_master_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS `meal_plan_entries` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `date` DATE NOT NULL,
  `meal_slot` TEXT NOT NULL,
  `recipe_id` CHAR(36) NULL,
  `servings` DOUBLE NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `food_type` TEXT NOT NULL,
  `ingredient_master_id` CHAR(36) NULL,
  `amount` DOUBLE NULL,
  `unit` TEXT NULL,
  `sort_order` INT NOT NULL,
  `quick_entry_name` TEXT NULL,
  `quick_entry_calories` DOUBLE NULL,
  `quick_entry_protein_g` DOUBLE NULL,
  `quick_entry_carbs_g` DOUBLE NULL,
  `quick_entry_fat_g` DOUBLE NULL,
  `selected_variant_ids` LONGTEXT NULL,
  `snapshot_name` TEXT NULL,
  `snapshot_calories` DOUBLE NULL,
  `snapshot_protein_g` DOUBLE NULL,
  `snapshot_carbs_g` DOUBLE NULL,
  `snapshot_fat_g` DOUBLE NULL,
  `group_choices` LONGTEXT NULL,
  `snapshot_variant_label` TEXT NULL,
  `snapshot_ingredients` LONGTEXT NULL,
  `days_late` INT NOT NULL,
  `input_mode` TEXT NOT NULL,
  `input_grams_value` DOUBLE NULL,
  `batch_group_id` CHAR(36) NULL,
  `batch_role` TEXT NOT NULL,
  `batch_cook_date` DATE NULL,
  `batch_cooked_at` DATETIME(3) NULL,
  `snapshot_fiber_g` DOUBLE NULL,
  `quick_entry_fiber_g` DOUBLE NULL,
  `snapshot_sugar_g` DOUBLE NULL,
  `quick_entry_sugar_g` DOUBLE NULL,
  `skipped` TINYINT(1) NOT NULL,
  `photo_path` TEXT NULL,
  `photo_items` LONGTEXT NULL,
  PRIMARY KEY (`id`),
  KEY `meal_plan_entries_batch_cook_date_idx` (`user_id`, `batch_cook_date`),
  KEY `meal_plan_entries_batch_group_idx` (`batch_group_id`),
  KEY `meal_plan_entries_user_date_idx` (`user_id`, `date`),
  CONSTRAINT `meal_plan_entries_ingredient_master_id_fkey` FOREIGN KEY (`ingredient_master_id`) REFERENCES `ingredients_master`(`id`) ON DELETE CASCADE,
  CONSTRAINT `meal_plan_entries_recipe_id_fkey` FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON DELETE CASCADE,
  CONSTRAINT `meal_plan_entries_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `patch_note_sections` (
  `id` CHAR(36) NOT NULL,
  `patch_note_id` CHAR(36) NOT NULL,
  `subtitle` TEXT NOT NULL,
  `content` TEXT NOT NULL,
  `sort_order` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `patch_note_sections_note_idx` (`patch_note_id`, `sort_order`),
  CONSTRAINT `patch_note_sections_patch_note_id_fkey` FOREIGN KEY (`patch_note_id`) REFERENCES `patch_notes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `patch_notes` (
  `id` CHAR(36) NOT NULL,
  `title` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `published_by` CHAR(36) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `patch_notes_published_by_fkey` FOREIGN KEY (`published_by`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `photo_scan_log` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `photo_scan_log_user_created_idx` (`user_id`, `created_at`),
  CONSTRAINT `photo_scan_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `points_log` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `date` DATE NOT NULL,
  `points_earned` INT NOT NULL,
  `breakdown` LONGTEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `days_late` INT NOT NULL,
  `points_multiplier_applied` DOUBLE NOT NULL,
  `season_id` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `points_log_user_id_date_key` (`user_id`, `date`),
  KEY `points_log_user_date_idx` (`user_id`, `date`),
  KEY `points_log_user_season_date_idx` (`user_id`, `season_id`, `date`),
  CONSTRAINT `points_log_season_id_fkey` FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON DELETE SET NULL,
  CONSTRAINT `points_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `fcm_token` VARCHAR(255) NOT NULL,
  `platform` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `push_subscriptions_user_id_fcm_token_key` (`user_id`, `fcm_token`),
  KEY `push_subscriptions_user_idx` (`user_id`),
  CONSTRAINT `push_subscriptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quick_entry_templates` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `name` TEXT NOT NULL,
  `calories` DOUBLE NOT NULL,
  `protein_g` DOUBLE NULL,
  `carbs_g` DOUBLE NULL,
  `fat_g` DOUBLE NULL,
  `use_count` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `fiber_g` DOUBLE NULL,
  `sugar_g` DOUBLE NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `quick_entry_templates_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recipe_components` (
  `id` CHAR(36) NOT NULL,
  `recipe_id` CHAR(36) NOT NULL,
  `name` TEXT NOT NULL,
  `servings` DOUBLE NULL,
  `sort_order` INT NOT NULL,
  `linked_recipe_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `component_type` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_recipe_components_linked_recipe_id` (`linked_recipe_id`),
  KEY `idx_recipe_components_recipe_id` (`recipe_id`),
  CONSTRAINT `recipe_components_linked_recipe_id_fkey` FOREIGN KEY (`linked_recipe_id`) REFERENCES `recipes`(`id`) ON DELETE SET NULL,
  CONSTRAINT `recipe_components_recipe_id_fkey` FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recipes` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `title` TEXT NOT NULL,
  `description` TEXT NULL,
  `image_url` TEXT NULL,
  `servings` INT NULL,
  `prep_time_minutes` INT NULL,
  `cook_time_minutes` INT NULL,
  `category` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `calories` DOUBLE NULL,
  `protein_g` DOUBLE NULL,
  `carbs_g` DOUBLE NULL,
  `fat_g` DOUBLE NULL,
  `nutrition_mode` TEXT NOT NULL,
  `categories` LONGTEXT NOT NULL,
  `tag` TEXT NULL,
  `is_component_only` TINYINT(1) NOT NULL,
  `is_published` TINYINT(1) NOT NULL,
  `published_version` INT NOT NULL,
  `source_recipe_id` CHAR(36) NULL,
  `imported_version` INT NULL,
  `dismissed_version` INT NULL,
  `is_fixed_batch` TINYINT(1) NOT NULL,
  `batch_servings` DOUBLE NULL,
  `fiber_g` DOUBLE NULL,
  `sugar_g` DOUBLE NULL,
  `source_updated_at` DATETIME(3) NULL,
  `dismissed_source_updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `recipes_is_published_idx` (`is_published`),
  KEY `recipes_source_recipe_id_idx` (`source_recipe_id`),
  CONSTRAINT `recipes_source_recipe_id_fkey` FOREIGN KEY (`source_recipe_id`) REFERENCES `recipes`(`id`) ON DELETE SET NULL,
  CONSTRAINT `recipes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `season_history` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `season_id` CHAR(36) NOT NULL,
  `final_points` INT NOT NULL,
  `final_rank` TEXT NULL,
  `final_placement_among_friends` INT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `season_history_user_id_season_id_key` (`user_id`, `season_id`),
  CONSTRAINT `season_history_season_id_fkey` FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON DELETE CASCADE,
  CONSTRAINT `season_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `season_points` (
  `user_id` CHAR(36) NOT NULL,
  `season_id` CHAR(36) NOT NULL,
  `total_points` INT NOT NULL,
  `current_streak_days` INT NOT NULL,
  `last_points_date` DATE NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`user_id`, `season_id`),
  CONSTRAINT `season_points_season_id_fkey` FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON DELETE CASCADE,
  CONSTRAINT `season_points_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `season_points_log` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `season_id` CHAR(36) NOT NULL,
  `date` DATE NOT NULL,
  `points_earned` INT NOT NULL,
  `breakdown` LONGTEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `season_points_log_user_id_season_id_date_key` (`user_id`, `season_id`, `date`),
  CONSTRAINT `season_points_log_season_id_fkey` FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON DELETE CASCADE,
  CONSTRAINT `season_points_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `seasons` (
  `id` CHAR(36) NOT NULL,
  `name` TEXT NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `is_active` TINYINT(1) NOT NULL,
  `season_number` INT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shared_with_friends` (
  `id` CHAR(36) NOT NULL,
  `owner_user_id` CHAR(36) NOT NULL,
  `friend_user_id` CHAR(36) NOT NULL,
  `content_type` VARCHAR(255) NOT NULL,
  `content_id` CHAR(36) NOT NULL,
  `shared_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `shared_with_friends_unique` (`owner_user_id`, `friend_user_id`, `content_type`, `content_id`),
  KEY `idx_shared_with_friends_content` (`content_type`, `content_id`),
  KEY `idx_shared_with_friends_friend` (`friend_user_id`, `content_type`),
  CONSTRAINT `shared_with_friends_friend_user_id_fkey` FOREIGN KEY (`friend_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `shared_with_friends_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shopping_list_items` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `ingredient_master_id` CHAR(36) NULL,
  `name` TEXT NOT NULL,
  `amount` DOUBLE NULL,
  `unit` TEXT NULL,
  `category` VARCHAR(255) NOT NULL,
  `is_checked` TINYINT(1) NOT NULL,
  `is_manual` TINYINT(1) NOT NULL,
  `source_recipe_ids` LONGTEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `shopping_list_items_user_idx` (`user_id`, `category`, `is_checked`),
  CONSTRAINT `shopping_list_items_ingredient_master_id_fkey` FOREIGN KEY (`ingredient_master_id`) REFERENCES `ingredients_master`(`id`) ON DELETE SET NULL,
  CONSTRAINT `shopping_list_items_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `steps` (
  `id` CHAR(36) NOT NULL,
  `recipe_id` CHAR(36) NOT NULL,
  `step_number` INT NOT NULL,
  `instruction` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `steps_recipe_idx` (`recipe_id`),
  CONSTRAINT `steps_recipe_id_fkey` FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `target_history` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `target_calories` DOUBLE NULL,
  `target_protein_g` DOUBLE NULL,
  `target_carbs_g` DOUBLE NULL,
  `target_fat_g` DOUBLE NULL,
  `valid_from` DATE NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `target_fiber_g` DOUBLE NULL,
  `target_sugar_max_g` DOUBLE NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `target_history_user_id_valid_from_key` (`user_id`, `valid_from`),
  KEY `idx_target_history_user_date` (`user_id`, `valid_from`),
  CONSTRAINT `target_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_credits` (
  `user_id` CHAR(36) NOT NULL,
  `balance_usd` DECIMAL(14,6) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `user_credits_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_plans` (
  `user_id` CHAR(36) NOT NULL,
  `plan` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `user_plans_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_plates` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `name` TEXT NOT NULL,
  `shape` TEXT NOT NULL,
  `width_cm` DOUBLE NOT NULL,
  `length_cm` DOUBLE NULL,
  `depth_cm` DOUBLE NOT NULL,
  `capacity_ml` DOUBLE NULL,
  `photo_path` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_plates_user_idx` (`user_id`),
  CONSTRAINT `user_plates_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_points` (
  `user_id` CHAR(36) NOT NULL,
  `total_points` INT NOT NULL,
  `current_streak_days` INT NOT NULL,
  `last_points_date` DATE NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `current_season_id` CHAR(36) NULL,
  `bonus_points` INT NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `user_points_current_season_id_fkey` FOREIGN KEY (`current_season_id`) REFERENCES `seasons`(`id`),
  CONSTRAINT `user_points_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_profile` (
  `user_id` CHAR(36) NOT NULL,
  `weight_kg` DOUBLE NULL,
  `height_cm` DOUBLE NULL,
  `age` INT NULL,
  `sex` TEXT NULL,
  `activity_level` TEXT NOT NULL,
  `goal` TEXT NOT NULL,
  `goal_rate` TEXT NOT NULL,
  `target_calories` DOUBLE NULL,
  `target_protein_g` DOUBLE NULL,
  `target_carbs_g` DOUBLE NULL,
  `target_fat_g` DOUBLE NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `username` VARCHAR(255) NULL,
  `avatar_url` TEXT NULL,
  `target_fiber_g` DOUBLE NULL,
  `target_sugar_max_g` DOUBLE NULL,
  `track_protein` TINYINT(1) NOT NULL,
  `track_carbs` TINYINT(1) NOT NULL,
  `track_fat` TINYINT(1) NOT NULL,
  `track_fiber` TINYINT(1) NOT NULL,
  `track_sugar` TINYINT(1) NOT NULL,
  `theme_preference` TEXT NOT NULL,
  `username_changed_at` DATETIME(3) NULL,
  `experimental_glass_ui` TINYINT(1) NOT NULL,
  `experimental_glass_variant` TEXT NOT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `user_profile_username_unique` (`username`),
  CONSTRAINT `user_profile_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `role` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_roles_user_id_role_key` (`user_id`, `role`),
  CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_seen_patch_notes` (
  `user_id` CHAR(36) NOT NULL,
  `patch_note_id` CHAR(36) NOT NULL,
  `seen_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`user_id`, `patch_note_id`),
  CONSTRAINT `user_seen_patch_notes_patch_note_id_fkey` FOREIGN KEY (`patch_note_id`) REFERENCES `patch_notes`(`id`) ON DELETE CASCADE,
  CONSTRAINT `user_seen_patch_notes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_seen_seasons` (
  `user_id` CHAR(36) NOT NULL,
  `season_id` CHAR(36) NOT NULL,
  `seen_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`user_id`, `season_id`),
  CONSTRAINT `user_seen_seasons_season_id_fkey` FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON DELETE CASCADE,
  CONSTRAINT `user_seen_seasons_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
