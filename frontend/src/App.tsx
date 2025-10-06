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
import Reports from './pages/Reports';
import AI from './pages/AI';
import Settings from './pages/Settings';

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
        <Route
          path="/reports"
          element={
            isAuthenticated() ? (
              <AuthLayout><Reports /></AuthLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
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
