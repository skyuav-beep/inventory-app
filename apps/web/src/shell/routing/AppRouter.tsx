import { Routes, Route } from 'react-router-dom';
import { appRoutes } from '../../app/routes';
import { ProtectedRoute } from './ProtectedRoute';

export function AppRouter() {
  return (
    <Routes>
      {appRoutes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={
            <ProtectedRoute
              element={route.element}
              requiresAuth={route.meta.requiresAuth !== false}
              resource={route.meta.resource}
            />
          }
        />
      ))}
      <Route
        path="*"
        element={
          <ProtectedRoute element={<h2>요청한 페이지를 찾을 수 없습니다.</h2>} requiresAuth />
        }
      />
    </Routes>
  );
}
