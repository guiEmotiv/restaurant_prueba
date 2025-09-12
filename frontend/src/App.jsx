import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import amplifyConfig from './config/amplify';
import Layout from './components/Layout';
import LoginForm from './components/auth/LoginForm';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleProtectedRoute from './components/auth/RoleProtectedRoute';
import RoleValidator from './components/auth/RoleValidator';
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


// Configure AWS Amplify
Amplify.configure(amplifyConfig);

// 🔐 AWS Cognito Configuration - Validate credentials
const isCognitoConfigured = (() => {
  const hasCredentials = !!(
    import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID && 
    import.meta.env.VITE_AWS_COGNITO_APP_CLIENT_ID
  );
  
  if (!hasCredentials) {
    console.error('🚫 AWS Cognito credentials not configured');
    console.log('Required environment variables:');
    console.log('- VITE_AWS_COGNITO_USER_POOL_ID');
    console.log('- VITE_AWS_COGNITO_APP_CLIENT_ID');
    console.log('');
    console.log('Obtén estas credenciales de AWS Console > Cognito > User Pools');
  } else {
    // AWS Cognito authentication configured
  }
  
  return hasCredentials;
})();


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
          <Route path="/dashboard-operativo" element={
            <RoleProtectedRoute requiredPermission="canViewDashboard">
              <DashboardOperativo />
            </RoleProtectedRoute>
          } />
          <Route path="/dashboard-financiero" element={
            <RoleProtectedRoute requiredPermission="canViewDashboard">
              <DashboardFinanciero />
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
          <Route path="/containers" element={
            <RoleProtectedRoute requiredPermission="canManageConfig">
              <Containers />
            </RoleProtectedRoute>
          } />
          <Route path="/printer-management" element={
            <RoleProtectedRoute requiredPermission="canManageConfig">
              <PrinterManagement />
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
          <Route path="/operations" element={
            <RoleProtectedRoute requiredPermission="canManageOrders">
              <OrderManagement />
            </RoleProtectedRoute>
          } />

          {/* Payment routes */}
          <Route path="/payment-history" element={
            <RoleProtectedRoute requiredPermission="canViewHistory">
              <PaymentHistory />  
            </RoleProtectedRoute>
          } />
          
          <Route path="/cashier-payment" element={
            <RoleProtectedRoute requiredPermission="canProcessPayment">
              <CashierPayment />  
            </RoleProtectedRoute>
          } />

          {/* Order Tracker route */}
          <Route path="/order-tracker" element={
            <RoleProtectedRoute requiredPermission="canViewHistory">
              <OrderTracker />  
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
    if (!isCognitoConfigured) {
      return (
        <div style={{ padding: '20px', color: 'red', textAlign: 'center' }}>
          <h2>Configuration Error</h2>
          <p>AWS Cognito credentials are required but not configured.</p>
          <p>Please set the following environment variables:</p>
          <ul style={{ textAlign: 'left', display: 'inline-block' }}>
            <li>VITE_AWS_COGNITO_USER_POOL_ID</li>
            <li>VITE_AWS_COGNITO_APP_CLIENT_ID</li>
          </ul>
        </div>
      );
    }

    return (
      <ToastProvider>
        <AuthProvider>
          <Router>
            <LoginForm>
              <RoleValidator>
                <Routes>
                  {/* All routes - Inside Layout */}
                  <Route path="/*" element={<AppContent />} />
                </Routes>
              </RoleValidator>
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