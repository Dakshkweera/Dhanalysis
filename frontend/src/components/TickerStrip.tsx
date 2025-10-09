import '../styles/ticker.css';

interface TickerStripProps {
  totalInvested: number;
  currentValue: number;
  totalReturn: number;
  totalHoldings: number;
}

function TickerStrip({ totalInvested, currentValue, totalReturn, totalHoldings }: TickerStripProps) {
  const isProfit = totalReturn >= 0;

  // Duplicate content for seamless loop
  const tickerContent = (
    <>
      <span className="mx-10">
        Current Value: <strong>₹{currentValue.toLocaleString()}</strong>
      </span>
      <span className="mx-10">
        Return: <strong className={isProfit ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
          {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
        </strong>
      </span>
      <span className="mx-10">
        Holdings: <strong>{totalHoldings} stocks</strong>
      </span>
      <span className="mx-10">
        Total Invested: <strong>₹{totalInvested.toLocaleString()}</strong>
      </span>
    </>
  );

  return (
    <div 
      className={`ticker-container rounded-lg py-4 mb-6 ${isProfit ? 'ticker-profit' : 'ticker-loss'}`}
    >
      <div className="ticker-content text-base font-semibold text-gray-800 dark:text-gray-100">
        {tickerContent}
        {tickerContent}
        {tickerContent}
      </div>
    </div>
  );
}

export default TickerStrip;
