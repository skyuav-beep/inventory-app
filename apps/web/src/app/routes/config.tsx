import { AppRoute } from './types';
import { DashboardPage } from '../../pages/dashboard/DashboardPage';
import { ProductsPage } from '../../pages/products/ProductsPage';
import { InboundsPage } from '../../pages/inbounds/InboundsPage';
import { OutboundsPage } from '../../pages/outbounds/OutboundsPage';
import { ReturnsPage } from '../../pages/returns/ReturnsPage';
import { UploadsPage } from '../../pages/uploads/UploadsPage';
import { SettingsPage } from '../../pages/settings/SettingsPage';
import { LogsPage } from '../../pages/logs/LogsPage';
import { LoginPage } from '../../pages/auth/LoginPage';

export const appRoutes: AppRoute[] = [
  {
    path: '/login',
    element: <LoginPage />,
    meta: {
      label: '로그인',
      description: '사내 계정으로 로그인하세요.',
      navigation: false,
      requiresAuth: false,
    },
  },
  {
    path: '/',
    element: <DashboardPage />,
    meta: {
      label: '대시보드',
      description: '오늘의 재고 현황을 확인하세요.',
      icon: '📊',
      exact: true,
      navigation: true,
      requiresAuth: true,
      resource: 'dashboard',
    },
  },
  {
    path: '/products',
    element: <ProductsPage />,
    meta: {
      label: '제품 관리',
      description: '제품 목록과 안전재고를 관리합니다.',
      icon: '📦',
      navigation: true,
      requiresAuth: true,
      resource: 'products',
    },
  },
  {
    path: '/inbounds',
    element: <InboundsPage />,
    meta: {
      label: '입고 내역',
      description: '입고 기록을 확인하고 추가합니다.',
      icon: '🚚',
      navigation: true,
      requiresAuth: true,
      resource: 'inbounds',
    },
  },
  {
    path: '/outbounds',
    element: <OutboundsPage />,
    meta: {
      label: '출고 내역',
      description: '출고 내역과 재고 차감을 확인합니다.',
      icon: '📤',
      navigation: true,
      requiresAuth: true,
      resource: 'outbounds',
    },
  },
  {
    path: '/returns',
    element: <ReturnsPage />,
    meta: {
      label: '반품 내역',
      description: '반품 처리 현황을 추적합니다.',
      icon: '↩️',
      navigation: true,
      requiresAuth: true,
      resource: 'returns',
    },
  },
  {
    path: '/uploads',
    element: <UploadsPage />,
    meta: {
      label: '업로드',
      description: '입고/출고 엑셀 업로드 작업을 관리합니다.',
      icon: '📤',
      navigation: true,
      requiresAuth: true,
      resource: 'inbounds',
    },
  },
  {
    path: '/settings',
    element: <SettingsPage />,
    meta: {
      label: '환경설정',
      description: '알림 및 사용자 설정을 관리합니다.',
      icon: '⚙️',
      navigation: true,
      requiresAuth: true,
      resource: 'settings',
    },
  },
  {
    path: '/logs',
    element: <LogsPage />,
    meta: {
      label: 'LOG',
      description: '감사 로그와 주요 작업 이력을 확인합니다.',
      icon: '🧾',
      navigation: true,
      requiresAuth: true,
      resource: 'settings',
    },
  },
];
