WITH approved_counts AS (
  SELECT "roomTypeId", COUNT(*)::int AS approved_count
  FROM "Application"
  WHERE "status" = 'APPROVED'
  GROUP BY "roomTypeId"
),
room_counts AS (
  SELECT "RoomType"."id", COALESCE(approved_counts.approved_count, 0) AS approved_count
  FROM "RoomType"
  LEFT JOIN approved_counts ON approved_counts."roomTypeId" = "RoomType"."id"
)
UPDATE "RoomType"
SET "total_rooms" = room_counts.approved_count,
    "available_rooms" = 0
FROM room_counts
WHERE "RoomType"."id" = room_counts."id";
