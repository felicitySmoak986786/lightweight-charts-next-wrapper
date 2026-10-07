'use client';

export interface TopBarProps {
  symbol: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  dark: boolean;
  onToggleTheme: () => void;
  onBuy: () => void;
  onSell: () => void;
}

function formatPrice(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TopBar({
  symbol,
  exchange,
  price,
  change,
  changePercent,
  dark,
  onToggleTheme,
  onBuy,
  onSell,
}: TopBarProps) {
  const positive = change >= 0;
  return (
    <header className="ao-topbar">
      <div className="ao-symbol">
        <div className="ao-symbol-name">
          {symbol}
          <span className="exch">{exchange}</span>
        </div>
        <div className="ao-quote">
          <span className="ao-ltp">{formatPrice(price)}</span>
          <span className={`ao-change ${positive ? 'up' : 'down'}`}>
            {positive ? '+' : ''}
            {formatPrice(change)} ({positive ? '+' : ''}
            {changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      <div className="ao-topbar-actions">
        <button type="button" className="ao-btn buy" onClick={onBuy}>
          BUY
        </button>
        <button type="button" className="ao-btn sell" onClick={onSell}>
          SELL
        </button>
        <button
          type="button"
          className="ao-btn icon"
          title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={onToggleTheme}
        >
          {dark ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 14.5A8 8 0 019.5 4a7 7 0 108.5 10.5z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
