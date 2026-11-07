CREATE TABLE `assets` (
	`assetId` varchar(71) NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`sizeBytes` bigint NOT NULL,
	`primaryCategory` varchar(64) NOT NULL,
	`subcategory` varchar(64),
	`userNotes` text,
	`reviewState` enum('NEEDS_REVIEW','APPROVED','SKIPPED') NOT NULL DEFAULT 'NEEDS_REVIEW',
	`reviewEvidence` text,
	`preferredOccurrenceId` varchar(128),
	`duplicateGroupId` varchar(128),
	`isPreferredCopy` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assets_assetId` PRIMARY KEY(`assetId`)
);
--> statement-breakpoint
CREATE TABLE `background_jobs` (
	`id` varchar(64) NOT NULL,
	`ownerKey` varchar(64) NOT NULL,
	`type` enum('scan','hash_verify','analysis','indexing') NOT NULL,
	`status` enum('QUEUED','RUNNING','COMPLETED','FAILED') NOT NULL,
	`progressPercent` int NOT NULL DEFAULT 0,
	`processedCount` int NOT NULL DEFAULT 0,
	`totalCount` int NOT NULL DEFAULT 0,
	`detail` text,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `background_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `source_occurrences` (
	`sourceOccurrenceId` varchar(128) NOT NULL,
	`assetId` varchar(71) NOT NULL,
	`sourceId` int NOT NULL,
	`originalPath` text NOT NULL,
	`providerFileId` varchar(255),
	`archiveLocation` text,
	`sourceMember` text,
	`observedSizeBytes` bigint NOT NULL,
	`observedModifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `source_occurrences_sourceOccurrenceId` PRIMARY KEY(`sourceOccurrenceId`)
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerKey` varchar(64) NOT NULL,
	`kind` enum('google_drive','local_folder','extract_export') NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`configJson` text NOT NULL,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sources_id` PRIMARY KEY(`id`)
);
