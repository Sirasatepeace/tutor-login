CREATE TABLE `exam_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`course_id` text NOT NULL,
	`user_id` text NOT NULL,
	`revision` integer NOT NULL,
	`score` integer NOT NULL,
	`total_points` integer NOT NULL,
	`result` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `exam_attempts_student_idx` ON `exam_attempts` (`exam_id`,`user_id`,`created`);--> statement-breakpoint
CREATE INDEX `exam_attempts_course_idx` ON `exam_attempts` (`course_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `exam_images` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`object_key` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `exam_images_course_idx` ON `exam_images` (`course_id`);--> statement-breakpoint
CREATE TABLE `exams` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`questions` text DEFAULT '[]' NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`show_answers` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `exams_course_idx` ON `exams` (`course_id`);