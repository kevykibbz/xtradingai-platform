import React, { useState, useEffect, useRef } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Plus, Edit, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useDerivAPI } from '@/contexts/DerivContext';
import { cn } from '@/lib/utils';

const OpenPositions = ({ openPositions, onClosePosition, onUpdatePosition, isMobileOpen, onMobileToggle }) => {
  const [isMinimized, setIsMinimized] = useState(true); // Start with sidebar closed by default

  // For mobile, use external control if provided, otherwise use internal state
  const isMobileMinimized = onMobileToggle !== undefined ? !isMobileOpen : isMinimized;
  const setMobileMinimized = onMobileToggle !== undefined
    ? (val) => { if (!val) onMobileToggle(true); else onMobileToggle(false); }
    : setIsMinimized;
  const [activeTab, setActiveTab] = useState('open'); // 'open' or 'history'
  const [closedPositions, setClosedPositions] = useState([]);
  const { toast } = useToast();

  // Sync activeTab with ref to persist across remounts
  useEffect(() => {
    const savedTab = localStorage.getItem('deriv_active_tab');
    if (savedTab === 'open' || savedTab === 'history') {
      setActiveTab(savedTab);
    }
  }, []);

  // Save activeTab to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('deriv_active_tab', activeTab);
  }, [activeTab]);

  // Load closed positions from localStorage on mount and when positions change
  useEffect(() => {
    try {
      const saved = localStorage.getItem('deriv_closed_positions');
      if (saved) {
        const parsed = JSON.parse(saved);
        setClosedPositions(parsed);
      }
    } catch (e) {
      console.error('Error loading closed positions:', e);
    }
  }, []);

  // Save closed positions to localStorage whenever they change
  useEffect(() => {
    if (closedPositions.length > 0) {
      try {
        localStorage.setItem('deriv_closed_positions', JSON.stringify(closedPositions));
      } catch (e) {
        console.error('Error saving closed positions:', e);
      }
    }
  }, [closedPositions]);

  // Listen for position closures and add to history
  useEffect(() => {
    const handlePositionClosed = (position) => {
      setClosedPositions(prev => {
        // Avoid duplicates
        if (prev.some(p => p.contract_id === position.contract_id)) {
          return prev;
        }
        return [{ ...position, closed_at: Date.now() }, ...prev].slice(0, 100); // Keep last 100
      });
    };

    // This will be called from parent when a position is closed
    window.addEventListener('position-closed', handlePositionClosed);
    return () => window.removeEventListener('position-closed', handlePositionClosed);
  }, []);

  const hasOpenPositions = openPositions && openPositions.length > 0;
  const hasHistory = closedPositions && closedPositions.length > 0;

  // Debug: Log when component receives openPositions
  useEffect(() => {
    console.log('[OpenPositions] Component state:', {
      openPositionsCount: openPositions?.length || 0,
      hasOpenPositions,
      hasHistory,
      closedPositionsCount: closedPositions?.length || 0
    });
  }, [openPositions, hasOpenPositions, hasHistory, closedPositions]);

  // Always show the component, even when empty, so users can see it's available
  // Show "No open positions" message instead of hiding completely
  const totalPL = hasOpenPositions ? openPositions.reduce((sum, pos) => sum + (pos.profit || 0), 0) : 0;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value || 0);
  };

  const getContractTypeLabel = (contractType, tradeType) => {
    const labels = {
      'CALL': 'Rise',
      'PUT': 'Fall',
      'ACCU': 'Accumulators',
      'TURBOSLONG': 'Up',
      'TURBOSSHORT': 'Down',
      'DIGITMATCH': 'Matches',
      'DIGITDIFF': 'Differs',
      'DIGITEVEN': 'Even',
      'DIGITODD': 'Odd',
      'DIGITOVER': 'Over',
      'DIGITUNDER': 'Under',
      'ONETOUCH': 'Touch',
      'NOTOUCH': 'No Touch',
      'EXPIRYRANGE': 'Ends In',
      'EXPIRYMISS': 'Ends Out',
      'RANGE': 'Stays In',
      'UPORDOWN': 'Goes Out',
      'VANILLALONGCALL': 'Call',
      'VANILLALONGPUT': 'Put',
    };
    return labels[contractType] || contractType;
  };

  const getDurationLabel = (duration, durationUnit) => {
    if (durationUnit === 't') {
      return `${duration} Tick${duration !== 1 ? 's' : ''}`;
    }
    const units = {
      's': 'Second',
      'm': 'Minute',
      'h': 'Hour',
      'd': 'Day',
    };
    return `${duration} ${units[durationUnit] || durationUnit}${duration !== 1 ? 's' : ''}`;
  };

  return (
    <>
      {/* Minimized Button - Always visible when minimized (Desktop) */}
      {isMinimized && (
        <button
          onClick={() => setIsMinimized(false)}
          className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-white border-l border-t border-b border-gray-200 shadow-lg rounded-l-lg p-2 hover:bg-gray-50 transition-colors"
          aria-label="Expand positions"
        >
          <div className="flex flex-col items-center gap-1">
            <BarChart3 className="h-5 w-5 text-gray-600" />
            {hasOpenPositions && (
              <span className="text-xs font-semibold text-gray-800">{openPositions.length}</span>
            )}
          </div>
        </button>
      )}

      {/* Mobile: Drawer overlay when open */}
      {!isMobileMinimized && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 z-40"
          onClick={() => setMobileMinimized(true)}
        />
      )}

      {/* Desktop: Sidebar - Only render on desktop, completely hidden on mobile */}
      {/* Only render desktop sidebar when NOT in mobile mode (onMobileToggle undefined = desktop mode) */}
      {onMobileToggle === undefined && !isMinimized && (
        <div className="hidden md:flex bg-white border-r border-gray-200 flex flex-col shadow-lg transition-all duration-300 w-80">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 flex-1">
              {hasOpenPositions && hasHistory && (
                <div className="flex gap-1 border border-gray-300 rounded-lg p-0.5 bg-white">
                  <button
                    onClick={() => setActiveTab('open')}
                    className={cn(
                      "px-2 py-1 text-xs font-medium rounded transition-colors",
                      activeTab === 'open'
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    Open
                    {hasOpenPositions && (
                      <span className="ml-1 text-xs">({openPositions.length})</span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={cn(
                      "px-2 py-1 text-xs font-medium rounded transition-colors",
                      activeTab === 'history'
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    History
                    {hasHistory && (
                      <span className="ml-1 text-xs">({closedPositions.length})</span>
                    )}
                  </button>
                </div>
              )}
              {(!hasOpenPositions || !hasHistory) && (
                <>
                  <h3 className="font-semibold text-sm text-gray-800">
                    {hasOpenPositions ? 'Open positions' : 'Trade History'}
                  </h3>
                  {hasOpenPositions && (
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                      {openPositions.length}
                    </span>
                  )}
                  {hasHistory && !hasOpenPositions && (
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                      {closedPositions.length}
                    </span>
                  )}
                </>
              )}
            </div>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-gray-200 rounded transition-colors ml-2"
              aria-label={isMinimized ? "Expand" : "Minimize"}
            >
              {isMinimized ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
            </button>
          </div>

          {/* Positions List */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
            {activeTab === 'open' && hasOpenPositions && openPositions.map((position) => {
              const isProfit = (position.profit || 0) >= 0;
              const contractValue = (position.buy_price || 0) + (position.profit || 0);

              return (
                <div
                  key={position.contract_id}
                  className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  {/* Asset and Contract Type */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {position.display_name || position.symbol || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getContractTypeLabel(position.contract_type, position.trade_type)}
                          {position.growth_rate && ` ${(position.growth_rate * 100).toFixed(0)}%`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Duration */}
                  {position.duration && (
                    <div className="mb-2">
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                        {getDurationLabel(position.duration, position.duration_unit || 't')}
                      </span>
                    </div>
                  )}

                  {/* Financial Details */}
                  <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Stake:</span>
                      <span className="text-xs font-semibold text-gray-800">
                        {formatCurrency(position.buy_price || position.stake || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Contract value:</span>
                      <span className={cn(
                        "text-xs font-semibold flex items-center gap-1",
                        isProfit ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(contractValue)}
                        {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Total profit/loss:</span>
                      <span className={cn(
                        "text-xs font-bold flex items-center gap-1",
                        isProfit ? "text-green-600" : "text-red-600"
                      )}>
                        {isProfit ? '+' : ''}{formatCurrency(position.profit || 0)}
                        {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      </span>
                    </div>
                    {position.take_profit && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Take profit:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">—</span>
                          <button className="p-0.5 hover:bg-gray-200 rounded">
                            <Edit className="h-3 w-3 text-gray-500" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sell Button */}
                  {position.is_sellable === false ? (
                    <div className="w-full text-center py-2 px-3 bg-gray-100 border border-gray-300 rounded-md">
                      <p className="text-xs text-gray-600 font-medium">
                        Cannot Sell
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Will close at expiry
                      </p>
                    </div>
                  ) : (
                    <Button
                      onClick={() => onClosePosition(position.contract_id)}
                      className={cn(
                        "w-full text-sm font-semibold",
                        isProfit
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : "bg-red-600 hover:bg-red-700 text-white"
                      )}
                      size="sm"
                    >
                      Sell {formatCurrency(position.sell_price || contractValue)}
                    </Button>
                  )}
                </div>
              );
            })}

            {activeTab === 'history' && hasHistory && closedPositions.map((position) => {
              const isProfit = (position.profit || 0) >= 0;
              const contractValue = (position.buy_price || 0) + (position.profit || 0);
              const closedDate = position.closed_at ? new Date(position.closed_at) : null;

              return (
                <div
                  key={position.contract_id}
                  className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors opacity-75"
                >
                  {/* Asset and Contract Type */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-semibold text-gray-600">
                          {position.display_name || position.symbol || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getContractTypeLabel(position.contract_type, position.trade_type)}
                          {position.growth_rate && ` ${(position.growth_rate * 100).toFixed(0)}%`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Closed Date */}
                  {closedDate && (
                    <div className="mb-2">
                      <span className="text-xs text-gray-500">
                        Closed: {closedDate.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Financial Details */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Stake:</span>
                      <span className="text-xs font-semibold text-gray-600">
                        {formatCurrency(position.buy_price || position.stake || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Final value:</span>
                      <span className={cn(
                        "text-xs font-semibold flex items-center gap-1",
                        isProfit ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(contractValue)}
                        {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Profit/loss:</span>
                      <span className={cn(
                        "text-xs font-bold flex items-center gap-1",
                        isProfit ? "text-green-600" : "text-red-600"
                      )}>
                        {isProfit ? '+' : ''}{formatCurrency(position.profit || 0)}
                        {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {activeTab === 'open' && !hasOpenPositions && (
              <div className="p-8 text-center text-gray-500 text-sm">
                No open positions
              </div>
            )}

            {activeTab === 'history' && !hasHistory && (
              <div className="p-8 text-center text-gray-500 text-sm">
                No trade history
              </div>
            )}
          </div>

          {/* Footer with Total P/L */}
          {activeTab === 'open' && hasOpenPositions && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-600">
                  {openPositions.length} open position{openPositions.length !== 1 ? 's' : ''}
                </span>
                <span className={cn(
                  "text-sm font-bold",
                  totalPL >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  Total P/L: {totalPL >= 0 ? '+' : ''}{formatCurrency(totalPL)}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'history' && hasHistory && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">
                  {closedPositions.length} closed position{closedPositions.length !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-gray-500">
                  Viewing history
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile: Drawer from right side - Only show when onMobileToggle is provided */}
      {onMobileToggle !== undefined && (
        <div className={cn(
          "md:hidden fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col",
          isMobileMinimized ? "translate-x-full" : "translate-x-0"
        )}>
          {/* Mobile Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex items-center gap-2 flex-1">
              <div className="flex gap-1 border border-gray-300 rounded-lg p-0.5 bg-white">
                <button
                  onClick={() => setActiveTab('open')}
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded transition-colors",
                    activeTab === 'open'
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  Open
                  {hasOpenPositions && (
                    <span className="ml-1 text-xs">({openPositions.length})</span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded transition-colors",
                    activeTab === 'history'
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  History
                  {hasHistory && (
                    <span className="ml-1 text-xs">({closedPositions.length})</span>
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={() => setMobileMinimized(true)}
              className="p-1 hover:bg-gray-200 rounded transition-colors ml-2"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mobile Positions List */}
          <div className="flex-1 overflow-y-auto pb-20" style={{ maxHeight: 'calc(100vh - 250px)' }}>
            {activeTab === 'open' && hasOpenPositions && openPositions.map((position) => {
              const isProfit = (position.profit || 0) >= 0;
              const contractValue = (position.buy_price || 0) + (position.profit || 0);

              return (
                <div
                  key={position.contract_id}
                  className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  {/* Asset and Contract Type */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {position.display_name || position.symbol || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getContractTypeLabel(position.contract_type, position.trade_type)}
                          {position.growth_rate && ` ${(position.growth_rate * 100).toFixed(0)}%`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Duration */}
                  {position.duration && (
                    <div className="mb-2">
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                        {getDurationLabel(position.duration, position.duration_unit || 't')}
                      </span>
                    </div>
                  )}

                  {/* Financial Details */}
                  <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Stake:</span>
                      <span className="text-xs font-semibold text-gray-800">
                        {formatCurrency(position.buy_price || position.stake || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Contract value:</span>
                      <span className={cn(
                        "text-xs font-semibold flex items-center gap-1",
                        isProfit ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(contractValue)}
                        {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Total profit/loss:</span>
                      <span className={cn(
                        "text-xs font-bold flex items-center gap-1",
                        isProfit ? "text-green-600" : "text-red-600"
                      )}>
                        {isProfit ? '+' : ''}{formatCurrency(position.profit || 0)}
                        {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      </span>
                    </div>
                    {position.take_profit && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Take profit:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">—</span>
                          <button className="p-0.5 hover:bg-gray-200 rounded">
                            <Edit className="h-3 w-3 text-gray-500" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sell Button */}
                  {position.is_sellable === false ? (
                    <div className="w-full text-center py-2 px-3 bg-gray-100 border border-gray-300 rounded-md">
                      <p className="text-xs text-gray-600 font-medium">
                        Cannot Sell
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Will close at expiry
                      </p>
                    </div>
                  ) : (
                    <Button
                      onClick={() => onClosePosition(position.contract_id)}
                      className={cn(
                        "w-full text-sm font-semibold",
                        isProfit
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : "bg-red-600 hover:bg-red-700 text-white"
                      )}
                      size="sm"
                    >
                      Sell {formatCurrency(position.sell_price || contractValue)}
                    </Button>
                  )}
                </div>
              );
            })}

            {activeTab === 'history' && hasHistory && closedPositions.map((position) => {
              const isProfit = (position.profit || 0) >= 0;
              const contractValue = (position.buy_price || 0) + (position.profit || 0);
              const closedDate = position.closed_at ? new Date(position.closed_at) : null;

              return (
                <div
                  key={position.contract_id}
                  className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors opacity-75"
                >
                  {/* Asset and Contract Type */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-semibold text-gray-600">
                          {position.display_name || position.symbol || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getContractTypeLabel(position.contract_type, position.trade_type)}
                          {position.growth_rate && ` ${(position.growth_rate * 100).toFixed(0)}%`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Closed Date */}
                  {closedDate && (
                    <div className="mb-2">
                      <span className="text-xs text-gray-500">
                        Closed: {closedDate.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Financial Details */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Stake:</span>
                      <span className="text-xs font-semibold text-gray-600">
                        {formatCurrency(position.buy_price || position.stake || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Final value:</span>
                      <span className={cn(
                        "text-xs font-semibold flex items-center gap-1",
                        isProfit ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(contractValue)}
                        {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Profit/loss:</span>
                      <span className={cn(
                        "text-xs font-bold flex items-center gap-1",
                        isProfit ? "text-green-600" : "text-red-600"
                      )}>
                        {isProfit ? '+' : ''}{formatCurrency(position.profit || 0)}
                        {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {activeTab === 'open' && !hasOpenPositions && (
              <div className="p-8 text-center text-gray-500 text-sm">
                No open positions
              </div>
            )}

            {activeTab === 'history' && !hasHistory && (
              <div className="p-8 text-center text-gray-500 text-sm">
                No trade history
              </div>
            )}
          </div>

          {/* Mobile Footer with Total P/L */}
          {activeTab === 'open' && hasOpenPositions && (
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-600">
                  {openPositions.length} open position{openPositions.length !== 1 ? 's' : ''}
                </span>
                <span className={cn(
                  "text-sm font-bold",
                  totalPL >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  Total P/L: {totalPL >= 0 ? '+' : ''}{formatCurrency(totalPL)}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'history' && hasHistory && (
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">
                  {closedPositions.length} closed position{closedPositions.length !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-gray-500">
                  Viewing history
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default OpenPositions;
