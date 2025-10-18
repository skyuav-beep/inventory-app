import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  element: ReactNode;
  requiresAuth?: boolean;
  resource?: string;
}

export function ProtectedRoute({ element, requiresAuth = true, resource }: ProtectedRouteProps) {
  const { isAuthenticated, initializing, hasPermission } = useAuth();

  if (requiresAuth) {
    if (initializing) {
      return (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          사용자 정보를 확인하는 중입니다...
        </div>
      );
    }

    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }

    if (resource && !hasPermission(resource)) {
      return <Navigate to="/" replace />;
    }
  }

  if (!requiresAuth && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{element}</>;
}
