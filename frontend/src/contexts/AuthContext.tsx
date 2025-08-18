/**
 * Secure Authentication Context
 * Manages authentication state with security best practices
 */

import React, { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
import { apiClient } from '../utils/secureApiClient';

interface User {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  lastLogin?: string;
  mfaEnabled?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionExpiry: number | null;
  lastActivity: number;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string, mfaCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
  updateLastActivity: () => void;
  checkPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; sessionExpiry: number } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_ACTIVITY' }
  | { type: 'SET_LOADING'; payload: boolean };

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  sessionExpiry: null,
  lastActivity: Date.now()
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        sessionExpiry: action.payload.sessionExpiry,
        lastActivity: Date.now()
      };

    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
        sessionExpiry: null
      };

    case 'AUTH_LOGOUT':
      return {
        ...initialState,
        isLoading: false
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };

    case 'UPDATE_ACTIVITY':
      return {
        ...state,
        lastActivity: Date.now()
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };

    default:
      return state;
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Session timeout configuration (30 minutes)
  const SESSION_TIMEOUT = 30 * 60 * 1000;
  const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Check every minute

  /**
   * Update last activity timestamp
   */
  const updateLastActivity = useCallback(() => {
    dispatch({ type: 'UPDATE_ACTIVITY' });
  }, []);

  /**
   * Check if user has specific permission
   */
  const checkPermission = useCallback((permission: string): boolean => {
    return state.user?.permissions?.includes(permission) || false;
  }, [state.user]);

  /**
   * Check if user has specific role
   */
  const hasRole = useCallback((role: string): boolean => {
    return state.user?.role === role;
  }, [state.user]);

  /**
   * Login user with credentials
   */
  const login = useCallback(async (email: string, password: string, mfaCode?: string) => {
    dispatch({ type: 'AUTH_START' });

    try {
      const response = await apiClient.post('/api/auth/login', {
        email,
        password,
        mfaCode
      }, {
        requiresAuth: false,
        requiresCsrf: true
      });

      const { user, token, expiresIn } = response.data;

      // Set auth token in API client
      apiClient.setAuthToken(token);

      // Calculate session expiry
      const sessionExpiry = Date.now() + (expiresIn * 1000);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user,
          sessionExpiry
        }
      });

    } catch (error: any) {
      const errorMessage = error.message || 'Login failed. Please try again.';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw error;
    }
  }, []);

  /**
   * Logout user and clear session
   */
  const logout = useCallback(async () => {
    try {
      // Attempt to logout on server
      await apiClient.post('/api/auth/logout', {}, {
        requiresAuth: true,
        requiresCsrf: true
      });
    } catch (error) {
      // Continue with logout even if server request fails
      console.warn('Server logout failed:', error);
    } finally {
      // Clear client-side state
      apiClient.clearAuthToken();
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  }, []);

  /**
   * Refresh authentication token
   */
  const refreshToken = useCallback(async () => {
    try {
      const response = await apiClient.post('/api/auth/refresh', {}, {
        requiresAuth: true,
        requiresCsrf: false
      });

      const { user, token, expiresIn } = response.data;

      // Update auth token
      apiClient.setAuthToken(token);

      // Calculate new session expiry
      const sessionExpiry = Date.now() + (expiresIn * 1000);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user,
          sessionExpiry
        }
      });

    } catch (error) {
      console.error('Token refresh failed:', error);
      await logout();
      throw error;
    }
  }, [logout]);

  /**
   * Clear authentication error
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  /**
   * Initialize authentication state on app load
   */
  useEffect(() => {
    const initializeAuth = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });

      try {
        // Check if we have a stored token
        const storedToken = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
        
        if (storedToken) {
          apiClient.setAuthToken(storedToken);
          
          // Verify token with server
          const response = await apiClient.get('/api/auth/me', {
            requiresAuth: true,
            requiresCsrf: false
          });

          const { user, expiresIn } = response.data;
          const sessionExpiry = Date.now() + (expiresIn * 1000);

          dispatch({
            type: 'AUTH_SUCCESS',
            payload: {
              user,
              sessionExpiry
            }
          });
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (error) {
        console.warn('Auth initialization failed:', error);
        apiClient.clearAuthToken();
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, []);

  /**
   * Set up session timeout and activity monitoring
   */
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const checkSession = () => {
      const now = Date.now();
      const timeSinceActivity = now - state.lastActivity;
      const timeUntilExpiry = state.sessionExpiry ? state.sessionExpiry - now : 0;

      // Auto-logout if session expired or inactive too long
      if (timeUntilExpiry <= 0 || timeSinceActivity > SESSION_TIMEOUT) {
        console.log('Session expired due to inactivity');
        logout();
        return;
      }

      // Refresh token if expiring soon (5 minutes before expiry)
      if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
        refreshToken().catch(console.error);
      }
    };

    const interval = setInterval(checkSession, ACTIVITY_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [state.isAuthenticated, state.lastActivity, state.sessionExpiry, logout, refreshToken]);

  /**
   * Set up activity listeners
   */
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      updateLastActivity();
    };

    // Throttle activity updates to avoid excessive state updates
    let activityTimeout: NodeJS.Timeout;
    const throttledHandleActivity = () => {
      if (activityTimeout) return;
      
      activityTimeout = setTimeout(() => {
        handleActivity();
        activityTimeout = null as any;
      }, 30000); // Update at most every 30 seconds
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, throttledHandleActivity, true);
    });

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, throttledHandleActivity, true);
      });
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
    };
  }, [state.isAuthenticated, updateLastActivity]);

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    refreshToken,
    clearError,
    updateLastActivity,
    checkPermission,
    hasRole
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to use authentication context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;