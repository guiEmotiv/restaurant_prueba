// AWS Amplify Configuration for Cognito
// Note: These values need to be configured in AWS Cognito console first

const amplifyConfig = {
  Auth: {
    Cognito: {
      // Region where your Cognito User Pool was created
      region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
      
      // Cognito User Pool ID
      userPoolId: import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID || 'us-east-1_XXXXXXXXX',
      
      // Cognito User Pool App Client ID  
      userPoolClientId: import.meta.env.VITE_AWS_COGNITO_APP_CLIENT_ID || 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
      
      // Identity pool is optional
      identityPoolId: '',
      
      // Mandatory for user pool only
      loginWith: {
        username: true,
        email: false,
        phone: false
      },
      
      // Sign up attributes
      signUpVerificationMethod: 'code',
      
      // User attributes
      userAttributes: {
        email: {
          required: true
        }
      },
      
      // Password policy
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

export default amplifyConfig;