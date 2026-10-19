BEGIN;

-- Keep applied migration history intact and restore the original inventory forward.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Application" WHERE "residenceId" = '22222222-2222-4222-8222-222222222201'
    UNION ALL SELECT 1 FROM "Communication" WHERE "residenceId" = '22222222-2222-4222-8222-222222222201'
    UNION ALL SELECT 1 FROM "StorageRequest" WHERE "residenceId" = '22222222-2222-4222-8222-222222222201'
    UNION ALL SELECT 1 FROM "Inspection" WHERE "residenceId" = '22222222-2222-4222-8222-222222222201'
    UNION ALL SELECT 1 FROM "VisitorLog" WHERE "residenceId" = '22222222-2222-4222-8222-222222222201'
    UNION ALL SELECT 1 FROM "VisitorPreRegistration" WHERE "residenceId" = '22222222-2222-4222-8222-222222222201'
    UNION ALL SELECT 1 FROM "IncidentReport" WHERE "residenceId" = '22222222-2222-4222-8222-222222222201'
    UNION ALL SELECT 1 FROM "Application" app JOIN "ResidenceRoom" room ON room.id = app."roomId"
      WHERE room."residenceId" = '22222222-2222-4222-8222-222222222201'
    UNION ALL SELECT 1 FROM "StorageRequest" storage JOIN "ResidenceRoom" room ON room.id = storage."roomId"
      WHERE room."residenceId" = '22222222-2222-4222-8222-222222222201'
    UNION ALL SELECT 1 FROM "Inspection" inspection JOIN "ResidenceRoom" room ON room.id = inspection."roomId"
      WHERE room."residenceId" = '22222222-2222-4222-8222-222222222201'
    UNION ALL SELECT 1 FROM "VisitorLog" visitor JOIN "ResidenceRoom" room ON room.id = visitor."roomId"
      WHERE room."residenceId" = '22222222-2222-4222-8222-222222222201'
    UNION ALL SELECT 1 FROM "VisitorPreRegistration" visitor JOIN "ResidenceRoom" room ON room.id = visitor."roomId"
      WHERE room."residenceId" = '22222222-2222-4222-8222-222222222201'
  ) THEN
    RAISE EXCEPTION 'Eduloft operational records exist. Export and reconcile these allocations before restoring the original residences.';
  END IF;
END $$;

DELETE FROM "Residence" WHERE "id" = '22222222-2222-4222-8222-222222222201';

