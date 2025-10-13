import assert from 'node:assert/strict';
import {
  getNextQuietHoursExit,
  isWithinQuietHours,
  parseQuietHoursWindow,
} from '../src/alerts/utils/quiet-hours.util';

export function runQuietHoursUtilTests() {
  const window = parseQuietHoursWindow('22-07');
  assert.equal(window.startHour, 22);
  assert.equal(window.endHour, 7);

  const base = new Date(2024, 3, 29); // local time reference
  const evening = new Date(base);
  evening.setHours(23, 0, 0, 0);
  const morning = new Date(base);
  morning.setHours(6, 0, 0, 0);
  const afternoon = new Date(base);
  afternoon.setHours(15, 0, 0, 0);

  assert.equal(isWithinQuietHours(evening, window), true);
  assert.equal(isWithinQuietHours(morning, window), true);
  assert.equal(isWithinQuietHours(afternoon, window), false);

  const exit = getNextQuietHoursExit(evening, window);
  assert.equal(exit.getHours(), 7);
}
