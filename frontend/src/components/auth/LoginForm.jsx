import React from 'react';
import { Authenticator, translations } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { ChefHat } from 'lucide-react';

const LoginForm = ({ children }) => {
  
  // Configurar traducciones en español
  translations.es = {
    'Sign In': 'Iniciar Sesión',
    'Sign Up': 'Registrarse', 
    'Sign Out': 'Cerrar Sesión',
    'Username': 'Usuario',
    'Password': 'Contraseña',
    'Enter your username': 'Ingresa tu usuario',
    'Enter your password': 'Ingresa tu contraseña',
    'Confirm': 'Confirmar',
    'Change Password': 'Cambiar Contraseña',
    'New Password': 'Nueva Contraseña',
    'Confirm Password': 'Confirmar Contraseña',
    'Enter your new password': 'Ingresa tu nueva contraseña',
    'Please confirm your password': 'Por favor confirma tu contraseña',
    'Your password must be changed before continuing': 'Debes cambiar tu contraseña antes de continuar',
    'Change password': 'Cambiar contraseña',
    // Textos específicos para NEW_PASSWORD_REQUIRED
    'Force New Password': 'Cambio de Contraseña Requerido',
    'You are required to change your password': 'Se requiere que cambies tu contraseña',
    'Please set a new password to continue': 'Por favor establece una nueva contraseña para continuar',
    'Set new password': 'Establecer nueva contraseña',
    'Your administrator requires that you change your password before continuing': 'Tu administrador requiere que cambies tu contraseña antes de continuar'
  };
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
    },
    forceNewPassword: {
      password: {
        placeholder: 'Ingresa tu nueva contraseña',
        label: 'Nueva Contraseña'
      }
    }
  };


  return (
    <Authenticator
      components={customComponents}
      formFields={customFormFields}
      // Hide sign up tab - users should be created by admin
      hideSignUp={true}
    >
      {({ user }) => {
        if (user) {
          // ✅ Notificar al AuthContext que el usuario se autenticó
          window.dispatchEvent(new CustomEvent('cognitoAuthSuccess', { 
            detail: { user, timestamp: Date.now() } 
          }));
        }
        
        return (
          <div className="min-h-screen bg-gray-50">
            {children}
          </div>
        );
      }}
    </Authenticator>
  );
};

export default LoginForm;