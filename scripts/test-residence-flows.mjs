import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['.env.local', '.env']) if (existsSync(path.join(root, file))) loadEnvFile(path.join(root, file));
const require = createRequire(path.join(root, 'apps/api/package.json'));
require('reflect-metadata');
const { PrismaClient, DocumentType } = require('@prisma/client');
const { ApplicationsService } = require(path.join(root, 'apps/api/dist/applications/applications.service.js'));
const { ResidenceRoomsService } = require(path.join(root, 'apps/api/dist/residence-rooms/residence-rooms.service.js'));
const { MaintenanceService } = require(path.join(root, 'apps/api/dist/maintenance/maintenance.service.js'));
const { UsersService } = require(path.join(root, 'apps/api/dist/users/users.service.js'));
const prisma = new PrismaClient();
const rollback = new Error('Expected test rollback');
let checks = 0;
const before = await prisma.residenceRoom.count();
const rejects = async (operation, pattern) => { await assert.rejects(operation, pattern); checks++; };

try {
  await prisma.$transaction(async tx => {
    const db = new Proxy(tx, { get(target, key) { return key === '$transaction' ? callback => callback(tx) : Reflect.get(target, key); } });
    const audit = { log: async () => undefined };
    const notifications = new Proxy({}, { get: () => async () => undefined });
    const config = { get: () => undefined };
    const rooms = new ResidenceRoomsService(db, audit);
    const applications = new ApplicationsService(db, notifications, audit, config);
    const maintenance = new MaintenanceService(db, notifications, audit, config);
    const users = new UsersService(db, audit, {}, config, { sendTemplate: async () => ({ status: 'SENT' }) });
    const residences = await tx.residence.findMany({ where: { active: true }, include: { roomTypes: true } });
    assert.equal(residences.length, 5);
    const roma = residences.find(residence => residence.slug === 'roma');
    const bot = residences.find(residence => residence.slug === 'botlogile-1');
    const user = await tx.user.create({ data: { email: `rollback-test-${Date.now()}@example.invalid`, firstName: 'Integration', lastName: 'Test', passwordHash: 'not-a-usable-login', roles: { create: { role: { connect: { name: 'STUDENT' } } } }, studentProfile: { create: { profileImageUploadedAt: new Date() } } } });
    async function addDocuments(applicationId) {
      for (const type of [DocumentType.STUDENT_ID_COPY, DocumentType.PROOF_OF_FUNDING, DocumentType.PARENT_ID_COPY, DocumentType.ACCEPTANCE_LETTER, DocumentType.PROOF_OF_REGISTRATION]) {
        await tx.document.create({ data: { applicationId, uploadedById: user.id, type, originalName: 'test-only.txt', storageKey: `test-${applicationId}-${type}`, mimeType: 'text/plain', size: 1, checksum: 'test' } });
      }
    }
    const dto = { residenceId: roma.id, roomTypeId: roma.roomTypes[0].id, roomNumber: 99991, genderAllocation: 'Female' };
    await rejects(() => rooms.create(user.id, { ...dto, roomTypeId: bot.roomTypes[0].id }), /must belong/);
    await rejects(() => rooms.create(user.id, { ...dto, genderAllocation: 'Male' }), /not permitted/);
    const room = await rooms.create(user.id, dto);
    await rejects(() => rooms.create(user.id, dto), /already exists/);
    const payload = { residenceId: roma.id, roomTypeId: roma.roomTypes[0].id, institutionName: 'VUT (Vanderbijlpark)', gender: 'Female',
      isNwuStudent: false, studyYear: 'FIRST YEAR', studySemester: 'FIRST AND SECOND SEMESTER', returningStudent: false, applicantCategory: 'NEW_STUDENT', academicRegistrationStatus: 'REGISTERED',
      applicantFirstName: 'Integration', applicantLastName: 'Test', studentIdNumber: `test-${user.id}`, studentNumber: `test-${user.id}`, studentPhone: '+27110000000', courseName: 'Test course',
      dateOfOccupation: '2027-01-15', nationality: 'South African', postalCode: '1939', paymentTerm: 'Monthly', fundingType: 'Self Funding', guarantorFullName: 'Test Guardian', guarantorCell: '+27110000000', guarantorEmail: 'guardian@example.invalid',
      hasMedicalConditions: false, hasChronicMedication: true, chronicMedicationDetails: 'Integration test only', guardianRelationship: 'Parent', termsAccepted: true, declarationAccepted: true,
      electronicSignatureName: 'Integration Test', electronicSignatureIdPassport: 'test', signatureDataUrl: 'data:image/png;base64,aGVsbG8=' };
    await rejects(() => applications.create(user.id, { ...payload, gender: 'Male' }), /accepts Female/);
    await rejects(() => applications.create(user.id, { ...payload, roomTypeId: bot.roomTypes[0].id }), /does not belong/);
    const application = await applications.create(user.id, payload);
    assert.equal(application.isNwuStudent, false);
    assert.equal(application.hasChronicMedication, true);
    assert.equal(application.residenceId, roma.id);
    await rejects(() => applications.create(user.id, { ...payload, residenceId: bot.id, roomTypeId: bot.roomTypes[0].id }), /Duplicate application/);
    await rejects(() => applications.changeStatus(user.id, application.id, { status: 'APPROVED', roomId: room.id }), /missing required documents/);
    await addDocuments(application.id);
    const wrongRoom = await rooms.create(user.id, { ...dto, residenceId: bot.id, roomTypeId: bot.roomTypes[0].id });
    await rejects(() => applications.changeStatus(user.id, application.id, { status: 'APPROVED', roomId: wrongRoom.id }), /must belong/);
    await applications.changeStatus(user.id, application.id, { status: 'APPROVED', roomId: room.id });
    assert.equal((await tx.residenceRoom.findUnique({ where: { id: room.id } })).status, 'OCCUPIED');
    assert.equal((await tx.residence.findUnique({ where: { id: roma.id } })).availableRooms, roma.availableRooms);
    await rejects(() => rooms.update(user.id, room.id, { status: 'AVAILABLE' }), /allocation workflow/);
    const accepted = await applications.acceptMine(user.id, application.id);
    assert.ok(accepted.acceptedAt);
    assert.equal((await applications.acceptMine(user.id, application.id)).acceptedAt.getTime(), accepted.acceptedAt.getTime());
    const request = await maintenance.create(user.id, { title: 'Test light', description: 'Integration test only', category: 'ELECTRICAL' });
    assert.equal(request.roomTypeId, roma.roomTypes[0].id);
    assert.match(request.location, /^Res Roma/);
    await rejects(() => maintenance.create(user.id, { title: 'Test light', description: 'Integration test only', category: 'ELECTRICAL', roomTypeId: bot.roomTypes[0].id }), /allocated residence/);
    await applications.cancelMine(user.id, application.id);
    assert.equal((await tx.residenceRoom.findUnique({ where: { id: room.id } })).status, 'AVAILABLE');
    assert.equal((await tx.residence.findUnique({ where: { id: roma.id } })).availableRooms, roma.availableRooms + 1);
    await rejects(() => applications.acceptMine(user.id, application.id), /Only approved/);
    const secondRoom = await rooms.create(user.id, { ...dto, roomNumber: 99992 });
    const secondApplication = await applications.create(user.id, payload);
    await addDocuments(secondApplication.id);
    await applications.changeStatus(user.id, secondApplication.id, { status: 'APPROVED', roomId: room.id });
    const beforeMove = await tx.residence.findUnique({ where: { id: roma.id } });
    await applications.changeStatus(user.id, secondApplication.id, { status: 'APPROVED', roomId: secondRoom.id });
    assert.equal((await tx.residenceRoom.findUnique({ where: { id: room.id } })).status, 'AVAILABLE');
    assert.equal((await tx.residenceRoom.findUnique({ where: { id: secondRoom.id } })).status, 'OCCUPIED');
    assert.equal((await tx.residence.findUnique({ where: { id: roma.id } })).availableRooms, beforeMove.availableRooms);
    await tx.application.update({ where: { id: secondApplication.id }, data: { approvalExpiresAt: new Date(Date.now() - 1000) } });
    await applications.listMine(user.id);
    assert.equal((await tx.residenceRoom.findUnique({ where: { id: secondRoom.id } })).status, 'AVAILABLE');
    assert.equal((await tx.application.findUnique({ where: { id: secondApplication.id } })).status, 'CANCELLED');
    const afterExpiry = (await tx.residence.findUnique({ where: { id: roma.id } })).availableRooms;
    await applications.listMine(user.id);
    assert.equal((await tx.residence.findUnique({ where: { id: roma.id } })).availableRooms, afterExpiry);
    const thirdApplication = await applications.create(user.id, payload);
    await addDocuments(thirdApplication.id);
    await applications.changeStatus(user.id, thirdApplication.id, { status: 'APPROVED', roomId: room.id });
    await applications.acceptMine(user.id, thirdApplication.id);
    const terminated = await users.terminateStudent(user.id, user.id, { reason: 'Rollback-only integration test' });
    assert.equal(terminated.status, 'SUSPENDED');
    assert.equal(terminated.isRegistrationBlocked, true);
    assert.equal((await tx.residenceRoom.findUnique({ where: { id: room.id } })).status, 'AVAILABLE');
    assert.equal((await tx.residence.findUnique({ where: { id: roma.id } })).availableRooms, afterExpiry);
    await rejects(() => users.terminateStudent(user.id, user.id, { reason: 'Repeated request' }), /does not have an active accepted stay/);
    checks += 12;
    checks += 10;
    throw rollback;
  }, { timeout: 30000 });
} catch (error) {
  if (error !== rollback) { console.error(error); process.exitCode = 1; }
  else {
    assert.equal(await prisma.residenceRoom.count(), before);
    console.log(`Passed ${checks} live database flow checks. All test changes rolled back; no email sent.`);
  }
} finally {
  await prisma.$disconnect();
}
