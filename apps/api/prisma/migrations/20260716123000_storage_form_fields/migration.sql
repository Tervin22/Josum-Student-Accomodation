ALTER TABLE "StorageRequest"
  ADD COLUMN "studentFullName" TEXT,
  ADD COLUMN "studentNumber" TEXT,
  ADD COLUMN "studentSignature" TEXT,
  ADD COLUMN "studentRoomNumber" TEXT,
  ADD COLUMN "numberOfItemsStored" INTEGER,
  ADD COLUMN "storageSite" TEXT,
  ADD COLUMN "storageNoticeAccepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "managementSignature" TEXT;

CREATE INDEX "StorageRequest_studentNumber_idx" ON "StorageRequest"("studentNumber");
CREATE INDEX "StorageRequest_storageSite_idx" ON "StorageRequest"("storageSite");
