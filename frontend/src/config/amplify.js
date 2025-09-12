// AWS Amplify Configuration for Cognito
// Production-ready configuration - ALWAYS required

const amplifyConfig = {
  Auth: {
    Cognito: {
      // Region where your Cognito User Pool was created
      region: import.meta.env.VITE_AWS_REGION || 'us-west-2',
      
      // Cognito User Pool ID (from environment variables)
      userPoolId: import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID || 'us-west-2_bdCwF60ZI',
      
      // Cognito User Pool App Client ID (from environment variables)  
      userPoolClientId: import.meta.env.VITE_AWS_COGNITO_APP_CLIENT_ID || '4i9hrd7srgbqbtun09p43ncfn0',
      
      // Login configuration
      loginWith: {
        username: true,
        email: false,
        phone: false
      },
      
      // Password settings
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true
      },
      
      // Token refresh configuration
      signUpVerificationMethod: 'code',
      
      // OAuth configuration (if needed)
      loginWith: {
        oauth: {
          domain: `${import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID || 'us-west-2_bdCwF60ZI'}.amazoncognito.com`,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: `${window.location.origin}/`,
          redirectSignOut: `${window.location.origin}/`,
          responseType: 'code'
        },
        username: true,
        email: false
      }
    }
  }
};

// Validate that required credentials are present
const isValid = !!(amplifyConfig.Auth.Cognito.userPoolId && amplifyConfig.Auth.Cognito.userPoolClientId);
if (!isValid) {
  throw new Error('AWS Cognito credentials are missing. Please check environment variables.');
}

console.log('🔧 AWS Amplify Configuration:', {
  userPoolId: amplifyConfig.Auth.Cognito.userPoolId ? '✅ Set' : '❌ Missing',
  appClientId: amplifyConfig.Auth.Cognito.userPoolClientId ? '✅ Set' : '❌ Missing',
  region: amplifyConfig.Auth.Cognito.region,
  valid: isValid ? '✅ Valid' : '❌ Invalid'
});

export default amplifyConfig;