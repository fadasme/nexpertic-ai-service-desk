CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`owner` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`custom_fields` text
);
--> statement-breakpoint
CREATE INDEX `idx_assets_tenant_id` ON `assets` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `automation_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`match_text` text NOT NULL,
	`action` text NOT NULL,
	`enabled` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_automation_rules_tenant_id` ON `automation_rules` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `calendar_settings` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`calendar_id` text NOT NULL,
	`timezone` text NOT NULL,
	`sync_enabled` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`custom_fields` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_tenant_email_unique` ON `clients` (`tenant_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_clients_tenant_id` ON `clients` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `custom_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`applies_to` text NOT NULL,
	`type` text NOT NULL,
	`required` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_custom_fields_tenant_id` ON `custom_fields` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`client_name` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_devices_tenant_id` ON `devices` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `knowledge_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`domain` text NOT NULL,
	`quality_score` integer NOT NULL,
	`uses` integer NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_knowledge_articles_tenant_id` ON `knowledge_articles` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `schema_migrations` (
	`id` text PRIMARY KEY NOT NULL,
	`applied_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sla_configs` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`response_minutes` integer NOT NULL,
	`resolution_minutes` integer NOT NULL,
	`business_start` text NOT NULL,
	`business_end` text NOT NULL,
	`timezone` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `technician_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`specialty` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_technician_groups_tenant_id` ON `technician_groups` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text NOT NULL,
	`region` text NOT NULL,
	`glpi_enabled` integer NOT NULL,
	`oidc_enabled` integer NOT NULL,
	`rustdesk_enabled` integer NOT NULL,
	`demo_data_allowed` integer NOT NULL,
	`require_remote_consent` integer NOT NULL,
	`require_sso` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE TABLE `ticket_settings` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`default_priority` text NOT NULL,
	`default_owner` text NOT NULL,
	`auto_assign` integer NOT NULL,
	`allow_requester_reply` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ticket_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ticket_templates_tenant_id` ON `ticket_templates` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text DEFAULT 'tenant-nexera-pilot' NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`tenant` text NOT NULL,
	`status` text NOT NULL,
	`last_access_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `audit_events` ADD `tenant_id` text DEFAULT 'tenant-nexera-pilot' NOT NULL;--> statement-breakpoint
ALTER TABLE `remote_support_sessions` ADD `tenant_id` text DEFAULT 'tenant-nexera-pilot' NOT NULL;--> statement-breakpoint
ALTER TABLE `security_events` ADD `tenant_id` text DEFAULT 'tenant-nexera-pilot' NOT NULL;--> statement-breakpoint
ALTER TABLE `security_events` ADD `acknowledged_at` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `tenant_id` text DEFAULT 'tenant-nexera-pilot' NOT NULL;--> statement-breakpoint
ALTER TABLE `tickets` ADD `custom_fields` text;