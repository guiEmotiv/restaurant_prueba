/**
 * Tests for RoleProtectedRoute component
 * Testing role-based access control
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RoleProtectedRoute from '../../components/auth/RoleProtectedRoute';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock AuthContext
const MockAuthProvider = ({ children, mockAuth }) => (
  <AuthProvider value={mockAuth}>
    {children}
  </AuthProvider>
);

// Test component
const TestComponent = () => <div>Protected Content</div>;

describe('RoleProtectedRoute', () => {
  const renderWithRouter = (component) => {
    return render(
      <BrowserRouter>
        {component}
      </BrowserRouter>
    );
  };

  test('renders children when user has required role', () => {
    const mockAuth = {
      user: { username: 'admin@test.com' },
      userRole: 'administradores',
      isAuthenticated: true,
      loading: false
    };

    renderWithRouter(
      <MockAuthProvider mockAuth={mockAuth}>
        <RoleProtectedRoute allowedRoles={['administradores']}>
          <TestComponent />
        </RoleProtectedRoute>
      </MockAuthProvider>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  test('renders children when user has one of multiple allowed roles', () => {
    const mockAuth = {
      user: { username: 'waiter@test.com' },
      userRole: 'meseros',
      isAuthenticated: true,
      loading: false
    };

    renderWithRouter(
      <MockAuthProvider mockAuth={mockAuth}>
        <RoleProtectedRoute allowedRoles={['administradores', 'meseros']}>
          <TestComponent />
        </RoleProtectedRoute>
      </MockAuthProvider>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  test('shows no role error when user has no role', () => {
    const mockAuth = {
      user: { username: 'user@test.com' },
      userRole: null,
      isAuthenticated: true,
      loading: false
    };

    renderWithRouter(
      <MockAuthProvider mockAuth={mockAuth}>
        <RoleProtectedRoute allowedRoles={['administradores']}>
          <TestComponent />
        </RoleProtectedRoute>
      </MockAuthProvider>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText(/sin rol asignado/i)).toBeInTheDocument();
  });

  test('shows access denied when user has wrong role', () => {
    const mockAuth = {
      user: { username: 'cook@test.com' },
      userRole: 'cocineros',
      isAuthenticated: true,
      loading: false
    };

    renderWithRouter(
      <MockAuthProvider mockAuth={mockAuth}>
        <RoleProtectedRoute allowedRoles={['administradores']}>
          <TestComponent />
        </RoleProtectedRoute>
      </MockAuthProvider>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText(/acceso denegado/i)).toBeInTheDocument();
  });

  test('shows loading screen when authentication is loading', () => {
    const mockAuth = {
      user: null,
      userRole: null,
      isAuthenticated: false,
      loading: true
    };

    renderWithRouter(
      <MockAuthProvider mockAuth={mockAuth}>
        <RoleProtectedRoute allowedRoles={['administradores']}>
          <TestComponent />
        </RoleProtectedRoute>
      </MockAuthProvider>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  test('redirects to login when not authenticated', () => {
    const mockAuth = {
      user: null,
      userRole: null,
      isAuthenticated: false,
      loading: false
    };

    renderWithRouter(
      <MockAuthProvider mockAuth={mockAuth}>
        <RoleProtectedRoute allowedRoles={['administradores']}>
          <TestComponent />
        </RoleProtectedRoute>
      </MockAuthProvider>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  test('handles empty allowed roles array', () => {
    const mockAuth = {
      user: { username: 'admin@test.com' },
      userRole: 'administradores',
      isAuthenticated: true,
      loading: false
    };

    renderWithRouter(
      <MockAuthProvider mockAuth={mockAuth}>
        <RoleProtectedRoute allowedRoles={[]}>
          <TestComponent />
        </RoleProtectedRoute>
      </MockAuthProvider>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  test('handles undefined user role', () => {
    const mockAuth = {
      user: { username: 'user@test.com' },
      userRole: undefined,
      isAuthenticated: true,
      loading: false
    };

    renderWithRouter(
      <MockAuthProvider mockAuth={mockAuth}>
        <RoleProtectedRoute allowedRoles={['administradores']}>
          <TestComponent />
        </RoleProtectedRoute>
      </MockAuthProvider>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});