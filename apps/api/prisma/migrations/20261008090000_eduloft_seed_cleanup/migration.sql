-- Remove historical sample residence inventory from fresh databases after the Eduloft rebrand.
-- The guarded deletes only remove the known legacy seed rows when no operational records reference them.

DELETE FROM "ResidenceRoom" room
WHERE room."residenceId" IN (
  '11111111-1111-4111-8111-111111111101',
  '11111111-1111-4111-8111-111111111102'
)
AND NOT EXISTS (SELECT 1 FROM "Application" app WHERE app."roomId" = room."id")
AND NOT EXISTS (SELECT 1 FROM "StorageRequest" storage WHERE storage."roomId" = room."id")
AND NOT EXISTS (SELECT 1 FROM "VisitorLog" visitor WHERE visitor."roomId" = room."id")
AND NOT EXISTS (SELECT 1 FROM "VisitorPreRegistration" prereg WHERE prereg."roomId" = room."id")
AND NOT EXISTS (SELECT 1 FROM "Inspection" inspection WHERE inspection."roomId" = room."id");

DELETE FROM "Residence" residence
WHERE residence."id" IN (
  '11111111-1111-4111-8111-111111111101',
  '11111111-1111-4111-8111-111111111102'
)
AND NOT EXISTS (SELECT 1 FROM "Application" app WHERE app."residenceId" = residence."id")
AND NOT EXISTS (SELECT 1 FROM "Communication" communication WHERE communication."residenceId" = residence."id")
AND NOT EXISTS (SELECT 1 FROM "StorageRequest" storage WHERE storage."residenceId" = residence."id")
AND NOT EXISTS (SELECT 1 FROM "Inspection" inspection WHERE inspection."residenceId" = residence."id")
AND NOT EXISTS (SELECT 1 FROM "VisitorLog" visitor WHERE visitor."residenceId" = residence."id")
AND NOT EXISTS (SELECT 1 FROM "VisitorPreRegistration" prereg WHERE prereg."residenceId" = residence."id")
AND NOT EXISTS (SELECT 1 FROM "IncidentReport" incident WHERE incident."residenceId" = residence."id");

DELETE FROM "RoomType" room_type
WHERE room_type."room_type_name" = 'Single Room'
AND NOT EXISTS (SELECT 1 FROM "Application" app WHERE app."roomTypeId" = room_type."id")
AND NOT EXISTS (SELECT 1 FROM "MaintenanceRequest" maintenance WHERE maintenance."roomTypeId" = room_type."id");
