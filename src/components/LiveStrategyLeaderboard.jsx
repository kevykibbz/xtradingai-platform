// components/LiveStrategyLeaderboard.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Trophy, Zap, Activity, X, ChevronLeft, ChevronRight } from 'lucide-react';

const TRADE_TYPES = [
  { id: 'rise_fall',     name: 'Rise / Fall',        color: 'text-green-700',  bg: 'bg-green-50' },
  { id: 'higher_lower',  name: 'Higher / Lower',     color: 'text-blue-700',   bg: 'bg-blue-50' },
  { id: 'touch_no_touch',name: 'Touch / No Touch',   color: 'text-purple-700', bg: 'bg-purple-50' },
  { id: 'digits',        name: 'Digits',             color: 'text-amber-700',  bg: 'bg-amber-50' },
  { id: 'accumulators',  name: 'Accumulators',       color: 'text-rose-700',   bg: 'bg-rose-50' },
  { id: 'multipliers',   name: 'Multipliers',        color: 'text-indigo-700', bg: 'bg-indigo-50' },
  { id: 'turbos',        name: 'Turbos',             color: 'text-orange-700', bg: 'bg-orange-50' },
];

// Simple heuristic scores from recent price action
const computeMetrics = (recentData) => {
  if (!Array.isArray(recentData) || recentData.length < 10) {
    return { trend: 0, volatility: 0 };
  }
  const prices = recentData
    .map(p => p.close ?? p.value)
    .filter(v => typeof v === 'number');
  if (prices.length < 10) return { trend: 0, volatility: 0 };

  const first = prices[0];
  const last = prices[prices.length - 1];
  const trend = first ? (last - first) / first : 0;

  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / prices.length;
  const volatility = Math.sqrt(variance) / (mean || 1);

  return { trend, volatility };
};

