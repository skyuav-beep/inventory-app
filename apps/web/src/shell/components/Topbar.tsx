import { useLocation } from 'react-router-dom';
import styles from './Topbar.module.css';
import { appRoutes } from '../../app/routes';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

interface TopbarProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export function Topbar({ onToggleSidebar, isSidebarOpen }: TopbarProps) {
  const location = useLocation();
  const currentRoute =
    appRoutes.find((route) => route.path === location.pathname) ??
    appRoutes.find((route) => route.path === '/');
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className={styles.topbar}>
      <div className={styles.heading}>
        <button
          type="button"
          className={
            isSidebarOpen ? `${styles.menuButton} ${styles.menuButtonActive}` : styles.menuButton
          }
          onClick={onToggleSidebar}
          aria-label="사이드바 토글"
        >
          <span />
          <span />
          <span />
        </button>

        <div>
          <h1 className={styles.title}>{currentRoute?.meta.label ?? '재고 관리'}</h1>
          <p className={styles.subtitle}>
            {currentRoute?.meta.description ?? '재고 현황을 한눈에 확인하세요.'}
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        {user && (
          <div className={styles.userChip}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userRole}>{user.role}</span>
          </div>
        )}
        <button
          type="button"
          className={styles.iconButton}
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? '라이트 테마로 전환' : '다크 테마로 전환'}
        >
          <span aria-hidden="true">{theme === 'dark' ? '🌙' : '🌞'}</span>
        </button>
      </div>
    </header>
  );
}
