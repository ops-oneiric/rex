CREATE TABLE `associate_capabilities` (
	`associate_id` integer NOT NULL,
	`capability_id` integer NOT NULL,
	`proficiency` integer NOT NULL,
	PRIMARY KEY(`associate_id`, `capability_id`),
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`capability_id`) REFERENCES `capabilities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `associate_capabilities_capability_idx` ON `associate_capabilities` (`capability_id`);--> statement-breakpoint
CREATE TABLE `associate_pto` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`associate_id` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`is_partial_day` integer DEFAULT false NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `associate_pto_associate_dates_idx` ON `associate_pto` (`associate_id`,`start_date`);--> statement-breakpoint
CREATE TABLE `associates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`title` text,
	`time_zone` text NOT NULL,
	`can_pm` integer DEFAULT false NOT NULL,
	`can_payroll` integer DEFAULT false NOT NULL,
	`target_load` real DEFAULT 8 NOT NULL,
	`is_directly_managed` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`capability_notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `associates_name_unique` ON `associates` (lower("name"));--> statement-breakpoint
CREATE TABLE `capabilities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `capabilities_name_unique` ON `capabilities` (lower("name"));