export const LiveStrategyLeaderboard = ({ selectedMarket, recentData, onSelectBestMethod }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const autoPlayRef = useRef(null);

  const leaderboard = useMemo(() => {
    if (!selectedMarket || !recentData || recentData.length < 10) return [];

    const { trend, volatility } = computeMetrics(recentData);
    const absTrend = Math.abs(trend);

    return TRADE_TYPES.map(t => {
      let score = 0;

      // Heuristic mapping
      if (t.id === 'rise_fall') {
        score = absTrend * 0.7 + volatility * 0.3;
      } else if (t.id === 'higher_lower') {
        score = absTrend * 0.9;
      } else if (t.id === 'touch_no_touch') {
        score = volatility * 0.9;
      } else if (t.id === 'digits') {
        score = (1 - Math.min(volatility, 1)) * 0.8;
      } else if (t.id === 'accumulators') {
        score = absTrend * 1.1;
      } else if (t.id === 'multipliers') {
        score = absTrend * 1.0 + volatility * 0.5;
      } else if (t.id === 'turbos') {
        score = volatility * 1.2;
      }

      const suitability = Math.round(Math.min(99, Math.max(0, score * 100)));

      return {
        id: t.id,
        name: t.name,
        suitability,
        color: t.color,
        bg: t.bg,
      };
    }).sort((a, b) => b.suitability - a.suitability).slice(0, 5); // Show top 5
  }, [selectedMarket, recentData]);

  // Auto-rotate carousel every 3 seconds - always running
  useEffect(() => {
    if (leaderboard.length <= 1) {
      // Reset to first if only one item
      setCurrentIndex(0);
      return;
    }
    
    // Clear any existing interval
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
    }
    
    // Start auto-rotation
    autoPlayRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % leaderboard.length);
    }, 3000);

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
    };
  }, [leaderboard.length, leaderboard]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + leaderboard.length) % leaderboard.length);
    // Restart auto-rotation after manual navigation
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
    }
    autoPlayRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % leaderboard.length);
    }, 3000);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % leaderboard.length);
    // Restart auto-rotation after manual navigation
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
    }
    autoPlayRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % leaderboard.length);
    }, 3000);
  };

  const currentMethod = leaderboard[currentIndex] || null;

  if (leaderboard.length === 0) {
    return (
      <div className="bg-white/95 backdrop-blur-md border-2 border-gray-200 rounded-xl shadow-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-gray-700">Analyzing...</span>
            <span className="text-[10px] text-gray-500">Collecting data</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Carousel of top methods - always visible */}
      <div className="bg-white/95 backdrop-blur-md border-2 border-green-300 rounded-lg shadow-xl overflow-hidden">
        {/* Main carousel item */}
        <div 
          className="px-2 py-1.5 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => {
            if (onSelectBestMethod && currentMethod) {
              onSelectBestMethod(currentMethod.id);
            }
            setOpen(!open);
          }}
        >
          <div className="flex items-center gap-1.5">
            <div className="relative flex-shrink-0">
              {currentIndex === 0 ? (
                <Trophy className={`h-4 w-4 ${currentMethod.color}`} />
              ) : (
                <div className={`h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold ${currentIndex === 0 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                  {currentIndex + 1}
                </div>
              )}
              {currentIndex === 0 && (
                <div className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-green-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center">1</div>
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[10px] font-semibold text-gray-700 truncate leading-tight">
                {currentIndex === 0 ? 'Best Method' : `#${currentIndex + 1} Method`}
              </span>
              <span className={`text-[9px] font-bold ${currentMethod.color} truncate leading-tight`}>
                {currentMethod.name}
              </span>
            </div>
            <div className="flex flex-col items-end flex-shrink-0">
              <span className={`text-[10px] font-bold ${currentIndex === 0 ? 'text-green-600' : 'text-blue-600'} leading-tight`}>
                {currentMethod.suitability}%
              </span>
              <span className="text-[8px] text-gray-500 leading-tight">Score</span>
            </div>
          </div>
        </div>

        {/* Navigation buttons and indicators */}
        {leaderboard.length > 1 && (
          <div className="flex items-center justify-between px-1.5 py-1 border-t border-gray-200 bg-gray-50/50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="p-0.5 hover:bg-gray-200 rounded transition-colors"
              aria-label="Previous method"
            >
              <ChevronLeft className="h-3 w-3 text-gray-600" />
            </button>
            
            {/* Dots indicator */}
            <div className="flex items-center gap-1">
              {leaderboard.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(index);
                    // Restart auto-rotation after clicking dot
                    if (autoPlayRef.current) {
                      clearInterval(autoPlayRef.current);
                    }
                    autoPlayRef.current = setInterval(() => {
                      setCurrentIndex((prev) => (prev + 1) % leaderboard.length);
                    }, 3000);
                  }}
                  className={`h-1 rounded-full transition-all ${
                    index === currentIndex 
                      ? 'w-4 bg-green-500' 
                      : 'w-1 bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Go to method ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="p-0.5 hover:bg-gray-200 rounded transition-colors"
              aria-label="Next method"
            >
              <ChevronRight className="h-3 w-3 text-gray-600" />
            </button>
          </div>
        )}
      </div>

      {/* Expanded leaderboard modal */}
      {open && (
        <div className="absolute right-0 top-16 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Zap className="h-7 w-7" />
                  BEST TRADE TYPES
                </h3>
                <p className="text-sm opacity-90 mt-1">{selectedMarket?.symbol || '—'}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/80 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {leaderboard.map((s, i) => (
              <div
                key={s.name}
                className={`rounded-xl p-4 border-2 cursor-pointer hover:shadow-md transition-all ${i === 0 ? 'border-green-500 bg-green-50 shadow-lg' : 'border-gray-200 hover:border-gray-300'}`}
                onClick={() => {
                  if (onSelectBestMethod) {
                    onSelectBestMethod(s.id);
                  }
                  setOpen(false);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${i === 0 ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
                      {i + 1}
                    </div>
                    <div>
                      <p className={`font-bold text-lg ${s.color}`}>{s.name}</p>
                      <p className="text-xs text-gray-600">Suitability score: {s.suitability}/100</p>
                    </div>
                  </div>
                  <div className={`text-2xl font-black ${i === 0 ? 'text-green-600' : 'text-gray-700'}`}>
                    {s.suitability}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};