import React from 'react';
import { ChefHat } from 'lucide-react';

const AuthLoadingScreen = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center animate-pulse">
            <ChefHat className="h-8 w-8 text-orange-600" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          El Fogón de Don Soto
        </h2>
        <p className="text-gray-600">Cargando sistema...</p>
        <div className="mt-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
        </div>
      </div>
    </div>
  );
};

export default AuthLoadingScreen;