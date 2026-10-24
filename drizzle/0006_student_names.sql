ALTER TABLE `login_accounts` ADD `first_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `login_accounts` ADD `last_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `login_accounts` ADD `name_status` text DEFAULT 'legacy' NOT NULL;
--> statement-breakpoint
ALTER TABLE `login_accounts` ADD `name_flags` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `login_accounts` ADD `name_version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `login_accounts` ADD `name_review_note` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `login_accounts` ADD `name_reviewed_by` text;
--> statement-breakpoint
ALTER TABLE `login_accounts` ADD `name_reviewed_at` integer;
--> statement-breakpoint
CREATE INDEX `accounts_name_status_idx` ON `login_accounts` (`name_status`);
