import { PropsWithChildren, useCallback, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import styles from './Layout.module.css';

export function Layout({ children }: PropsWithChildren) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className={styles.appRoot}>
      <Sidebar mobileOpen={isSidebarOpen} onClose={closeSidebar} />
      <div className={styles.contentArea}>
        <Topbar onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        <main className={styles.mainContent}>{children}</main>
      </div>
      {isSidebarOpen && <button type="button" className={styles.backdrop} aria-label="메뉴 닫기" onClick={closeSidebar} />}
    </div>
  );
}
