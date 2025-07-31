# AWS Cognito Integration Guide

## Overview
This guide explains how to properly configure AWS Cognito authentication with the restaurant management system.

## Prerequisites
1. AWS Account with Cognito User Pool created
2. User Pool configured with:
   - Username attributes: username
   - Required attributes: email
   - User groups: `administradores` (admins) and `meseros` (waiters)

## Configuration Steps

### 1. Frontend Configuration (React)

Update the frontend environment file `/frontend/.env` with your actual Cognito values:

```env
# AWS Cognito Configuration
VITE_AWS_REGION=us-east-1
VITE_AWS_COGNITO_USER_POOL_ID=us-east-1_YourPoolId
VITE_AWS_COGNITO_APP_CLIENT_ID=YourAppClientId

# API Configuration
VITE_API_URL=http://localhost:8000
```

### 2. Backend Configuration (Django)

Update the backend environment file `/backend/.env` with the same Cognito values:

```env
# AWS Cognito Configuration
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_YourPoolId
COGNITO_APP_CLIENT_ID=YourAppClientId
```

### 3. AWS Cognito Setup

1. **Create User Pool**:
   - Sign-in options: Username
   - Required attributes: email
   - Password policy: According to your requirements

2. **Create App Client**:
   - App type: Public client
   - Authentication flows: ALLOW_USER_PASSWORD_AUTH, ALLOW_REFRESH_TOKEN_AUTH

3. **Create User Groups**:
   - `administradores` - For admin users with full access
   - `meseros` - For waiters with limited access

4. **Create Users**:
   - Create users and assign them to appropriate groups
   - Users will need to change password on first login

## User Permissions

### Administrators (`administradores`)
- Full access to all modules
- Can manage configuration, inventory, orders, payments
- Can view dashboard and reports

### Waiters (`meseros`)
- Can manage orders
- Can view kitchen and table status
- Can process payments
- No access to configuration or inventory management

## Testing the Integration

1. **Start Backend**:
   ```bash
   cd backend
   python manage.py runserver
   ```

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Login Flow**:
   - Navigate to http://localhost:5173
   - Enter username and password
   - If first login, you'll be prompted to change password
   - After successful login, you'll be redirected based on your role

## Troubleshooting

### Common Issues

1. **"Authentication required" error**:
   - Ensure Cognito environment variables are set correctly
   - Check that the JWT token is being sent in Authorization header
   - Verify the user exists in Cognito and belongs to a group

2. **"Insufficient permissions" error**:
   - Verify the user belongs to the correct group in Cognito
   - Check that the group name matches exactly (`administradores` or `meseros`)

3. **Data not loading after login**:
   - Check browser console for API errors
   - Verify CORS settings allow your frontend URL
   - Ensure backend middleware is properly configured

### Debug Tips

- Check browser console for authentication logs
- Monitor Django console for authentication middleware logs
- Use AWS CloudWatch to monitor Cognito authentication events

## Security Best Practices

1. Never commit `.env` files to version control
2. Use strong passwords for Cognito users
3. Regularly rotate App Client secrets
4. Enable MFA for admin users
5. Monitor failed authentication attempts

## Additional Resources

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [AWS Amplify Auth Documentation](https://docs.amplify.aws/react/build-a-backend/auth/)