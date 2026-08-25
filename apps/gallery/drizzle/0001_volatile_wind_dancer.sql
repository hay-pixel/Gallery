CREATE TABLE `google_drive_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`providerAccountId` varchar(255) NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`email` varchar(320),
	`refreshTokenEncrypted` text NOT NULL,
	`grantedScopes` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastIndexedAt` timestamp,
	CONSTRAINT `google_drive_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `google_drive_sources_user_account_unique` UNIQUE(`userId`,`providerAccountId`)
);
