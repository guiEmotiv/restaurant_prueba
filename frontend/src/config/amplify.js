// AWS Amplify Configuration for Cognito
// Note: These values need to be configured in AWS Cognito console first

const amplifyConfig = {
  Auth: {
    // Region where your Cognito User Pool was created
    region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
    
    // Cognito User Pool ID
    userPoolId: import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID || 'us-east-1_XXXXXXXXX',
    
    // Cognito User Pool App Client ID  
    userPoolWebClientId: import.meta.env.VITE_AWS_COGNITO_APP_CLIENT_ID || 'xxxxxxxxxxxxxxxxxxxxxxxxxx'
    
    // Note: OAuth configuration removed to fix Amplify initialization issues
    // We're using the Authenticator component for login forms, not hosted UI
  }
};

export default amplifyConfig;