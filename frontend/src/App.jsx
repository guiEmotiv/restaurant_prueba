import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './components/auth/Login';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Categories from './pages/config/Categories';
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

// App content component that handles authenticated routing
const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        {/* Dashboard - Admin only by default, but we'll allow all roles for now */}
        <Route path="/" element={
          <ProtectedRoute requiredView="dashboard">
            <Dashboard />
          </ProtectedRoute>
        } />

        {/* Admin only routes - Configuration */}
        <Route path="/categories" element={
          <ProtectedRoute requiredView="categories">
            <Categories />
          </ProtectedRoute>
        } />
        <Route path="/units" element={
          <ProtectedRoute requiredView="units">
            <Units />
          </ProtectedRoute>
        } />
        <Route path="/zones" element={
          <ProtectedRoute requiredView="zones">
            <Zones />
          </ProtectedRoute>
        } />
        <Route path="/tables" element={
          <ProtectedRoute requiredView="tables">
            <Tables />
          </ProtectedRoute>
        } />

        {/* Admin only routes - Inventory */}
        <Route path="/groups" element={
          <ProtectedRoute requiredView="groups">
            <Groups />
          </ProtectedRoute>
        } />
        <Route path="/ingredients" element={
          <ProtectedRoute requiredView="ingredients">
            <Ingredients />
          </ProtectedRoute>
        } />
        <Route path="/recipes" element={
          <ProtectedRoute requiredView="recipes">
            <Recipes />
          </ProtectedRoute>
        } />

        {/* Mesero accessible routes */}
        <Route path="/orders" element={
          <ProtectedRoute requiredView="orders">
            <Orders />
          </ProtectedRoute>
        } />
        <Route path="/orders/:id" element={
          <ProtectedRoute requiredView="orders">
            <OrderDetail />
          </ProtectedRoute>
        } />
        <Route path="/orders/:id/payment" element={
          <ProtectedRoute requiredView="orders">
            <Payment />
          </ProtectedRoute>
        } />
        <Route path="/orders/:id/receipt" element={
          <ProtectedRoute requiredView="orders">
            <OrderReceipt />
          </ProtectedRoute>
        } />
        <Route path="/kitchen" element={
          <ProtectedRoute requiredView="kitchen">
            <Kitchen />
          </ProtectedRoute>
        } />

        {/* Cajero accessible routes */}
        <Route path="/payments" element={
          <ProtectedRoute requiredView="payments">
            <Payments />
          </ProtectedRoute>
        } />
        <Route path="/payment-history" element={
          <ProtectedRoute requiredView="payment-history">
            <PaymentHistory />
          </ProtectedRoute>
        } />

        {/* Catch all - redirect to login */}
        <Route path="*" element={<Login />} />
      </Routes>
    </Layout>
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