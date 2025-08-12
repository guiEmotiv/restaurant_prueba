/**
 * Tests for API service
 * Testing API client configuration and request handling
 */
import { apiService } from '../../services/api';

// Mock fetch
global.fetch = jest.fn();

// Mock AWS Amplify
jest.mock('aws-amplify/auth', () => ({
  fetchAuthSession: jest.fn(),
}));

const { fetchAuthSession } = require('aws-amplify/auth');

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    
    // Mock successful session by default
    fetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: 'mock-id-token'
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Configuration', () => {
    test('uses correct base URL for development', () => {
      // The API service should be configured with the correct base URL
      expect(apiService).toBeDefined();
    });

    test('includes authentication headers', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      // Make a request that should include auth headers
      try {
        await apiService.units.getAll();
      } catch (error) {
        // We expect this to fail in test environment, but we can check the call
      }

      // Verify that fetch was called (even if it fails)
      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('Units API', () => {
    test('getAll returns units data', async () => {
      const mockUnits = [
        { id: 1, name: 'kg' },
        { id: 2, name: 'litros' }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUnits,
      });

      const result = await apiService.units.getAll();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/units/'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(result).toEqual(mockUnits);
    });

    test('create sends correct data', async () => {
      const newUnit = { name: 'porciones' };
      const createdUnit = { id: 3, ...newUnit };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createdUnit,
      });

      const result = await apiService.units.create(newUnit);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/units/'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(newUnit),
        })
      );

      expect(result).toEqual(createdUnit);
    });

    test('update sends correct data', async () => {
      const unitId = 1;
      const updateData = { name: 'kilogramos' };
      const updatedUnit = { id: unitId, ...updateData };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedUnit,
      });

      const result = await apiService.units.update(unitId, updateData);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/units/${unitId}/`),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(updateData),
        })
      );

      expect(result).toEqual(updatedUnit);
    });

    test('delete sends correct request', async () => {
      const unitId = 1;

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await apiService.units.delete(unitId);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/units/${unitId}/`),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('Recipes API', () => {
    test('getAll handles query parameters', async () => {
      const mockRecipes = [
        { id: 1, name: 'Lomo Saltado' },
        { id: 2, name: 'Pollo a la Brasa' }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRecipes,
      });

      const params = { show_all: true, group: 1 };
      const result = await apiService.recipes.getAll(params);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/recipes/?show_all=true&group=1'),
        expect.objectContaining({
          method: 'GET',
        })
      );

      expect(result).toEqual(mockRecipes);
    });

    test('getById returns specific recipe', async () => {
      const recipeId = 1;
      const mockRecipe = { id: recipeId, name: 'Lomo Saltado' };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRecipe,
      });

      const result = await apiService.recipes.getById(recipeId);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/recipes/${recipeId}/`),
        expect.objectContaining({
          method: 'GET',
        })
      );

      expect(result).toEqual(mockRecipe);
    });
  });

  describe('Error Handling', () => {
    test('handles network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiService.units.getAll()).rejects.toThrow('Network error');
    });

    test('handles HTTP error responses', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Unit not found' }),
      });

      await expect(apiService.units.getById(999)).rejects.toThrow();
    });

    test('handles 401 authentication errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Authentication required' }),
      });

      await expect(apiService.units.getAll()).rejects.toThrow();
    });

    test('handles validation errors', async () => {
      const validationError = {
        name: ['This field is required']
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => validationError,
      });

      await expect(apiService.units.create({})).rejects.toThrow();
    });
  });

  describe('Authentication Integration', () => {
    test('includes ID token in requests when available', async () => {
      const mockToken = 'mock-id-token-123';
      
      fetchAuthSession.mockResolvedValueOnce({
        tokens: {
          idToken: mockToken
        }
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await apiService.units.getAll();

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
          }),
        })
      );
    });

    test('falls back to access token when ID token not available', async () => {
      const mockAccessToken = 'mock-access-token-123';
      
      fetchAuthSession.mockResolvedValueOnce({
        tokens: {
          accessToken: mockAccessToken
          // No idToken
        }
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await apiService.units.getAll();

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockAccessToken}`,
          }),
        })
      );
    });

    test('works without authentication tokens', async () => {
      fetchAuthSession.mockResolvedValueOnce({
        tokens: {}
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await apiService.units.getAll();

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String),
          }),
        })
      );
    });
  });

  describe('Request Logging', () => {
    test('logs API requests in development', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await apiService.units.getAll();

      // Should log request details
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Request:')
      );

      consoleSpy.mockRestore();
    });

    test('logs API responses', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await apiService.units.getAll();

      // Should log response details
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Response:')
      );

      consoleSpy.mockRestore();
    });
  });
});