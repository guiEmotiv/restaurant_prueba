import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { ToastProvider } from './contexts/ToastContext';
import { OptionalAuthProvider } from './contexts/OptionalAuthContext';
import amplifyConfig from './config/amplify';
import Layout from './components/Layout';
import LoginForm from './components/auth/LoginForm';
import OptionalProtectedRoute from './components/auth/OptionalProtectedRoute';
import Dashboard from './pages/Dashboard';
import Units from './pages/config/Units';
import Zones from './pages/config/Zones';
import Tables from './pages/config/Tables';
import Groups from './pages/inventory/Groups';
import Ingredients from './pages/inventory/Ingredients';
import Recipes from './pages/inventory/Recipes';
import Orders from './pages/operation/Orders';
import OrderDetail from './pages/operation/OrderDetail';
import Payment from './pages/operation/Payment';
import Payments from './pages/operation/Payments';
import PaymentHistory from './pages/operation/PaymentHistory';
import OrderReceipt from './pages/operation/OrderReceipt';
import Kitchen from './pages/operation/Kitchen';
import TableStatus from './pages/operation/TableStatus';

// Configure Amplify only if Cognito is configured
// In Vite, we use import.meta.env and environment variables must start with VITE_
const isCognitoConfigured = import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID || 
                           import.meta.env.VITE_COGNITO_USER_POOL_ID;

if (isCognitoConfigured) {
  try {
    Amplify.configure(amplifyConfig);
    console.log('✅ AWS Amplify configured successfully');
  } catch (error) {
    console.warn('⚠️ Amplify configuration skipped:', error.message);
  }
} else {
  console.log('ℹ️ Running without AWS Cognito authentication');
}

const AppContent = () => {
  // Skip authentication if Cognito is not configured
  const content = (
    <Layout>
      <Routes>
          {/* Dashboard */}
          <Route path="/" element={
            <OptionalProtectedRoute requiredPermission="canViewDashboard">
              <Dashboard />
            </OptionalProtectedRoute>
          } />

          {/* Configuration routes */}
          <Route path="/units" element={
            <OptionalProtectedRoute requiredPermission="canManageConfig">
              <Units />
            </OptionalProtectedRoute>
          } />
          <Route path="/zones" element={
            <OptionalProtectedRoute requiredPermission="canManageConfig">
              <Zones />
            </OptionalProtectedRoute>
          } />
          <Route path="/tables" element={
            <OptionalProtectedRoute requiredPermission="canManageConfig">
              <Tables />
            </OptionalProtectedRoute>
          } />

          {/* Inventory routes */}
          <Route path="/groups" element={
            <OptionalProtectedRoute requiredPermission="canManageInventory">
              <Groups />
            </OptionalProtectedRoute>
          } />
          <Route path="/ingredients" element={
            <OptionalProtectedRoute requiredPermission="canManageInventory">
              <Ingredients />
            </OptionalProtectedRoute>
          } />
          <Route path="/recipes" element={
            <OptionalProtectedRoute requiredPermission="canManageInventory">
              <Recipes />
            </OptionalProtectedRoute>
          } />

          {/* Operation routes */}
          <Route path="/orders" element={
            <OptionalProtectedRoute requiredPermission="canManageOrders">
              <Orders />
            </OptionalProtectedRoute>
          } />
          <Route path="/orders/:id" element={
            <OptionalProtectedRoute requiredPermission="canManageOrders">
              <OrderDetail />
            </OptionalProtectedRoute>
          } />
          <Route path="/orders/:id/payment" element={
            <OptionalProtectedRoute requiredPermission="canManagePayments">
              <Payment />
            </OptionalProtectedRoute>
          } />
          <Route path="/orders/:id/receipt" element={
            <OptionalProtectedRoute requiredPermission="canManagePayments">
              <OrderReceipt />
            </OptionalProtectedRoute>
          } />
          <Route path="/kitchen" element={
            <OptionalProtectedRoute requiredPermission="canViewKitchen">
              <Kitchen />
            </OptionalProtectedRoute>
          } />
          <Route path="/table-status" element={
            <OptionalProtectedRoute requiredPermission="canViewTableStatus">
              <TableStatus />
            </OptionalProtectedRoute>
          } />

          {/* Payment routes */}
          <Route path="/payments" element={
            <OptionalProtectedRoute requiredPermission="canManagePayments">
              <Payments />
            </OptionalProtectedRoute>
          } />
          <Route path="/payment-history" element={
            <OptionalProtectedRoute requiredPermission="canViewHistory">
              <PaymentHistory />  
            </OptionalProtectedRoute>
          } />

          {/* Redirect to orders for unauthorized access */}
          <Route path="*" element={
            <OptionalProtectedRoute requiredPermission="canManageOrders">
              <Orders />
            </OptionalProtectedRoute>
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
      <OptionalAuthProvider>
        <Router>
          <AppContent />
        </Router>
      </OptionalAuthProvider>
    </ToastProvider>
  );
}

export default App;