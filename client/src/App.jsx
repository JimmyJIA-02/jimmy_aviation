import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SpottingForm from './pages/SpottingForm';
import Planner from './pages/Planner';
import Statistics from './pages/Statistics';
import Gallery from './pages/Gallery';
import SpottingDetail from './pages/SpottingDetail';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Gallery />} />
      <Route path="/spotting/:id" element={<SpottingDetail />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={
        <ProtectedRoute><AdminLayout /></ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="new" element={<SpottingForm />} />
        <Route path="planner" element={<Planner />} />
        <Route path="statistics" element={<Statistics />} />
        <Route path="edit/:id" element={<SpottingForm />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}