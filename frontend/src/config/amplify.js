// AWS Amplify Configuration for Cognito
// Note: These values need to be configured in AWS Cognito console first

const amplifyConfig = {
  Auth: {
    // Region where your Cognito User Pool was created
    region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
    
    // Cognito User Pool ID
    userPoolId: import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID || 'us-east-1_XXXXXXXXX',
    
    // Cognito User Pool App Client ID  
    userPoolWebClientId: import.meta.env.VITE_AWS_COGNITO_APP_CLIENT_ID || 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
    
    // Optional: Cognito Domain for hosted UI
    oauth: {
      domain: import.meta.env.VITE_AWS_COGNITO_DOMAIN || 'your-domain.auth.us-east-1.amazoncognito.com',
      scope: ['email', 'openid', 'profile'],
      redirectSignIn: import.meta.env.VITE_REDIRECT_SIGN_IN || window.location.origin,
      redirectSignOut: import.meta.env.VITE_REDIRECT_SIGN_OUT || window.location.origin,
      responseType: 'code'
    }
  }
};

export default amplifyConfig;