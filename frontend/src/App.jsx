import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { ToastProvider } from './contexts/ToastContext';
import { SimpleAuthProvider } from './contexts/SimpleAuthContext';
import amplifyConfig from './config/amplify';
import Layout from './components/Layout';
import LoginForm from './components/auth/LoginForm';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleProtectedRoute from './components/auth/RoleProtectedRoute';
import AuthLoadingScreen from './components/auth/AuthLoadingScreen';
import RoleBasedRedirect from './components/RoleBasedRedirect';
import Dashboard from './pages/Dashboard';
import Units from './pages/config/Units';
import Zones from './pages/config/Zones';
import Tables from './pages/config/Tables';
import Waiters from './pages/config/Waiters';
import Containers from './pages/config/Containers';
import Groups from './pages/inventory/Groups';
import Ingredients from './pages/inventory/Ingredients';
import Recipes from './pages/inventory/Recipes';
import Orders from './pages/operation/Orders';
import NewOrder from './pages/operation/NewOrder';
import OrderDetail from './pages/operation/OrderDetail';
import Payment from './pages/operation/Payment';
import PaymentHistory from './pages/operation/PaymentHistory';
import OrderReceipt from './pages/operation/OrderReceipt';
import Kitchen from './pages/operation/Kitchen';
import TableStatus from './pages/operation/TableStatus';
import TableOrderEcommerce from './pages/operation/TableOrderEcommerce';
import TableOrderEdit from './pages/operation/TableOrderEdit';
import TablePaymentEcommerce from './pages/operation/TablePaymentEcommerce';

// Debug environment variables with persistent logging
const logWithTimestamp = (message, data) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data);
  // Store in sessionStorage for persistent debugging
  const logs = JSON.parse(sessionStorage.getItem('app-debug-logs') || '[]');
  logs.push({ timestamp, message, data });
  sessionStorage.setItem('app-debug-logs', JSON.stringify(logs.slice(-50))); // Keep last 50 logs
};

logWithTimestamp('API Configuration Debug:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  API_BASE_URL: import.meta.env.VITE_API_URL || 'http://44.248.47.186/api/v1',
  MODE: import.meta.env.MODE,
  PROD: import.meta.env.PROD
});

logWithTimestamp('Cognito Configuration Debug:', {
  VITE_AWS_REGION: import.meta.env.VITE_AWS_REGION,
  VITE_AWS_COGNITO_USER_POOL_ID: import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID,
  VITE_AWS_COGNITO_APP_CLIENT_ID: import.meta.env.VITE_AWS_COGNITO_APP_CLIENT_ID
});

// Configure AWS Amplify
Amplify.configure(amplifyConfig);

// Enable Cognito authentication - Check if Cognito is properly configured
const isCognitoConfigured = !!(
  import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID && 
  import.meta.env.VITE_AWS_COGNITO_APP_CLIENT_ID
);

console.log('🔐 AWS Cognito authentication status:', isCognitoConfigured ? 'ENABLED' : 'DISABLED');
if (isCognitoConfigured) {
  console.log('✅ Cognito configuration found - authentication enabled');
} else {
  console.log('⚠️ Cognito environment variables missing - authentication disabled');
}

