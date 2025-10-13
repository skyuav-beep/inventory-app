import { ReactNode } from 'react';

export interface RouteMeta {
  label: string;
  description?: string;
  icon?: ReactNode;
  exact?: boolean;
  navigation?: boolean;
  requiresAuth?: boolean;
  resource?: string;
}

export interface AppRoute {
  path: string;
  element: ReactNode;
  meta: RouteMeta;
}
