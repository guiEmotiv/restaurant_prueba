import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { ToastProvider } from './contexts/ToastContext';
import { SimpleAuthProvider } from './contexts/SimpleAuthContext';
import amplifyConfig from './config/amplify';
import Layout from './components/Layout';
import LoginForm from './components/auth/LoginForm';
import ProtectedRoute from './components/auth/ProtectedRoute';
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

// Debug environment variables
console.log('API Configuration Debug:');
console.log('  VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('  API_BASE_URL:', import.meta.env.VITE_API_URL || 'http://44.248.47.186/api/v1');
console.log('  MODE:', import.meta.env.MODE);
console.log('  PROD:', import.meta.env.PROD);
console.log('  Timestamp:', new Date().toISOString());

// Debug Cognito environment variables
console.log('Cognito Configuration Debug:');
console.log('  VITE_AWS_REGION:', import.meta.env.VITE_AWS_REGION);
console.log('  VITE_AWS_COGNITO_USER_POOL_ID:', import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID);
console.log('  VITE_AWS_COGNITO_APP_CLIENT_ID:', import.meta.env.VITE_AWS_COGNITO_APP_CLIENT_ID);

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
          {/* Dashboard */}
          <Route path="/" element={
            <>
              {console.log('🔍 Rendering Dashboard route...')}
              <Dashboard />
            </>
          } />

          {/* Configuration routes */}
          <Route path="/units" element={
            <ProtectedRoute requiredPermission="canManageConfig">
              <Units />
            </ProtectedRoute>
          } />
          <Route path="/zones" element={
            <ProtectedRoute requiredPermission="canManageConfig">
              <Zones />
            </ProtectedRoute>
          } />
          <Route path="/tables" element={
            <ProtectedRoute requiredPermission="canManageConfig">
              <Tables />
            </ProtectedRoute>
          } />
          <Route path="/waiters" element={
            <ProtectedRoute requiredPermission="canManageConfig">
              <Waiters />
            </ProtectedRoute>
          } />
          <Route path="/containers" element={
            <ProtectedRoute requiredPermission="canManageConfig">
              <Containers />
            </ProtectedRoute>
          } />

          {/* Inventory routes */}
          <Route path="/groups" element={
            <ProtectedRoute requiredPermission="canManageInventory">
              <Groups />
            </ProtectedRoute>
          } />
          <Route path="/ingredients" element={
            <ProtectedRoute requiredPermission="canManageInventory">
              <Ingredients />
            </ProtectedRoute>
          } />
          <Route path="/recipes" element={
            <ProtectedRoute requiredPermission="canManageInventory">
              <Recipes />
            </ProtectedRoute>
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
            <ProtectedRoute requiredPermission="canViewKitchen">
              <Kitchen />
            </ProtectedRoute>
          } />
          <Route path="/table-status" element={
            <ProtectedRoute requiredPermission="canViewTableStatus">
              <TableStatus />
            </ProtectedRoute>
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
            <ProtectedRoute requiredPermission="canViewHistory">
              <PaymentHistory />  
            </ProtectedRoute>
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
  console.log('🚀 App component rendering...');
  console.log('🚀 Cognito configured:', isCognitoConfigured);
  console.log('🚀 Window location:', window.location.href);
  console.log('🚀 Document ready state:', document.readyState);
  
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