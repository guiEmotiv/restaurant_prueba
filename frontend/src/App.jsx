import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginForm from './components/auth/LoginForm';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleBasedRedirect from './components/RoleBasedRedirect';
import Welcome from './pages/Welcome';
import DashboardOperativo from './pages/DashboardOperativo';
import DashboardFinanciero from './pages/DashboardFinanciero';
import Units from './pages/config/Units';
import Zones from './pages/config/Zones';
import Tables from './pages/config/Tables';
import Containers from './pages/config/Containers';
import Groups from './pages/inventory/Groups';
import Ingredients from './pages/inventory/Ingredients';
import Recipes from './pages/inventory/Recipes';
import PaymentHistory from './pages/operation/PaymentHistory';
import CashierPayment from './pages/operation/CashierPayment';
import OrderManagement from './pages/operation/OrderManagement/OrderManagement';
import OrderTracker from './pages/operation/OrderTracker';
import PrinterManagement from './pages/admin/PrinterManagement';
import UserManagement from './pages/admin/UserManagement';


// Django authentication configuration
console.log('✅ Django authentication configured');


const AppContent = () => {
  try {
    const content = (
      <Layout>
        <Routes>
          {/* Welcome Page - Available to all authenticated users */}
          <Route path="/" element={
            <ProtectedRoute>
              <Welcome />
            </ProtectedRoute>
          } />

          {/* Dashboard routes - Admins and Managers only */}
          <Route path="/dashboard-operativo" element={
            <ProtectedRoute requiredPermission="can_access_dashboard">
              <DashboardOperativo />
            </ProtectedRoute>
          } />
          <Route path="/dashboard-financiero" element={
            <ProtectedRoute requiredPermission="can_access_dashboard">
              <DashboardFinanciero />
            </ProtectedRoute>
          } />

          {/* Configuration routes - Admins only */}
          <Route path="/units" element={
            <ProtectedRoute requiredPermission="can_manage_users">
              <Units />
            </ProtectedRoute>
          } />
          <Route path="/zones" element={
            <ProtectedRoute requiredPermission="can_manage_users">
              <Zones />
            </ProtectedRoute>
          } />
          <Route path="/tables" element={
            <ProtectedRoute requiredPermission="can_manage_users">
              <Tables />
            </ProtectedRoute>
          } />
          <Route path="/containers" element={
            <ProtectedRoute requiredPermission="can_manage_users">
              <Containers />
            </ProtectedRoute>
          } />
          <Route path="/printer-management" element={
            <ProtectedRoute requiredPermission="can_manage_users">
              <PrinterManagement />
            </ProtectedRoute>
          } />
          <Route path="/user-management" element={
            <ProtectedRoute requiredPermission="can_manage_users">
              <UserManagement />
            </ProtectedRoute>
          } />

          {/* Inventory routes - Admins and Managers */}
          <Route path="/groups" element={
            <ProtectedRoute requiredPermission="can_access_dashboard">
              <Groups />
            </ProtectedRoute>
          } />
          <Route path="/ingredients" element={
            <ProtectedRoute requiredPermission="can_access_dashboard">
              <Ingredients />
            </ProtectedRoute>
          } />
          <Route path="/recipes" element={
            <ProtectedRoute requiredPermission="can_access_dashboard">
              <Recipes />
            </ProtectedRoute>
          } />

          {/* Operation routes - Admins, Managers, and Waiters */}
          <Route path="/operations" element={
            <ProtectedRoute requiredPermission="can_create_orders">
              <OrderManagement />
            </ProtectedRoute>
          } />

          {/* Payment routes */}
          <Route path="/payment-history" element={
            <ProtectedRoute requiredPermission="can_process_payments">
              <PaymentHistory />
            </ProtectedRoute>
          } />

          <Route path="/cashier-payment" element={
            <ProtectedRoute requiredPermission="can_process_payments">
              <CashierPayment />
            </ProtectedRoute>
          } />

          {/* Order Tracker route - Kitchen staff and cashiers */}
          <Route path="/order-tracker" element={
            <ProtectedRoute requiredPermission="can_process_payments">
              <OrderTracker />
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
  
  return content;
  } catch (error) {
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
  try {
    return (
      <ToastProvider>
        <AuthProvider>
          <Router>
            <LoginForm>
              <Routes>
                {/* All routes - Inside Layout */}
                <Route path="/*" element={<AppContent />} />
              </Routes>
            </LoginForm>
          </Router>
        </AuthProvider>
      </ToastProvider>
    );
  } catch (error) {
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