import { NavLink, useNavigate } from 'react-router-dom';
import brandLogoLarge from '../../assets/media/logos/Lemetree_logo_Large.png';
import { appRoutes } from '../../app/routes';
import { useAuth } from '../../hooks/useAuth';
import styles from './Sidebar.module.css';

interface SidebarProps {
  mobileOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export function Sidebar({ mobileOpen, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  const { hasPermission, logout, user } = useAuth();
  const navigate = useNavigate();

  const navigationRoutes = appRoutes.filter((route) => {
    if (route.meta.navigation === false) {
      return false;
    }

    if (route.meta.resource) {
      return hasPermission(route.meta.resource);
    }

    return true;
  });

  const handleLogout = () => {
    logout();
    onClose();
    navigate('/login', { replace: true });
  };

  const sidebarClassName = [
    styles.sidebar,
    mobileOpen ? styles.mobileOpen : '',
    collapsed ? styles.collapsed : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside className={sidebarClassName}>
      <div className={styles.header}>
        <div className={styles.logoArea}>
          <img src={brandLogoLarge} alt="Lremettre ERP 로고" className={styles.logoImage} />
          {!collapsed && <span className={styles.logoText}>Lremettre ERP</span>}
        </div>
        <button
          type="button"
          className={styles.collapseButton}
          onClick={onToggleCollapse}
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          <span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
        </button>
      </div>

      <nav className={styles.nav}>
        <ul>
          {navigationRoutes.map((route) => (
            <li key={route.path}>
              <NavLink
                to={route.path}
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.active}` : styles.link
                }
                end={route.meta.exact}
                onClick={onClose}
                aria-label={collapsed ? route.meta.label : undefined}
              >
                {route.meta.icon && <span className={styles.icon}>{route.meta.icon}</span>}
                {!collapsed && <span className={styles.linkLabel}>{route.meta.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {user && (
        <div className={styles.userSection}>
          <div className={styles.userSummary}>
            <div className={styles.userChip}>
              <span className={styles.userInitial}>{user.name?.[0] ?? '?'}</span>
              {!collapsed && (
                <div>
                  <p className={styles.userName}>{user.name}</p>
                  <p className={styles.userRole}>{user.role}</p>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            className={styles.logoutButton}
            onClick={handleLogout}
            aria-label="로그아웃"
          >
            <span className={styles.logoutIcon} aria-hidden="true">
              ⎋
            </span>
            {!collapsed && <span>로그아웃</span>}
          </button>
        </div>
      )}
    </aside>
  );
}
