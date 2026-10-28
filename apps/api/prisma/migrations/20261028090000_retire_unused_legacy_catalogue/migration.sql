-- Remove only unused catalogue records recreated by historical migrations.
-- Existing operational references prevent deletion on installations with history.
DELETE FROM "ResidenceRoom" r USING "Residence" residence
WHERE r."residenceId" = residence.id AND residence.active = false
  AND residence.name IN ('Josum 1', 'Josum 2', 'Eduloft Centurion')
  AND NOT EXISTS (SELECT 1 FROM "Application" a WHERE a."roomId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "StorageRequest" s WHERE s."roomId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "Inspection" i WHERE i."roomId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "VisitorLog" v WHERE v."roomId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "VisitorPreRegistration" v WHERE v."roomId" = r.id);

DELETE FROM "RoomType" category
WHERE category."residenceId" IS NULL
  AND category.room_type_name IN ('Single Room', 'Eduloft room categories')
  AND NOT EXISTS (SELECT 1 FROM "Application" a WHERE a."roomTypeId" = category.id)
  AND NOT EXISTS (SELECT 1 FROM "MaintenanceRequest" m WHERE m."roomTypeId" = category.id)
  AND NOT EXISTS (SELECT 1 FROM "ResidenceRoom" r WHERE r."roomTypeName" = category.room_type_name);

DELETE FROM "Residence" r
WHERE r.active = false AND r.name IN ('Josum 1', 'Josum 2', 'Eduloft Centurion')
  AND NOT EXISTS (SELECT 1 FROM "ResidenceRoom" room WHERE room."residenceId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "RoomType" category WHERE category."residenceId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "Application" a WHERE a."residenceId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "StorageRequest" s WHERE s."residenceId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "Communication" c WHERE c."residenceId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "Inspection" i WHERE i."residenceId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "VisitorLog" v WHERE v."residenceId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "VisitorPreRegistration" v WHERE v."residenceId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "IncidentReport" i WHERE i."residenceId" = r.id);
