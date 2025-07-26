import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import amplifyConfig from './config/amplify';
import Layout from './components/Layout';
import LoginForm from './components/auth/LoginForm';
import ProtectedRoute from './components/auth/ProtectedRoute';
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

// Configure Amplify
Amplify.configure(amplifyConfig);

const AppContent = () => {
  return (
    <LoginForm>
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

          {/* Payment routes */}
          <Route path="/payments" element={
            <ProtectedRoute requiredPermission="canManagePayments">
              <Payments />
            </ProtectedRoute>
          } />
          <Route path="/payment-history" element={
            <ProtectedRoute requiredPermission="canViewHistory">
              <PaymentHistory />  
            </ProtectedRoute>
          } />

          {/* Redirect to orders for unauthorized access */}
          <Route path="*" element={
            <ProtectedRoute requiredPermission="canManageOrders">
              <Orders />
            </ProtectedRoute>
          } />
        </Routes>
      </Layout>
    </LoginForm>
  );
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