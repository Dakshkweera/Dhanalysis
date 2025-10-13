interface TimePeriodSelectorProps {
  selected: string;
  onChange: (period: string) => void;
}

function TimePeriodSelector({ selected, onChange }: TimePeriodSelectorProps) {
  const periods = [
    { label: '1M', value: '1M', days: 30 },
    { label: '3M', value: '3M', days: 90 },
    { label: '6M', value: '6M', days: 180 },
    { label: '1Y', value: '1Y', days: 365 },
    { label: '3Y', value: '3Y', days: 1095 },
    { label: '5Y', value: '5Y', days: 1825 },
    { label: 'All', value: 'All', days: 10000 },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
        Period:
      </span>
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {periods.map((period) => (
          <button
            key={period.value}
            onClick={() => onChange(period.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              selected === period.value
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default TimePeriodSelector;
