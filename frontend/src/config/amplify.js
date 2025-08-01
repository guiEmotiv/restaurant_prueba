// AWS Amplify Configuration for Cognito
// Note: These values need to be configured in AWS Cognito console first

const amplifyConfig = {
  Auth: {
    Cognito: {
      // Region where your Cognito User Pool was created
      region: import.meta.env.VITE_AWS_REGION || 'us-west-2',
      
      // Cognito User Pool ID
      userPoolId: import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID || 'us-west-2_bdCwF60ZI',
      
      // Cognito User Pool App Client ID  
      userPoolClientId: import.meta.env.VITE_AWS_COGNITO_APP_CLIENT_ID || '4i9hrd7srgbqbtun09p43ncfn0',
      
      // Mandatory for user pool only
      loginWith: {
        username: true,
        email: false,
        phone: false
      }
    }
  }
};

export default amplifyConfig;