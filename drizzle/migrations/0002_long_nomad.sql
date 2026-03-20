CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`target_date` text,
	`completed_at` integer,
	`progress` integer DEFAULT 0,
	`sort_order` real DEFAULT 0,
	`project_id` text,
	`task_id` text,
	`habit_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_milestones_goal` ON `milestones` (`goal_id`);--> statement-breakpoint
CREATE INDEX `idx_milestones_status` ON `milestones` (`status`);--> statement-breakpoint
CREATE INDEX `idx_milestones_project` ON `milestones` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_milestones_task` ON `milestones` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_milestones_habit` ON `milestones` (`habit_id`);--> statement-breakpoint
ALTER TABLE `projects` ADD `goal_id` text REFERENCES goals(id);--> statement-breakpoint
CREATE INDEX `idx_projects_goal` ON `projects` (`goal_id`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `goal_id` text REFERENCES goals(id);--> statement-breakpoint
CREATE INDEX `idx_tasks_goal` ON `tasks` (`goal_id`);