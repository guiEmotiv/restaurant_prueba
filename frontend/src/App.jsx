import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import amplifyConfig from './config/amplify';
import Layout from './components/Layout';
import LoginForm from './components/auth/LoginForm';
import ProtectedRoute from './components/auth/ProtectedRoute';
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

// Disable Cognito authentication temporarily - TODO: Configure with real AWS Cognito settings
const isCognitoConfigured = false;

console.log('ℹ️ AWS Cognito authentication disabled - direct access enabled');
console.log('⚠️ TODO: Configure real AWS Cognito settings and enable authentication');

const AppContent = () => {
  // Skip authentication if Cognito is not configured
  const content = (
    <Layout>
      <Routes>
          {/* Dashboard */}
          <Route path="/" element={
            <ProtectedRoute requiredPermission="canViewDashboard">
              <Dashboard />
            </ProtectedRoute>
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
  
  // Wrap with LoginForm only if Cognito is configured
  return isCognitoConfigured ? <LoginForm>{content}</LoginForm> : content;
};

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;