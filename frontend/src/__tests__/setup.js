// Jest setup file for testing environment
import '@testing-library/jest-dom';

// Mock console.log to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to hide logs during tests
  // log: jest.fn(),
};

// Mock window.matchMedia (required for responsive tests)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Setup test environment
beforeEach(() => {
  // Reset any mocks before each test
  jest.clearAllMocks();
});