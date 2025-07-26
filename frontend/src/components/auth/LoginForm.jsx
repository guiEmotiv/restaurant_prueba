import React from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { ChefHat } from 'lucide-react';

const LoginForm = ({ children }) => {
  const customComponents = {
    Header() {
      return (
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <ChefHat className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">El Fogón de Don Soto</h1>
          <p className="text-gray-600 mt-2">Sistema de Gestión de Restaurant</p>
        </div>
      );
    }
  };

  const customFormFields = {
    signIn: {
      username: {
        placeholder: 'Ingresa tu usuario',
        label: 'Usuario'
      },
      password: {
        placeholder: 'Ingresa tu contraseña',
        label: 'Contraseña'
      }
    }
  };

  const customTexts = {
    'Sign In': 'Iniciar Sesión',
    'Sign Up': 'Registrarse',
    'Sign Out': 'Cerrar Sesión',
    'Forgot Password': '¿Olvidaste tu contraseña?',
    'Reset Password': 'Restablecer Contraseña',
    'New Password': 'Nueva Contraseña',
    'Username': 'Usuario',
    'Password': 'Contraseña',
    'Email': 'Correo electrónico',
    'Phone Number': 'Número de teléfono',
    'Confirm Password': 'Confirmar Contraseña',
    'Enter your username': 'Ingresa tu usuario',
    'Enter your password': 'Ingresa tu contraseña',
    'We Emailed You': 'Te enviamos un correo',
    'Your code is on the way. To log in, enter the code we emailed to': 'Tu código está en camino. Para iniciar sesión, ingresa el código que enviamos a',
    'Lost your code?': '¿Perdiste tu código?',
    'Resend Code': 'Reenviar código',
    'Submit': 'Enviar',
    'Skip': 'Omitir',
    'Back to Sign In': 'Volver a Iniciar Sesión',
    'Confirm': 'Confirmar'
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Authenticator
          components={customComponents}
          formFields={customFormFields}
          // Hide sign up tab - users should be created by admin
          hideSignUp={true}
          className="amplify-authenticator"
        >
          {children}
        </Authenticator>
      </div>
    </div>
  );
};

export default LoginForm;