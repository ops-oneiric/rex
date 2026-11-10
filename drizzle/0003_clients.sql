CREATE TABLE `client_stage_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`from_stage` text,
	`to_stage` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `client_stage_history_client_idx` ON `client_stage_history` (`client_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text,
	`display_name` text,
	`lifecycle_stage` text NOT NULL,
	`implementation_type` text,
	`support_model` text,
	`employee_count` integer,
	`first_input_date` text,
	`benefits_start_date` text,
	`time_zone` text,
	`control_count` integer,
	`payroll_complexity` integer,
	`previous_vendor` text,
	`notes` text DEFAULT '' NOT NULL,
	`assigned_on` text,
	`stage_changed_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_company_code_unique` ON `clients` (`company_code`);--> statement-breakpoint
CREATE INDEX `clients_stage_idx` ON `clients` (`lifecycle_stage`);--> statement-breakpoint
CREATE INDEX `clients_first_input_idx` ON `clients` (`first_input_date`);--> statement-breakpoint
CREATE TABLE `holidays` (
	`date` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
