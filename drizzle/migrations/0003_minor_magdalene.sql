CREATE TABLE `attachment_links` (
	`id` text PRIMARY KEY NOT NULL,
	`attachment_id` text NOT NULL,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	`label` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_attachment_links_item` ON `attachment_links` (`item_type`,`item_id`);--> statement-breakpoint
CREATE INDEX `idx_attachment_links_attachment` ON `attachment_links` (`attachment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_attachment_links_unique` ON `attachment_links` (`attachment_id`,`item_type`,`item_id`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`original_name` text NOT NULL,
	`storage_path` text NOT NULL,
	`mime_type` text,
	`file_extension` text,
	`file_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`source_type` text DEFAULT 'upload' NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_attachments_storage_path` ON `attachments` (`storage_path`);--> statement-breakpoint
CREATE INDEX `idx_attachments_sha256` ON `attachments` (`sha256`);--> statement-breakpoint
CREATE INDEX `idx_attachments_source_type` ON `attachments` (`source_type`);--> statement-breakpoint
CREATE TABLE `import_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`import_type` text NOT NULL,
	`source_path` text NOT NULL,
	`source_label` text,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`summary` text,
	`warnings` text,
	`stats` text,
	`details` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_import_runs_type` ON `import_runs` (`import_type`);--> statement-breakpoint
CREATE INDEX `idx_import_runs_status` ON `import_runs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_import_runs_created` ON `import_runs` (`created_at`);--> statement-breakpoint
CREATE TABLE `imported_records` (
	`id` text PRIMARY KEY NOT NULL,
	`import_run_id` text,
	`import_type` text NOT NULL,
	`source_record_key` text NOT NULL,
	`source_checksum` text,
	`source_label` text,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`import_run_id`) REFERENCES `import_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_imported_records_unique` ON `imported_records` (`import_type`,`source_record_key`);--> statement-breakpoint
CREATE INDEX `idx_imported_records_item` ON `imported_records` (`item_type`,`item_id`);--> statement-breakpoint
CREATE INDEX `idx_imported_records_run` ON `imported_records` (`import_run_id`);