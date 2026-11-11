CREATE TABLE `assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`associate_id` integer NOT NULL,
	`seat` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`end_reason` text,
	`source` text DEFAULT 'MANUAL' NOT NULL,
	`override_note` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignments_active_seat_unique` ON `assignments` (`client_id`,`seat`) WHERE "assignments"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX `assignments_associate_idx` ON `assignments` (`associate_id`,`status`);