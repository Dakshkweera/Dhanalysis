import { useState, useEffect } from 'react';
import { Menu, Moon, Sun, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;  // ✅ ADDED
}

function Header({ toggleSidebar, isSidebarOpen }: HeaderProps) {  // ✅ ADDED isSidebarOpen
  const [isDark, setIsDark] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('firebaseToken');
    localStorage.removeItem('userId');
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4">
      {/* LEFT SIDE */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
        >
          <Menu size={24} />
        </button>
        
        {/* ✅ SHOW APP NAME ONLY WHEN SIDEBAR IS CLOSED */}
        {!isSidebarOpen && (
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">
            Dhanalysis
          </h1>
        )}
      </div>

      {/* RIGHT SIDE */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}

export default Header;
