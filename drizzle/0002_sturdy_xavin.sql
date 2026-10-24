CREATE TABLE `auth_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`device_id` text NOT NULL,
	`event` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `login_sessions` ADD `device_id` text DEFAULT 'legacy' NOT NULL;