import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Investments from './pages/Investments';
import Reports from './pages/Reports';  // Main container
import Overview from './pages/Reports/Overview';  // Tab 1
import Performance from './pages/Reports/Performance';  // Tab 2
import RiskAnalysis from './pages/Reports/RiskAnalysis';  // Tab 3
import Benchmark from './pages/Reports/Benchmark';  // Tab 4
import AI from './pages/AIInsights';
import Settings from './pages/Settings';
import './styles/ticker.css';


function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isAuthenticated = () => {
    return localStorage.getItem('firebaseToken') !== null;
  };

  const AuthLayout = ({ children }: { children: React.ReactNode }) => {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    );
  };

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated() ? (
              <AuthLayout><Dashboard /></AuthLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        
        <Route
          path="/investments"
          element={
            isAuthenticated() ? (
              <AuthLayout><Investments /></AuthLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        
        {/* Reports Routes with nested routing */}
        <Route
          path="/reports"
          element={
            isAuthenticated() ? (
              <AuthLayout><Reports /></AuthLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="performance" element={<Performance />} />
          <Route path="risk-analysis" element={<RiskAnalysis />} />
          <Route path="benchmark" element={<Benchmark />} />
        </Route>
        
        <Route
          path="/ai"
          element={
            isAuthenticated() ? (
              <AuthLayout><AI /></AuthLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        
        <Route
          path="/settings"
          element={
            isAuthenticated() ? (
              <AuthLayout><Settings /></AuthLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
