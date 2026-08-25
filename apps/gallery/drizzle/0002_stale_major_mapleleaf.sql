ALTER TABLE `google_drive_sources` RENAME COLUMN `userId` TO `ownerKey`;--> statement-breakpoint
ALTER TABLE `google_drive_sources` DROP INDEX `google_drive_sources_user_account_unique`;--> statement-breakpoint
ALTER TABLE `google_drive_sources` MODIFY COLUMN `ownerKey` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `google_drive_sources` ADD CONSTRAINT `google_drive_sources_owner_account_unique` UNIQUE(`ownerKey`,`providerAccountId`);