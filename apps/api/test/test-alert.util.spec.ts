import { buildTestAlertMessage } from '../src/alerts/utils/test-alert.util';

describe('buildTestAlertMessage', () => {
  it('should include requester name and timestamp', () => {
    const message = buildTestAlertMessage('Tester');

    expect(message).toContain('Tester');
    expect(message.startsWith('[TEST]')).toBe(true);
    expect(message).toContain('requested by');
    expect(message).toContain('at');
  });
});
