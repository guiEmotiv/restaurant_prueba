import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
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

const AppContent = () => {
  return (
    <Layout>
      <Routes>
        {/* Dashboard */}
        <Route path="/" element={<Dashboard />} />

        {/* Configuration routes */}
        <Route path="/categories" element={<Categories />} />
        <Route path="/units" element={<Units />} />
        <Route path="/zones" element={<Zones />} />
        <Route path="/tables" element={<Tables />} />

        {/* Inventory routes */}
        <Route path="/groups" element={<Groups />} />
        <Route path="/ingredients" element={<Ingredients />} />
        <Route path="/recipes" element={<Recipes />} />

        {/* Operation routes */}
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/orders/:id/payment" element={<Payment />} />
        <Route path="/orders/:id/receipt" element={<OrderReceipt />} />
        <Route path="/kitchen" element={<Kitchen />} />

        {/* Payment routes */}
        <Route path="/payments" element={<Payments />} />
        <Route path="/payment-history" element={<PaymentHistory />} />

        {/* Redirect to dashboard */}
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </Layout>
  );
};

function App() {
  return (
    <ToastProvider>
      <Router>
        <AppContent />
      </Router>
    </ToastProvider>
  );
}

export default App;