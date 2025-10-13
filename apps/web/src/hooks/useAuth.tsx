import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCurrentUser } from '../services/authService';

export interface AuthPermission {
  resource: string;
  read: boolean;
  write: boolean;
}

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  permissions: AuthPermission[];
}

interface AuthContextValue {
  isAuthenticated: boolean;
  initializing: boolean;
  accessToken: string | null;
  user: AuthUser | null;
  login: (token: string, user?: AuthUser | null) => void;
  logout: () => void;
  setUser: (user: AuthUser | null) => void;
  hasPermission: (resource: string, options?: { write?: boolean }) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'accessToken';

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState<boolean>(Boolean(token));

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      if (!token) {
        if (!cancelled) {
          setUser(null);
          setInitializing(false);
        }
        return;
      }

      if (user) {
        setInitializing(false);
        return;
      }

      setInitializing(true);

      try {
        const data = await fetchCurrentUser();

        if (!cancelled) {
          setUser(data);
        }
      } catch (error) {
        console.error('Failed to load current user', error);
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    };

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, [token, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token),
      initializing,
      accessToken: token,
      user,
      login: (nextToken: string, nextUser?: AuthUser | null) => {
        localStorage.setItem(STORAGE_KEY, nextToken);
        setToken(nextToken);
        if (nextUser) {
          setUser(nextUser);
        }
      },
      logout: () => {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
      },
      setUser,
      hasPermission: (resource: string, options?: { write?: boolean }) => {
        if (!user) {
          return false;
        }

        const permission = user.permissions.find((item) => item.resource === resource);

        if (!permission) {
          return false;
        }

        if (options?.write) {
          return Boolean(permission.write);
        }

        return Boolean(permission.read);
      },
    }),
    [initializing, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
