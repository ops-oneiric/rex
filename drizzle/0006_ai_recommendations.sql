CREATE TABLE `ai_recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`model` text NOT NULL,
	`served_model` text,
	`prompt_version` text NOT NULL,
	`request_payload` text NOT NULL,
	`alias_map` text NOT NULL,
	`response` text,
	`outcome` text DEFAULT 'PENDING' NOT NULL,
	`outcome_reason` text,
	`chosen_team` text,
	`decided_at` integer,
	`input_tokens` integer,
	`output_tokens` integer,
	`cache_read_tokens` integer,
	`cache_write_tokens` integer,
	`cost_usd` real,
	`duration_ms` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_recommendations_client_idx` ON `ai_recommendations` (`client_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `assignments` ADD `recommendation_id` integer REFERENCES ai_recommendations(id) ON DELETE set null;