import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Topbar.module.css';
import { appRoutes } from '../../app/routes';
import { useAuth } from '../../hooks/useAuth';

interface TopbarProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export function Topbar({ onToggleSidebar, isSidebarOpen }: TopbarProps) {
  const location = useLocation();
  const currentRoute =
    appRoutes.find((route) => route.path === location.pathname) ?? appRoutes.find((route) => route.path === '/');
  const navigate = useNavigate();
  const { logout, user, hasPermission } = useAuth();
  const canQuickRegister = hasPermission('products', { write: true }) || hasPermission('inbounds', { write: true });

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.heading}>
        <button
          type="button"
          className={isSidebarOpen ? `${styles.menuButton} ${styles.menuButtonActive}` : styles.menuButton}
          onClick={onToggleSidebar}
          aria-label="사이드바 토글"
        >
          <span />
          <span />
          <span />
        </button>

        <div>
          <h1 className={styles.title}>{currentRoute?.meta.label ?? '재고 관리'}</h1>
          <p className={styles.subtitle}>{currentRoute?.meta.description ?? '재고 현황을 한눈에 확인하세요.'}</p>
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} disabled={!canQuickRegister}>
          빠른 등록
        </button>
        {user && (
          <div className={styles.userChip}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userRole}>{user.role}</span>
          </div>
        )}
        <button type="button" className={styles.secondaryButton} onClick={handleLogout}>
          로그아웃
        </button>
      </div>
    </header>
  );
}
