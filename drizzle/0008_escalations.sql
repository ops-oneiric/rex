CREATE TABLE `escalation_associates` (
	`escalation_id` integer NOT NULL,
	`associate_id` integer NOT NULL,
	`at_fault` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`escalation_id`, `associate_id`),
	FOREIGN KEY (`escalation_id`) REFERENCES `escalations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `escalation_associates_associate_idx` ON `escalation_associates` (`associate_id`);--> statement-breakpoint
CREATE TABLE `escalations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`occurred_on` text NOT NULL,
	`details` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`resolved_at` integer,
	`client_id` integer,
	`summary` text,
	`category` text,
	`severity` text,
	`fault_party` text,
	`fault_rationale` text,
	`root_cause` text,
	`preventable` text,
	`confirmed_at` integer,
	`analysis_status` text DEFAULT 'PENDING' NOT NULL,
	`analysis_error` text,
	`suggestion` text,
	`request_payload` text,
	`alias_map` text,
	`ai_model` text,
	`prompt_version` text,
	`cost_usd` real,
	`analyzed_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `escalations_occurred_idx` ON `escalations` (`occurred_on`);--> statement-breakpoint
CREATE INDEX `escalations_client_idx` ON `escalations` (`client_id`);