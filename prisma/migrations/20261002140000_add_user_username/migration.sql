ALTER TABLE `User` ADD COLUMN `username` VARCHAR(191) NULL;

UPDATE `User`
SET `username` = CONCAT('user', `id`)
WHERE `username` IS NULL OR `username` = '';

ALTER TABLE `User` MODIFY `username` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX `User_username_key` ON `User`(`username`);
