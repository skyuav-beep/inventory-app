import assert from 'node:assert/strict';
import { Resource, Role } from '@prisma/client';
import { PermissionsService } from '../src/permissions/permissions.service';

export function runPermissionsServiceTests() {
  const service = new PermissionsService();

  const adminDefaults = service.getDefaultPermissions(Role.admin);
  assert.ok(
    adminDefaults.every((permission) => permission.write),
    'admin should have write permission on every resource',
  );

  const viewerDefaults = service.getDefaultPermissions(Role.viewer);
  assert.ok(
    viewerDefaults.every((permission) => permission.read && !permission.write),
    'viewer should only have read permissions',
  );

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

  const dashboardPermission = merged.find(
    (permission) => permission.resource === Resource.dashboard,
  );
  assert.deepEqual(dashboardPermission, {
    resource: Resource.dashboard,
    read: false,
    write: false,
  });

  const returnsPermission = merged.find(
    (permission) => permission.resource === Resource.returns,
  );
  assert.deepEqual(returnsPermission, {
    resource: Resource.returns,
    read: true,
    write: true,
  });

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

  assert.deepEqual(createInput, [
    {
      resource: Resource.dashboard,
      read: true,
      write: false,
    },
    {
      resource: Resource.products,
      read: true,
      write: true,
    },
    {
      resource: Resource.inbounds,
      read: true,
      write: true,
    },
    {
      resource: Resource.outbounds,
      read: true,
      write: true,
    },
    {
      resource: Resource.returns,
      read: true,
      write: true,
    },
    {
      resource: Resource.settings,
      read: true,
      write: false,
    },
  ]);

  assert.equal(
    service.hasPermission(createInput, Resource.settings, 'read'),
    true,
  );
  assert.equal(
    service.hasPermission(createInput, Resource.settings, 'write'),
    false,
  );
}

