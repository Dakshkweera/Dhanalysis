interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'profit' | 'loss' | 'neutral';
  icon?: string;
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  color = 'neutral',
  icon 
}: MetricCardProps) {
  
  const colorClasses = {
    profit: 'from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200 dark:border-emerald-800',
    loss: 'from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20 border-rose-200 dark:border-rose-800',
    neutral: 'from-slate-50 to-gray-50 dark:from-slate-900/20 dark:to-gray-900/20 border-slate-200 dark:border-slate-800'
  };

  const valueColorClasses = {
    profit: 'text-green-600 dark:text-green-400',
    loss: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-800 dark:text-white'
  };

  const trendIcon = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '';

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-6 border shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
          {title}
        </h3>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      
      <div className={`text-3xl font-bold mb-2 ${valueColorClasses[color]}`}>
        {trendIcon} {value}
      </div>
      
      {subtitle && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}

export default MetricCard;
