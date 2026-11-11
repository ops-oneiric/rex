CREATE TABLE `action_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_type` text NOT NULL,
	`source_id` integer,
	`associate_id` integer,
	`text` text NOT NULL,
	`owner` text NOT NULL,
	`due_hint` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`user_edited` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `action_items_associate_idx` ON `action_items` (`associate_id`,`status`);--> statement-breakpoint
CREATE INDEX `action_items_source_idx` ON `action_items` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `cadence_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`associate_id` integer NOT NULL,
	`occurred_on` text NOT NULL,
	`notes` text NOT NULL,
	`analysis_status` text DEFAULT 'PENDING' NOT NULL,
	`analysis_error` text,
	`insight` text,
	`insight_model` text,
	`insight_prompt_version` text,
	`insight_cost_usd` real,
	`analyzed_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cadence_entries_associate_idx` ON `cadence_entries` (`associate_id`,`occurred_on`);--> statement-breakpoint
CREATE TABLE `trend_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` integer,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`content` text,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`cost_usd` real,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trend_reports_subject_idx` ON `trend_reports` (`subject_type`,`subject_id`,`created_at`);