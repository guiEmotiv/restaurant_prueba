import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, MockAuthProvider } from './contexts/AuthContext';
import amplifyConfig from './config/amplify';
import Layout from './components/Layout';
import LoginForm from './components/auth/LoginForm';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleProtectedRoute from './components/auth/RoleProtectedRoute';
import AuthLoadingScreen from './components/auth/AuthLoadingScreen';
import NoRoleError from './components/auth/NoRoleError';
import RoleValidator from './components/auth/RoleValidator';
import RoleBasedRedirect from './components/RoleBasedRedirect';
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
import Kitchen from './pages/operation/Kitchen';
import RestaurantOperations from './pages/operation/RestaurantOperations';


// Configure AWS Amplify
Amplify.configure(amplifyConfig);

// 🔐 AWS Cognito Configuration - OPTIMIZADO
const isCognitoConfigured = (() => {
  const hasCredentials = !!(
    import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID && 
    import.meta.env.VITE_AWS_COGNITO_APP_CLIENT_ID
  );
  
  const isAuthEnabled = (
    import.meta.env.VITE_DISABLE_AUTH === 'false' || 
    import.meta.env.VITE_FORCE_COGNITO === 'true'
  );
  
  const cognitoEnabled = hasCredentials && isAuthEnabled;
  
  
  return cognitoEnabled;
})();


const AppContent = () => {
  try {
    const content = (
      <Layout>
        <Routes>
          {/* Dashboards - Solo administradores */}
          <Route path="/" element={
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
          <Route path="/kitchen" element={
            <RoleProtectedRoute requiredPermission="canViewKitchen">
              <Kitchen />
            </RoleProtectedRoute>
          } />
          <Route path="/operations" element={
            <RoleProtectedRoute requiredPermission="canManageOrders">
              <RestaurantOperations />
            </RoleProtectedRoute>
          } />
          <Route path="/table-order" element={
            <RoleProtectedRoute requiredPermission="canManageOrders">
              <RestaurantOperations />
            </RoleProtectedRoute>
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
        <Router>
          {isCognitoConfigured ? (
            <LoginForm>
              <AuthProvider>
                <RoleValidator>
                  <AppContent />
                </RoleValidator>
              </AuthProvider>
            </LoginForm>
          ) : (
            <MockAuthProvider>
              <RoleValidator>
                <AppContent />
              </RoleValidator>
            </MockAuthProvider>
          )}
        </Router>
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