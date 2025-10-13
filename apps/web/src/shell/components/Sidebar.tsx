import { NavLink } from 'react-router-dom';
import { appRoutes } from '../../app/routes';
import { useAuth } from '../../hooks/useAuth';
import styles from './Sidebar.module.css';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { hasPermission } = useAuth();
  const navigationRoutes = appRoutes.filter((route) => {
    if (route.meta.navigation === false) {
      return false;
    }

    if (route.meta.resource) {
      return hasPermission(route.meta.resource);
    }

    return true;
  });

  return (
    <aside className={mobileOpen ? `${styles.sidebar} ${styles.mobileOpen}` : styles.sidebar}>
      <div className={styles.logoArea}>
        <span className={styles.logoMark}>📦</span>
        <span className={styles.logoText}>Inventory</span>
      </div>

      <nav className={styles.nav}>
        <ul>
          {navigationRoutes.map((route) => (
            <li key={route.path}>
              <NavLink
                to={route.path}
                className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
                end={route.meta.exact}
                onClick={onClose}
              >
                {route.meta.icon && <span className={styles.icon}>{route.meta.icon}</span>}
                <span>{route.meta.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
