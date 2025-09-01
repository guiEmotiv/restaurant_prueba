// AWS Amplify Configuration for Cognito
// Production-ready configuration

const amplifyConfig = {
  Auth: {
    Cognito: {
      // Region where your Cognito User Pool was created
      region: import.meta.env.VITE_AWS_REGION || 'us-west-2',
      
      // Cognito User Pool ID (from environment variables)
      userPoolId: import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID,
      
      // Cognito User Pool App Client ID (from environment variables)
      userPoolClientId: import.meta.env.VITE_AWS_COGNITO_APP_CLIENT_ID,
      
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
      }
    }
  }
};

console.log('🔧 AWS Amplify Configuration:', {
  userPoolId: amplifyConfig.Auth.Cognito.userPoolId ? '✅ Set' : '❌ Missing',
  appClientId: amplifyConfig.Auth.Cognito.userPoolClientId ? '✅ Set' : '❌ Missing',
  region: amplifyConfig.Auth.Cognito.region
});

export default amplifyConfig;