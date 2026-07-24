CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `remote_support_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`provider` text NOT NULL,
	`code` text NOT NULL,
	`status` text NOT NULL,
	`expires_in_minutes` integer NOT NULL,
	`launch_url` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`external_ref` text NOT NULL,
	`title` text NOT NULL,
	`requester` text NOT NULL,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`owner` text NOT NULL,
	`category` text NOT NULL,
	`confidence` integer NOT NULL,
	`ai_summary` text NOT NULL,
	`sla` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL
);
