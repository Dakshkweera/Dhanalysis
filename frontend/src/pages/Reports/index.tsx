import { Outlet, NavLink } from 'react-router-dom';

function Reports() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          Portfolio Reports
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Comprehensive analytics and performance insights
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8">
          <NavLink
            to="/reports/overview"
            className={({ isActive }) =>
              `pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                isActive
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`
            }
          >
            📈 Overview
          </NavLink>

          <NavLink
            to="/reports/performance"
            className={({ isActive }) =>
              `pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                isActive
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`
            }
          >
            📊 Performance
          </NavLink>

          <NavLink
            to="/reports/risk-analysis"
            className={({ isActive }) =>
              `pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                isActive
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`
            }
          >
            ⚠️ Risk Analysis
          </NavLink>

          <NavLink
            to="/reports/benchmark"
            className={({ isActive }) =>
              `pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                isActive
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`
            }
          >
            🎯 Benchmark
          </NavLink>
        </nav>
      </div>

      {/* Child Route Content */}
      <Outlet />
    </div>
  );
}

export default Reports;
