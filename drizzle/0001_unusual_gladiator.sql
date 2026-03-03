CREATE TABLE `accuracy_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`period` enum('DAILY','WEEKLY','MONTHLY') NOT NULL,
	`periodDate` timestamp NOT NULL,
	`totalPredictions` int DEFAULT 0,
	`accuratePredictions` int DEFAULT 0,
	`accuracy` decimal(5,4),
	`averageConfidence` decimal(5,4),
	`averageProbability` decimal(5,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accuracy_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`service` varchar(64) NOT NULL,
	`endpoint` varchar(256) NOT NULL,
	`method` varchar(16) NOT NULL,
	`statusCode` int,
	`responseTime` int,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `market_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`marketId` int NOT NULL,
	`timestamp` timestamp NOT NULL,
	`prices` json NOT NULL,
	`volume24h` decimal(20,8),
	`momentum` decimal(10,6),
	`volatility` decimal(10,6),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `markets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`polymarketId` varchar(256) NOT NULL,
	`eventId` varchar(256) NOT NULL,
	`eventName` text NOT NULL,
	`marketName` text NOT NULL,
	`outcomes` json NOT NULL,
	`conditionId` varchar(256) NOT NULL,
	`enableOrderBook` boolean DEFAULT true,
	`active` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `markets_id` PRIMARY KEY(`id`),
	CONSTRAINT `markets_polymarketId_unique` UNIQUE(`polymarketId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`marketId` int,
	`type` enum('THRESHOLD_CROSSED','MOVEMENT_DETECTED','PREDICTION_RESOLVED','ACCURACY_UPDATE') NOT NULL,
	`title` varchar(256) NOT NULL,
	`message` text NOT NULL,
	`severity` enum('INFO','WARNING','ALERT') DEFAULT 'INFO',
	`isRead` boolean DEFAULT false,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`marketId` int NOT NULL,
	`polymarketId` varchar(256) NOT NULL,
	`predictedOutcome` varchar(64) NOT NULL,
	`predictedProbability` decimal(5,4) NOT NULL,
	`confidence` decimal(5,4) NOT NULL,
	`signals` json NOT NULL,
	`signalWeights` json NOT NULL,
	`actualOutcome` varchar(64),
	`isAccurate` boolean,
	`marketResolved` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `predictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_config_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `watchlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`marketId` int NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `watchlist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `period_idx` ON `accuracy_metrics` (`period`);--> statement-breakpoint
CREATE INDEX `periodDate_idx` ON `accuracy_metrics` (`periodDate`);--> statement-breakpoint
CREATE INDEX `service_idx` ON `api_logs` (`service`);--> statement-breakpoint
CREATE INDEX `createdAt_idx` ON `api_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `marketId_idx` ON `market_snapshots` (`marketId`);--> statement-breakpoint
CREATE INDEX `timestamp_idx` ON `market_snapshots` (`timestamp`);--> statement-breakpoint
CREATE INDEX `polymarketId_idx` ON `markets` (`polymarketId`);--> statement-breakpoint
CREATE INDEX `eventId_idx` ON `markets` (`eventId`);--> statement-breakpoint
CREATE INDEX `active_idx` ON `markets` (`active`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `marketId_idx` ON `notifications` (`marketId`);--> statement-breakpoint
CREATE INDEX `isRead_idx` ON `notifications` (`isRead`);--> statement-breakpoint
CREATE INDEX `marketId_idx` ON `predictions` (`marketId`);--> statement-breakpoint
CREATE INDEX `polymarketId_idx` ON `predictions` (`polymarketId`);--> statement-breakpoint
CREATE INDEX `createdAt_idx` ON `predictions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `watchlist` (`userId`);--> statement-breakpoint
CREATE INDEX `marketId_idx` ON `watchlist` (`marketId`);