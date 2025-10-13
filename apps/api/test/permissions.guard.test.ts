import assert from 'node:assert/strict';
import type { ExecutionContext } from '@nestjs/common';
import { Resource, Role } from '@prisma/client';
import { PermissionsGuard } from '../src/permissions/guards/permissions.guard';
import { PermissionsService } from '../src/permissions/permissions.service';
import { RequiredPermission } from '../src/permissions/decorators/require-permissions.decorator';

class ReflectorStub {
  constructor(private requirements: RequiredPermission[] | undefined) {}

  setRequirements(requirements: RequiredPermission[] | undefined) {
    this.requirements = requirements;
  }

  getAllAndOverride<T>(_key: string, _targets: unknown[]): T | undefined {
    return this.requirements as T | undefined;
  }
}

function createExecutionContext(user: unknown): ExecutionContext {
  const handler = () => undefined;
  return {
    getClass: () => PermissionsGuard,
    getHandler: () => handler,
    getType: () => 'http',
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => undefined,
      getNext: () => undefined,
    }),
    switchToRpc: () => ({}),
    switchToWs: () => ({}),
  } as unknown as ExecutionContext;
}

export function runPermissionsGuardTests() {
  const reflector = new ReflectorStub(undefined);
  const guard = new PermissionsGuard(reflector as unknown as any, new PermissionsService());

  const contextWithoutRequirements = createExecutionContext(undefined);
  assert.equal(
    guard.canActivate(contextWithoutRequirements),
    true,
    'guard should allow when no requirements are defined',
  );

  reflector.setRequirements([
    {
      resource: Resource.settings,
      action: 'write',
    },
  ]);

  const contextWithoutUser = createExecutionContext(undefined);
  assert.throws(
    () => guard.canActivate(contextWithoutUser),
    /권한이 없습니다/,
    'guard should block when user is missing',
  );

  const contextWithoutPrivilege = createExecutionContext({
    permissions: new PermissionsService().getDefaultPermissions(Role.viewer),
  });

  assert.throws(
    () => guard.canActivate(contextWithoutPrivilege),
    /권한이 없습니다/,
    'guard should block when user lacks permission',
  );

  const contextWithPermission = createExecutionContext({
    permissions: [
      {
        resource: Resource.settings,
        read: true,
        write: true,
      },
    ],
  });

  assert.equal(
    guard.canActivate(contextWithPermission),
    true,
    'guard should allow when permission is present',
  );
}
