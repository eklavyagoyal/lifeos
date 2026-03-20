ALTER TABLE `attachments` ADD `search_text` text;--> statement-breakpoint
ALTER TABLE `attachments` ADD `search_summary` text;--> statement-breakpoint
ALTER TABLE `attachments` ADD `search_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `attachments` ADD `extracted_at` integer;--> statement-breakpoint
CREATE INDEX `idx_attachments_search_status` ON `attachments` (`search_status`);