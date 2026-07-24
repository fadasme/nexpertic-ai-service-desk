CREATE TABLE `security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`at` text NOT NULL,
	`detail` text NOT NULL,
	`fingerprint` text,
	`severity` text NOT NULL,
	`source` text NOT NULL,
	`ticket_id` text
);
