import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// Import all separate CSS files
import "./styles/global.css"; // Global variables & base styles
import "./styles/Navbar.css"; // Navbar styles
import "./styles/Footer.css"; // Footer styles
// More CSS files will be imported as we create them:
// import "./styles/Home.css";
// import "./styles/Login.css";
// import "./styles/Register.css";
// etc...

import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProviderProfileSetup from "./pages/ProviderProfileSetup";
import ServiceProviders from "./pages/ServiceProviders";
import ProviderDetail from "./pages/ProviderDetail";
import CustomerDashboard from "./pages/CustomerDashboard";
import ProviderDashboard from "./pages/ProviderDashboard";
import Chat from "./pages/Chat";
import BookingDetail from "./pages/BookingDetail";
import InstallPWA from "./components/InstallPWA";
import AdminDashboard from "./pages/AdminDashboard";

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-custom"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/provider-setup"
            element={
              <ProtectedRoute>
                <ProviderProfileSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/providers"
            element={
              <ProtectedRoute>
                <ServiceProviders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/provider/:id"
            element={
              <ProtectedRoute>
                <ProviderDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer-dashboard"
            element={
              <ProtectedRoute>
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/provider-dashboard"
            element={
              <ProtectedRoute>
                <ProviderDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:bookingId"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/booking/:id"
            element={
              <ProtectedRoute>
                <BookingDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
        <InstallPWA />
      </AuthProvider>
    </Router>
  );
}

export default App;
