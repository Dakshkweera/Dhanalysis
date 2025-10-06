import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  bgColor?: string;
}

function MetricCard({ title, value, subtitle, icon: Icon, trend, bgColor }: MetricCardProps) {
  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600 dark:text-green-400';
    if (trend === 'down') return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-300';
  };

  const getIconBgColor = () => {
    if (trend === 'up') return 'bg-green-100 dark:bg-green-900/30';
    if (trend === 'down') return 'bg-red-100 dark:bg-red-900/30';
    return 'bg-gray-100 dark:bg-gray-700';
  };

  // Parse subtitle for multi-line display
  const subtitleLines = subtitle?.split('\n').filter(line => line.trim()) || [];

  return (
    <div className={`${bgColor || 'bg-white dark:bg-gray-800'} rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700`}>
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          {title}
        </h3>
        <div className={`p-2.5 rounded-lg ${getIconBgColor()}`}>
          <Icon size={20} className={getTrendColor()} strokeWidth={2.5} />
        </div>
      </div>

      <div className="space-y-3">
        <p className={`text-3xl font-bold ${getTrendColor()} tracking-tight`}>
          {value}
        </p>

        {subtitleLines.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-gray-700">
            {subtitleLines.map((line, index) => {
              // Check if line contains stock symbol (first line)
              if (index === 0 && !line.includes('₹') && !line.includes(':')) {
                return (
                  <p key={index} className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {line}
                  </p>
                );
              }
              // Other lines with values
              return (
                <p key={index} className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                  {line}
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MetricCard;
