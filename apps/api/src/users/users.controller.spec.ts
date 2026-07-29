import 'reflect-metadata';
import { RoleName } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { UsersController } from './users.controller';

describe('UsersController permissions', () => {
  it('keeps stay termination and whitelist actions administrator-only', () => {
    const terminateRoles = Reflect.getMetadata(ROLES_KEY, UsersController.prototype.terminateStudent);
    const whitelistRoles = Reflect.getMetadata(ROLES_KEY, UsersController.prototype.whitelistStudent);

    expect(terminateRoles).toEqual([RoleName.ADMINISTRATOR]);
    expect(whitelistRoles).toEqual([RoleName.ADMINISTRATOR]);
  });
});
