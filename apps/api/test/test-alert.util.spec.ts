import { buildTestAlertMessage } from '../src/alerts/utils/test-alert.util';

describe('buildTestAlertMessage', () => {
  it('고정된 텔레그램 테스트 메시지를 반환한다', () => {
    const message = buildTestAlertMessage('Tester');

    expect(message).toBe('안녕하세요 르메뜨리입니다');
  });
});
