CREATE TABLE IF NOT EXISTS `lesson_notices` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`content` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `courses` ADD `visibility` text DEFAULT 'restricted' NOT NULL;--> statement-breakpoint
ALTER TABLE `login_accounts` ADD `nickname` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `login_accounts` ADD `grade` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `login_accounts` ADD `school` text DEFAULT '' NOT NULL;
