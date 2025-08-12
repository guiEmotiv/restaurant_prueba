/**
 * Tests for AuthContext
 * Testing authentication state management and role handling
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

// Mock AWS Amplify
jest.mock('aws-amplify/auth');
jest.mock('aws-amplify/utils', () => ({
  Hub: {
    listen: jest.fn(() => jest.fn()), // Return unsubscribe function
  },
}));

// Test component to access auth context
const TestComponent = () => {
  const { user, userRole, isAuthenticated, loading } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="authenticated">{isAuthenticated.toString()}</div>
      <div data-testid="user">{user?.username || 'no-user'}</div>
      <div data-testid="role">{userRole || 'no-role'}</div>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks
    getCurrentUser.mockReset();
    fetchAuthSession.mockReset();
  });

  test('initial state shows loading false and not authenticated', () => {
    getCurrentUser.mockRejectedValue(new Error('Not authenticated'));
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(screen.getByTestId('role')).toHaveTextContent('no-role');
  });

  test('handles admin user authentication correctly', async () => {
    const mockUser = {
      username: 'admin@test.com',
      attributes: {
        email: 'admin@test.com'
      }
    };

    const mockSession = {
      tokens: {
        idToken: {
          payload: {
            'cognito:groups': ['administradores'],
            email: 'admin@test.com'
          }
        }
      }
    };

    getCurrentUser.mockResolvedValue(mockUser);
    fetchAuthSession.mockResolvedValue(mockSession);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('admin@test.com');
    expect(screen.getByTestId('role')).toHaveTextContent('administradores');
  });

  test('handles waiter user authentication correctly', async () => {
    const mockUser = {
      username: 'waiter@test.com',
      attributes: {
        email: 'waiter@test.com'
      }
    };

    const mockSession = {
      tokens: {
        idToken: {
          payload: {
            'cognito:groups': ['meseros'],
            email: 'waiter@test.com'
          }
        }
      }
    };

    getCurrentUser.mockResolvedValue(mockUser);
    fetchAuthSession.mockResolvedValue(mockSession);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('meseros');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user')).toHaveTextContent('waiter@test.com');
  });

  test('handles cook user authentication correctly', async () => {
    const mockUser = {
      username: 'cook@test.com',
      attributes: {
        email: 'cook@test.com'
      }
    };

    const mockSession = {
      tokens: {
        idToken: {
          payload: {
            'cognito:groups': ['cocineros'],
            email: 'cook@test.com'
          }
        }
      }
    };

    getCurrentUser.mockResolvedValue(mockUser);
    fetchAuthSession.mockResolvedValue(mockSession);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('cocineros');
    });
  });

  test('handles user without groups correctly', async () => {
    const mockUser = {
      username: 'nogroup@test.com',
      attributes: {
        email: 'nogroup@test.com'
      }
    };

    const mockSession = {
      tokens: {
        idToken: {
          payload: {
            'cognito:groups': [], // No groups
            email: 'nogroup@test.com'
          }
        }
      }
    };

    getCurrentUser.mockResolvedValue(mockUser);
    fetchAuthSession.mockResolvedValue(mockSession);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('role')).toHaveTextContent('no-role');
  });

  test('handles authentication failure correctly', async () => {
    getCurrentUser.mockRejectedValue(new Error('Authentication failed'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(screen.getByTestId('role')).toHaveTextContent('no-role');
  });

  test('handles session fetch failure correctly', async () => {
    const mockUser = {
      username: 'user@test.com',
      attributes: {
        email: 'user@test.com'
      }
    };

    getCurrentUser.mockResolvedValue(mockUser);
    fetchAuthSession.mockRejectedValue(new Error('Session fetch failed'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    // User should be authenticated but role should be null due to session failure
    expect(screen.getByTestId('user')).toHaveTextContent('user@test.com');
    expect(screen.getByTestId('role')).toHaveTextContent('no-role');
  });

  test('fallback to access token when id token not available', async () => {
    const mockUser = {
      username: 'user@test.com',
      attributes: {
        email: 'user@test.com'
      }
    };

    const mockSession = {
      tokens: {
        accessToken: {
          payload: {
            'cognito:groups': ['administradores'],
          }
        }
        // No idToken
      }
    };

    getCurrentUser.mockResolvedValue(mockUser);
    fetchAuthSession.mockResolvedValue(mockSession);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('administradores');
    });
  });
});