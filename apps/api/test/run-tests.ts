import assert from 'node:assert/strict';
import { ProductStatus } from '@prisma/client';
import { calculateRemain, resolveProductStatus } from '../src/products/utils/product-stock.util';
import { runDashboardTotalsTests } from './dashboard-totals.test';
import { runTelegramSettingsMapperTests } from './telegram-settings.mapper.test';
import { runTestAlertUtilTests } from './test-alert.util.test';
import { runQuietHoursUtilTests } from './quiet-hours.util.test';
import { runTelegramServiceTests } from './telegram.service.test';
import { runPermissionsServiceTests } from './permissions.service.test';
import { runPermissionsGuardTests } from './permissions.guard.test';
import { runE2eTests } from './e2e/app.e2e-tests';

function testCalculateRemain() {
  const remain = calculateRemain(100, 30, 10);
  assert.equal(remain, 80, 'remain should sum inbound and returns minus outbound');
}

function testResolveStatusWhenRemainLow() {
  const status = resolveProductStatus(-1, 10);
  assert.equal(status, ProductStatus.low, 'negative remain should be low');
}

function testResolveStatusWhenSafetyStockZero() {
  const status = resolveProductStatus(5, 0);
  assert.equal(status, ProductStatus.normal, 'no safety stock should keep normal status');
}

function testResolveStatusWarnThreshold() {
  const status = resolveProductStatus(11, 10);
  assert.equal(status, ProductStatus.warn, 'remain just above safety stock should be warn');
}

function testResolveStatusNormalAboveThreshold() {
  const status = resolveProductStatus(25, 10);
  assert.equal(status, ProductStatus.normal, 'remain above warn threshold should be normal');
}

async function runUnitTests() {
  testCalculateRemain();
  testResolveStatusWhenRemainLow();
  testResolveStatusWhenSafetyStockZero();
  testResolveStatusWarnThreshold();
  testResolveStatusNormalAboveThreshold();
  runDashboardTotalsTests();
  runTelegramSettingsMapperTests();
  runTestAlertUtilTests();
  runQuietHoursUtilTests();
  await runTelegramServiceTests();
  runPermissionsServiceTests();
  runPermissionsGuardTests();
}

async function main() {
  await runUnitTests();
  await runE2eTests();
}

main()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('All tests passed');
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