const AppContent = () => {
  console.log('🔍 AppContent rendering...');
  
  try {
    // Skip AuthContext entirely - let Authenticator handle everything
    const content = (
      <Layout>
        {console.log('🔍 Inside Layout wrapper...')}
        <Routes>
          {console.log('🔍 Inside Routes wrapper...')}
          {/* Dashboard - Solo administradores */}
          <Route path="/" element={
            <RoleProtectedRoute requiredPermission="canViewDashboard">
              {console.log('🔍 Rendering Dashboard route...')}
              <Dashboard />
            </RoleProtectedRoute>
          } />

          {/* Configuration routes - Solo administradores */}
          <Route path="/units" element={
            <RoleProtectedRoute requiredPermission="canManageConfig">
              <Units />
            </RoleProtectedRoute>
          } />
          <Route path="/zones" element={
            <RoleProtectedRoute requiredPermission="canManageConfig">
              <Zones />
            </RoleProtectedRoute>
          } />
          <Route path="/tables" element={
            <RoleProtectedRoute requiredPermission="canManageConfig">
              <Tables />
            </RoleProtectedRoute>
          } />
          <Route path="/waiters" element={
            <RoleProtectedRoute requiredPermission="canManageConfig">
              <Waiters />
            </RoleProtectedRoute>
          } />
          <Route path="/containers" element={
            <RoleProtectedRoute requiredPermission="canManageConfig">
              <Containers />
            </RoleProtectedRoute>
          } />

          {/* Inventory routes - Solo administradores */}
          <Route path="/groups" element={
            <RoleProtectedRoute requiredPermission="canManageInventory">
              <Groups />
            </RoleProtectedRoute>
          } />
          <Route path="/ingredients" element={
            <RoleProtectedRoute requiredPermission="canManageInventory">
              <Ingredients />
            </RoleProtectedRoute>
          } />
          <Route path="/recipes" element={
            <RoleProtectedRoute requiredPermission="canManageInventory">
              <Recipes />
            </RoleProtectedRoute>
          } />

          {/* Operation routes */}
          <Route path="/orders" element={
            <ProtectedRoute requiredPermission="canManageOrders">
              <Orders />
            </ProtectedRoute>
          } />
          <Route path="/orders/new" element={
            <ProtectedRoute requiredPermission="canManageOrders">
              <NewOrder />
            </ProtectedRoute>
          } />
          <Route path="/orders/:id/edit" element={
            <ProtectedRoute requiredPermission="canManageOrders">
              <NewOrder />
            </ProtectedRoute>
          } />
          <Route path="/orders/:id" element={
            <ProtectedRoute requiredPermission="canManageOrders">
              <OrderDetail />
            </ProtectedRoute>
          } />
          <Route path="/orders/:id/payment" element={
            <ProtectedRoute requiredPermission="canManagePayments">
              <Payment />
            </ProtectedRoute>
          } />
          <Route path="/orders/:id/receipt" element={
            <ProtectedRoute requiredPermission="canManagePayments">
              <OrderReceipt />
            </ProtectedRoute>
          } />
          <Route path="/kitchen" element={
            <RoleProtectedRoute requiredPermission="canViewKitchen">
              <Kitchen />
            </RoleProtectedRoute>
          } />
          <Route path="/table-status" element={
            <RoleProtectedRoute requiredPermission="canViewTableStatus">
              <TableStatus />
            </RoleProtectedRoute>
          } />
          <Route path="/table/:tableId/order-ecommerce" element={
            <ProtectedRoute requiredPermission="canManageOrders">
              <TableOrderEcommerce />
            </ProtectedRoute>
          } />
          <Route path="/table/:tableId/order-edit" element={
            <ProtectedRoute requiredPermission="canManageOrders">
              <TableOrderEdit />
            </ProtectedRoute>
          } />
          <Route path="/table/:tableId/payment-ecommerce" element={
            <ProtectedRoute requiredPermission="canManagePayments">
              <TablePaymentEcommerce />
            </ProtectedRoute>
          } />

          {/* Payment routes */}
          <Route path="/payment-history" element={
            <RoleProtectedRoute requiredPermission="canViewHistory">
              <PaymentHistory />  
            </RoleProtectedRoute>
          } />

          {/* Role-based redirect for unauthorized paths */}
          <Route path="*" element={
            <ProtectedRoute>
              <RoleBasedRedirect />
            </ProtectedRoute>
          } />
        </Routes>
    </Layout>
  );
  
  console.log('🔍 Content created successfully');
  return content;
  } catch (error) {
    console.error('❌ Error in AppContent:', error);
    console.error('Stack trace:', error.stack);
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h2>Error rendering app</h2>
        <p>{error.message}</p>
        <pre>{error.stack}</pre>
      </div>
    );
  }
};

function App() {
  logWithTimestamp('🚀 App component rendering...', {
    cognitoConfigured: isCognitoConfigured,
    location: window.location.href,
    readyState: document.readyState,
    userAgent: navigator.userAgent
  });
  
  try {
    return (
      <ToastProvider>
        {console.log('🚀 Inside ToastProvider...')}
        <Router>
          {console.log('🚀 Inside Router...')}
          {isCognitoConfigured ? (
            <LoginForm>
              {console.log('🚀 Inside LoginForm (authenticated)...')}
              <SimpleAuthProvider>
                {console.log('🚀 Inside SimpleAuthProvider...')}
                <AppContent />
              </SimpleAuthProvider>
            </LoginForm>
          ) : (
            <SimpleAuthProvider>
              {console.log('🚀 Inside SimpleAuthProvider (no auth)...')}
              <AppContent />
            </SimpleAuthProvider>
          )}
        </Router>
      </ToastProvider>
    );
  } catch (error) {
    console.error('❌ Error in App component:', error);
    console.error('Stack trace:', error.stack);
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h2>Critical error</h2>
        <p>{error.message}</p>
        <pre>{error.stack}</pre>
      </div>
    );
  }
}

export default App;