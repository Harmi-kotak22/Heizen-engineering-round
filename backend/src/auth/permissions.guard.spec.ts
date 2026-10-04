import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './auth.types.js';
import { REQUIRED_PERMISSIONS_KEY } from './permissions.decorator.js';
import { PermissionsGuard } from './permissions.guard.js';

describe('PermissionsGuard', () => {
  const handler = () => undefined;

  function createContext(userPermissions: string[]): ExecutionContext {
    const request = {
      user: { permissions: userPermissions },
    } as AuthenticatedRequest;

    return {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  }

  beforeEach(() => {
    Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, ['orders.read'], handler);
  });

  it('allows users with the required permission', () => {
    const guard = new PermissionsGuard(new Reflector());

    expect(guard.canActivate(createContext(['orders.read']))).toBe(true);
  });

  it('denies users without the required permission', () => {
    const guard = new PermissionsGuard(new Reflector());

    expect(() => guard.canActivate(createContext(['orders.create']))).toThrow(
      ForbiddenException,
    );
  });
});
