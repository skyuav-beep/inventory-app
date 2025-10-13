import assert from 'node:assert/strict';
import { buildTestAlertMessage } from '../src/alerts/utils/test-alert.util';

export function runTestAlertUtilTests() {
  const message = buildTestAlertMessage('Tester');

  assert.ok(message.includes('Tester'));
  assert.ok(message.startsWith('[TEST]'));
  assert.ok(message.includes('requested by'));
  assert.ok(message.includes('at'));
}
