import {
  getNextQuietHoursExit,
  isWithinQuietHours,
  parseQuietHoursWindow,
} from '../src/alerts/utils/quiet-hours.util';

describe('quiet hours utils', () => {
  it('should parse quiet hours range', () => {
    const window = parseQuietHoursWindow('22-07');

    expect(window).toEqual({ startHour: 22, endHour: 7 });
  });

  it('should identify whether time is within quiet hours', () => {
    const window = parseQuietHoursWindow('22-07');
    const base = new Date(2024, 3, 29);

    const evening = new Date(base);
    evening.setHours(23, 0, 0, 0);
    const morning = new Date(base);
    morning.setHours(6, 0, 0, 0);
    const afternoon = new Date(base);
    afternoon.setHours(15, 0, 0, 0);

    expect(isWithinQuietHours(evening, window)).toBe(true);
    expect(isWithinQuietHours(morning, window)).toBe(true);
    expect(isWithinQuietHours(afternoon, window)).toBe(false);
  });

  it('should return next exit time when inside quiet hours', () => {
    const window = parseQuietHoursWindow('22-07');
    const evening = new Date(2024, 3, 29, 23, 0, 0, 0);

    const exit = getNextQuietHoursExit(evening, window);

    expect(exit.getHours()).toBe(7);
  });
});
