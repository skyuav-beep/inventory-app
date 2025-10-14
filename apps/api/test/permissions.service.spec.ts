import { Resource, Role } from '@prisma/client';
import { PermissionsService } from '../src/permissions/permissions.service';

describe('PermissionsService', () => {
  let service: PermissionsService;

  beforeEach(() => {
    service = new PermissionsService();
  });

  it('should grant full write access for admin defaults', () => {
    const permissions = service.getDefaultPermissions(Role.admin);

    expect(permissions.every((permission) => permission.write)).toBe(true);
  });

  it('should restrict viewers to read-only access', () => {
    const permissions = service.getDefaultPermissions(Role.viewer);

    expect(permissions.every((permission) => permission.read && !permission.write)).toBe(true);
  });

  it('should merge overrides with operator defaults', () => {
    const merged = service.mergeWithDefaults(
      [
        {
          resource: Resource.dashboard,
          read: false,
          write: false,
        },
      ],
      Role.operator,
    );

    expect(merged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resource: Resource.dashboard,
          read: false,
          write: false,
        }),
        expect.objectContaining({
          resource: Resource.returns,
          read: true,
          write: true,
        }),
      ]),
    );
  });

  it('should build create input combining overrides and defaults', () => {
    const createInput = service.buildCreateInput(
      [
        {
          resource: Resource.settings,
          read: true,
          write: false,
        },
      ],
      Role.operator,
    );

    expect(createInput).toEqual([
      { resource: Resource.dashboard, read: true, write: false },
      { resource: Resource.products, read: true, write: true },
      { resource: Resource.inbounds, read: true, write: true },
      { resource: Resource.outbounds, read: true, write: true },
      { resource: Resource.returns, read: true, write: true },
      { resource: Resource.settings, read: true, write: false },
    ]);
  });

  it('should evaluate permissions correctly', () => {
    const permissions = service.mergeWithDefaults(
      [
        {
          resource: Resource.settings,
          read: true,
          write: false,
        },
      ],
      Role.operator,
    );

    expect(service.hasPermission(permissions, Resource.settings, 'read')).toBe(true);
    expect(service.hasPermission(permissions, Resource.settings, 'write')).toBe(false);
  });
});
