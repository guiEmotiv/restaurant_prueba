import { render } from '@testing-library/react';
import App from '../App';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div data-testid="browser-router">{children}</div>,
  Routes: ({ children }) => <div data-testid="routes">{children}</div>,
  Route: ({ children }) => <div data-testid="route">{children}</div>,
  Navigate: () => <div data-testid="navigate">Navigate</div>,
}));

// Mock AWS Amplify
jest.mock('aws-amplify', () => ({
  Amplify: {
    configure: jest.fn(),
  },
}));

// Mock contexts
jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div data-testid="auth-provider">{children}</div>,
}));

jest.mock('../contexts/ToastContext', () => ({
  ToastProvider: ({ children }) => <div data-testid="toast-provider">{children}</div>,
}));

describe('App Component', () => {
  test('renders without crashing', () => {
    render(<App />);
  });

  test('contains main app structure', () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('browser-router')).toBeInTheDocument();
  });
});