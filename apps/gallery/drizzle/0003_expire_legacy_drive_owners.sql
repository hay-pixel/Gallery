-- There is no accepted production PixelDrive account mapping. Numeric legacy
-- owners cannot be safely assigned to new signed Gallery sessions. Remove the
-- encrypted credentials explicitly so they are neither orphaned nor exposed;
-- affected pre-production users must reconnect through a Gallery session.
DELETE FROM `google_drive_sources` WHERE `ownerKey` REGEXP '^[0-9]+$';
