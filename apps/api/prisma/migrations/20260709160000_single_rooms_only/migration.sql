DO $$
DECLARE
  single_room_type_id UUID;
  inventory_total INTEGER;
  inventory_available INTEGER;
BEGIN
  SELECT "id"
  INTO single_room_type_id
  FROM "RoomType"
  WHERE "room_type_name" = 'Single Room'
  LIMIT 1;

  IF single_room_type_id IS NULL THEN
    single_room_type_id := gen_random_uuid();
    INSERT INTO "RoomType" (
      "id",
      "room_type_name",
      "total_rooms",
      "available_rooms",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      single_room_type_id,
      'Single Room',
      0,
      0,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  END IF;

  UPDATE "Application"
  SET "roomTypeId" = single_room_type_id
  WHERE "roomTypeId" <> single_room_type_id;

  UPDATE "MaintenanceRequest"
  SET "roomTypeId" = single_room_type_id
  WHERE "roomTypeId" IS NOT NULL
    AND "roomTypeId" <> single_room_type_id;

  DELETE FROM "RoomType"
  WHERE "id" <> single_room_type_id;

  UPDATE "ResidenceRoom"
  SET
    "roomTypeName" = 'Single Room',
    "capacity" = 1,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "roomTypeName" <> 'Single Room'
    OR "capacity" <> 1;

  UPDATE "ResidenceRoom" room
  SET
    "status" = 'OCCUPIED',
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE EXISTS (
    SELECT 1
    FROM "Application" application
    WHERE application."roomId" = room."id"
      AND application."status" = 'APPROVED'
  );

  UPDATE "Residence" residence
  SET
    "totalRooms" = inventory.total_rooms,
    "availableRooms" = inventory.available_rooms,
    "updatedAt" = CURRENT_TIMESTAMP
  FROM (
    SELECT
      room."residenceId",
      COUNT(*)::INTEGER AS total_rooms,
      COUNT(*) FILTER (WHERE room."status" = 'AVAILABLE')::INTEGER AS available_rooms
    FROM "ResidenceRoom" room
    GROUP BY room."residenceId"
  ) inventory
  WHERE residence."id" = inventory."residenceId";

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE "status" = 'AVAILABLE')::INTEGER
  INTO inventory_total, inventory_available
  FROM "ResidenceRoom";

  UPDATE "RoomType"
  SET
    "total_rooms" = inventory_total,
    "available_rooms" = inventory_available,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = single_room_type_id;
END $$;
