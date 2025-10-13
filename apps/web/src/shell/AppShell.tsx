import { useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AppRouter } from './routing/AppRouter';
import { appRoutes } from '../app/routes';

export function AppShell() {
  const location = useLocation();
  const currentRoute = appRoutes.find((route) => route.path === location.pathname);
  const requiresAuth = currentRoute?.meta.requiresAuth ?? true;

  if (!requiresAuth) {
    return <AppRouter />;
  }

  return (
    <Layout>
      <AppRouter />
    </Layout>
  );
}
