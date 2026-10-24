CREATE TABLE `site_daily_activity` (
 `day` text NOT NULL,
 `user_id` text NOT NULL,
 `page_views` integer DEFAULT 0 NOT NULL,
 `first_seen` integer NOT NULL,
 `last_seen` integer NOT NULL,
 PRIMARY KEY (`day`,`user_id`)
);
--> statement-breakpoint
CREATE INDEX `site_activity_seen_idx` ON `site_daily_activity` (`last_seen`);
--> statement-breakpoint
CREATE TABLE `assistant_requests` (
 `id` text PRIMARY KEY NOT NULL,
 `owner_id` text NOT NULL,
 `message` text NOT NULL,
 `answer` text DEFAULT '' NOT NULL,
 `reports` text DEFAULT '[]' NOT NULL,
 `mode` text NOT NULL,
 `status` text DEFAULT 'pending' NOT NULL,
 `created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assistant_history_idx` ON `assistant_requests` (`owner_id`,`created`);
--> statement-breakpoint
INSERT INTO `settings` (`key`,`value`) VALUES ('analytics_started',CAST(strftime('%s','now')*1000 AS TEXT)) ON CONFLICT(`key`) DO NOTHING;
