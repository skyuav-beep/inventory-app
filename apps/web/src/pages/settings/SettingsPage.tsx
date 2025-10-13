import styles from './SettingsPage.module.css';

export function SettingsPage() {
  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <h3>알림 설정</h3>
        <p>텔레그램/슬랙/이메일 연동을 관리할 수 있도록 설계할 예정입니다.</p>
        <div className={styles.settingRow}>
          <label htmlFor="telegram-token">텔레그램 봇 토큰</label>
          <input id="telegram-token" type="password" placeholder="봇 토큰 입력" />
        </div>
        <div className={styles.settingRow}>
          <label htmlFor="telegram-chat">알림 대상 Chat ID</label>
          <input id="telegram-chat" type="text" placeholder="123456" />
        </div>
        <button type="button" className={styles.primaryButton}>
          변경사항 저장
        </button>
      </section>

      <section className={styles.section}>
        <h3>사용자 & 권한</h3>
        <p>사용자별 역할과 리소스 접근권한을 설정하는 UI를 연결할 예정입니다.</p>
        <button type="button" className={styles.secondaryButton}>
          사용자 관리로 이동
        </button>
      </section>
    </div>
  );
}
