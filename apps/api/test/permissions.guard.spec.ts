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

describe('PermissionsGuard', () => {
  let reflector: ReflectorStub;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = new ReflectorStub(undefined);
    guard = new PermissionsGuard(reflector as unknown as any, new PermissionsService());
  });

  it('should allow when no requirements are defined', () => {
    const context = createExecutionContext(undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject when user is missing', () => {
    reflector.setRequirements([
      {
        resource: Resource.settings,
        action: 'write',
      },
    ]);

    const context = createExecutionContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(/권한이 없습니다/);
  });

  it('should reject when user lacks permission', () => {
    reflector.setRequirements([
      {
        resource: Resource.settings,
        action: 'write',
      },
    ]);

    const context = createExecutionContext({
      permissions: new PermissionsService().getDefaultPermissions(Role.viewer),
    });

    expect(() => guard.canActivate(context)).toThrow(/권한이 없습니다/);
  });

  it('should allow when permission is present', () => {
    reflector.setRequirements([
      {
        resource: Resource.settings,
        action: 'write',
      },
    ]);

    const context = createExecutionContext({
      permissions: [
        {
          resource: Resource.settings,
          read: true,
          write: true,
        },
      ],
    });

    expect(guard.canActivate(context)).toBe(true);
  });
});