INSERT INTO "Residence" (
  "id", "name", "address", "residenceType", "totalRooms", "availableRooms", "description",
  "facilities", "amenities", "distanceToNWU", "distanceToShoppingCentre"
)
VALUES
(
  '11111111-1111-4111-8111-111111111101', 'Josum 1',
  '50 Cassandra Avenue, Bedworth Park, Vereeniging', 'Mixed - boys and girls', 78, 78,
  'A welcoming mixed residence with furnished single rooms, dedicated study areas, communal living spaces, and reliable support services.',
  ARRAY['4 communal bathrooms', '3 communal kitchens', '2 TV rooms', '1 laundry room', '1 study room'],
  ARRAY['Backup power supply', 'Backup power for Wi-Fi', 'Fully equipped gas stoves', 'Cleaning and caretaking staff', 'Complimentary shuttle service for residents', 'Study lounges and quiet areas', 'Backup water supply', 'Unlimited hot water with gas-powered geysers', 'On-site laundry facilities', 'Reliable 24-hour security', 'Fully furnished rooms', 'Recreational spaces', 'Regular social events and activities'],
  3.6, 0.6
),
(
  '11111111-1111-4111-8111-111111111102', 'Josum 2',
  '3 Ganymede Avenue, Bedworth Park, Vereeniging', 'Girls only', 120, 120,
  'A secure girls-only residence with furnished single rooms, generous shared facilities, quiet study areas, and a multipurpose community space.',
  ARRAY['4 communal bathrooms', '4 communal kitchens', '2 TV rooms', '1 laundry room', '1 study room', '1 multipurpose room'],
  ARRAY['Backup power supply', 'Backup power for Wi-Fi', 'Fully equipped gas stoves', 'Cleaning and caretaking staff', 'Complimentary shuttle service for residents', 'Study lounges and quiet areas', 'Backup water supply', 'Unlimited hot water with gas-powered geysers', 'On-site laundry facilities', 'Reliable 24-hour security', 'Fully furnished rooms', 'Recreational spaces', 'Regular social events and activities'],
  3.1, 0.95
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "address" = EXCLUDED."address", "residenceType" = EXCLUDED."residenceType",
  "description" = EXCLUDED."description", "facilities" = EXCLUDED."facilities", "amenities" = EXCLUDED."amenities",
  "distanceToNWU" = EXCLUDED."distanceToNWU", "distanceToShoppingCentre" = EXCLUDED."distanceToShoppingCentre",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ResidenceRoom" ("id", "residenceId", "roomNumber", "name", "genderAllocation", "roomTypeName", "capacity")
SELECT gen_random_uuid(), residence."id", room_number, 'Room ' || room_number,
  CASE WHEN residence."name" = 'Josum 2' OR room_number <= 50 THEN 'Female' ELSE 'Male' END,
  'Single Room', 1
FROM "Residence" residence
CROSS JOIN LATERAL generate_series(1, CASE WHEN residence."name" = 'Josum 1' THEN 78 ELSE 120 END) room_number
WHERE residence."id" IN ('11111111-1111-4111-8111-111111111101', '11111111-1111-4111-8111-111111111102')
ON CONFLICT ("residenceId", "roomNumber") DO UPDATE SET
  "name" = EXCLUDED."name", "genderAllocation" = EXCLUDED."genderAllocation",
  "roomTypeName" = 'Single Room', "capacity" = 1, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RoomType" ("id", "room_type_name", "total_rooms", "available_rooms", "updatedAt")
VALUES (gen_random_uuid(), 'Single Room', 0, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("room_type_name") DO NOTHING;

UPDATE "Application" SET "roomTypeId" = (SELECT "id" FROM "RoomType" WHERE "room_type_name" = 'Single Room')
WHERE "residenceId" IN ('11111111-1111-4111-8111-111111111101', '11111111-1111-4111-8111-111111111102');

DELETE FROM "RoomType" category
WHERE category."room_type_name" IN ('The Nook - 1 bed, 1 bath', 'The Studio - 2 bed, 1 bath', 'The Quarter - 1 bed, 1 bath', 'The Loft - 1 bed, 1 bath')
  AND NOT EXISTS (SELECT 1 FROM "Application" WHERE "roomTypeId" = category."id")
  AND NOT EXISTS (SELECT 1 FROM "MaintenanceRequest" WHERE "roomTypeId" = category."id");

UPDATE "ResidenceRoom" room SET "status" = 'OCCUPIED', "updatedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Application" WHERE "roomId" = room."id" AND "status" = 'APPROVED');

UPDATE "Residence" residence SET
  "totalRooms" = inventory.total, "availableRooms" = inventory.available, "updatedAt" = CURRENT_TIMESTAMP
FROM (
  SELECT "residenceId", COUNT(*)::INTEGER AS total,
    COUNT(*) FILTER (WHERE "status" = 'AVAILABLE')::INTEGER AS available
  FROM "ResidenceRoom" GROUP BY "residenceId"
) inventory
WHERE residence."id" = inventory."residenceId";

UPDATE "RoomType" SET
  "total_rooms" = (SELECT COUNT(*)::INTEGER FROM "ResidenceRoom" WHERE "roomTypeName" = 'Single Room'),
  "available_rooms" = (SELECT COUNT(*)::INTEGER FROM "ResidenceRoom" WHERE "roomTypeName" = 'Single Room' AND "status" = 'AVAILABLE'),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "room_type_name" = 'Single Room';

ALTER TABLE "PaymentReminder" ALTER COLUMN "amountCents" SET DEFAULT 510000;

COMMIT;
