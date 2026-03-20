CREATE TABLE `job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`run_key` text NOT NULL,
	`status` text NOT NULL,
	`summary` text,
	`details` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `scheduled_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_job_runs_run_key` ON `job_runs` (`run_key`);--> statement-breakpoint
CREATE INDEX `idx_job_runs_job` ON `job_runs` (`job_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_job_runs_status` ON `job_runs` (`status`);--> statement-breakpoint
CREATE TABLE `scheduled_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_key` text NOT NULL,
	`job_type` text NOT NULL,
	`subject_type` text,
	`subject_id` text,
	`cadence` text,
	`next_run_at` integer,
	`last_run_at` integer,
	`last_success_at` integer,
	`last_error` text,
	`metadata` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_scheduled_jobs_key` ON `scheduled_jobs` (`job_key`);--> statement-breakpoint
CREATE INDEX `idx_scheduled_jobs_due` ON `scheduled_jobs` (`is_active`,`next_run_at`);--> statement-breakpoint
CREATE INDEX `idx_scheduled_jobs_type` ON `scheduled_jobs` (`job_type`);--> statement-breakpoint
CREATE INDEX `idx_scheduled_jobs_subject` ON `scheduled_jobs` (`subject_type`,`subject_id`);