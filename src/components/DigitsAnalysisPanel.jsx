// src/components/digits/DigitsAnalysisPanel.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

// Hook to detect mobile view
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
};

const TICK_COUNTS = [25, 50, 100, 150, 200];

const getLastDigit = (value, decimals = null) => {
  if (value == null) return null;
  // Get last digit from decimal part
  // Example: 23.40 -> 0, 23.34 -> 4, 123.456 -> 6
  // Format with fixed decimals if provided (to preserve trailing zeros like 23.40)
  let numStr;
  if (decimals !== null && decimals !== undefined) {
    numStr = Math.abs(value).toFixed(decimals);
  } else {
    numStr = Math.abs(value).toString();
  }
  const parts = numStr.split('.');
  // If there's a decimal part, get last digit from decimal part
  if (parts.length > 1 && parts[1].length > 0) {
    const decimalPart = parts[1];
    const lastChar = decimalPart.slice(-1);
    const digit = parseInt(lastChar, 10);
    return isNaN(digit) ? 0 : digit;
  }
  // If no decimal part, get last digit from integer part
  const intPart = parts[0];
  const lastChar = intPart.slice(-1);
  const digit = parseInt(lastChar, 10);
  return isNaN(digit) ? 0 : digit;
};

const getDecimalsFromPip = (pip) => {
  const pipValue = Number(pip);
  if (pipValue === 0.00001) return 5;
  if (pipValue === 0.0001) return 4;
  if (pipValue === 0.001) return 3;
  if (pipValue === 0.01) return 2;
  if (pipValue === 0.1) return 1;
  return 4; // default
};

export const DigitsAnalysisPanel = ({
  chartData = [],
  selectedTickCount = 100,
  setSelectedTickCount,
  recentDigits = [],
  lastDigit,
  selectedDigit,
  onSelectDigit,
  selectedMarket,
}) => {
  const isMobile = useIsMobile();
  
  // Fixed length for digit carousel - start with 12, grow to 20 as data becomes available
  const MIN_DIGIT_COUNT = 12;
  const MAX_DIGIT_COUNT = 20;
  
  // Calculate current digit count based on available data
  const getCurrentDigitCount = useMemo(() => {
    const currentDigit = (lastDigit !== null && lastDigit !== undefined && typeof lastDigit === 'number') 
      ? lastDigit 
      : null;
    const allAvailableDigits = Array.isArray(recentDigits) 
      ? recentDigits.filter(d => d !== null && d !== undefined && typeof d === 'number')
      : [];
    
    const totalAvailable = (currentDigit !== null ? 1 : 0) + allAvailableDigits.length;
    
    // Always start with MIN_DIGIT_COUNT (12), grow to MAX_DIGIT_COUNT (20) as more data becomes available
    if (totalAvailable < MIN_DIGIT_COUNT) {
      return MIN_DIGIT_COUNT; // Always show at least 12 items (will pad with nulls if needed)
    } else if (totalAvailable >= MAX_DIGIT_COUNT) {
      return MAX_DIGIT_COUNT; // Cap at 20
    } else {
      return totalAvailable; // Grow from 12 to 20 as data becomes available
    }
  }, [lastDigit, recentDigits]);
  
  const FIXED_DIGIT_COUNT = getCurrentDigitCount;
  
  // Track animation state for new digit arrival
  const [isAnimating, setIsAnimating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const prevLastDigitRef = useRef(null);
  const containerRef = useRef(null);

  // Use selected tick count for statistics (not cumulative)
  const availableTicks = Math.min(selectedTickCount, chartData.length);
  const recentData = useMemo(() => chartData.slice(-availableTicks), [chartData, availableTicks]);

  // Get decimals from selectedMarket pip
  const decimals = useMemo(() => {
    return selectedMarket ? getDecimalsFromPip(selectedMarket.pip) : null;
  }, [selectedMarket]);

  const { digitStats, percentages, maxPerc, minPerc, hotDigit, coldDigit } = useMemo(() => {
    const stats = Array(10).fill(0);
    // Count digits from the selected tick count range (not cumulative)
    recentData.forEach((tick) => {
      const d = getLastDigit(tick?.value, decimals);
      if (d !== null) stats[d]++;
    });

    // Calculate percentages based on selected tick count
    const percs = stats.map(count => availableTicks > 0 ? (count / availableTicks) * 100 : 0);
    const maxP = Math.max(...percs, 0);
    const minP = Math.min(...percs);

    const hot = percs.indexOf(maxP);
    // Find the first digit with minimum percentage (only one red bar)
    const cold = percs.indexOf(minP);

    return {
      digitStats: stats,
      percentages: percs,
      maxPerc: maxP,
      minPerc: minP,
      hotDigit: hot,
      coldDigit: cold,
    };
  }, [recentData, availableTicks, decimals]);

  const total = availableTicks;

  // Compute displayDigits - FIFO: newest on left (index 0), oldest on right
  // Start with 12 items, grow to 20 as more data becomes available
  const displayDigits = useMemo(() => {
    // Always initialize with empty array to prevent undefined issues
    let digitsToShow = [];
    
    try {
      // Current digit is the lastDigit (most recent real-time market value)
      const currentDigit = (lastDigit !== null && lastDigit !== undefined && typeof lastDigit === 'number') 
        ? lastDigit 
        : null;
      
      // Get all available digits from recentDigits (these are already in reverse order - newest first)
      let allAvailableDigits = Array.isArray(recentDigits) 
        ? recentDigits.filter(d => d !== null && d !== undefined && typeof d === 'number')
        : [];
      
      if (currentDigit !== null) {
        // CRITICAL: currentDigit (from lastTick) is ALWAYS the newest and MUST be first (leftmost, index 0)
        // Remove currentDigit from allAvailableDigits if it exists (to avoid duplication)
        allAvailableDigits = allAvailableDigits.filter(d => d !== currentDigit);
        // Prepend currentDigit to the beginning (left side, position 0)
        // Take up to (FIXED_DIGIT_COUNT - 1) from allAvailableDigits
        digitsToShow = [currentDigit, ...allAvailableDigits.slice(0, FIXED_DIGIT_COUNT - 1)];
      } else {
        // No current digit, use all available digits (up to FIXED_DIGIT_COUNT)
        digitsToShow = allAvailableDigits.slice(0, FIXED_DIGIT_COUNT);
      }
      
      // CRITICAL: FIFO behavior - take only the most recent FIXED_DIGIT_COUNT items
      // When new digit comes in from left (index 0), automatically remove oldest from right
      digitsToShow = digitsToShow.slice(0, FIXED_DIGIT_COUNT);
      
      // CRITICAL: ALWAYS pad to exactly FIXED_DIGIT_COUNT items with null placeholders
      // This ensures the array ALWAYS has exactly 12 items, no exceptions
      while (digitsToShow.length < FIXED_DIGIT_COUNT) {
        digitsToShow.push(null);
      }
      
      // CRITICAL: Ensure we never exceed FIXED_DIGIT_COUNT
      if (digitsToShow.length > FIXED_DIGIT_COUNT) {
        digitsToShow = digitsToShow.slice(0, FIXED_DIGIT_COUNT);
      }
    } catch (error) {
      console.error('Error computing displayDigits:', error);
      // Fallback: return array with nulls
      digitsToShow = Array(FIXED_DIGIT_COUNT).fill(null);
    }
    
    // Final guarantee: create array with exactly FIXED_DIGIT_COUNT items
    // This is the absolute final check - ensures we ALWAYS return exactly 12 items
    const result = Array.from({ length: FIXED_DIGIT_COUNT }, (_, i) => {
      return (i < digitsToShow.length && digitsToShow[i] !== null && digitsToShow[i] !== undefined) 
        ? digitsToShow[i] 
        : null;
    });
    
    // Final validation - this should ALWAYS be true
    if (result.length !== FIXED_DIGIT_COUNT) {
      console.error(`CRITICAL ERROR: displayDigits length is ${result.length}, expected ${FIXED_DIGIT_COUNT}`);
      // Emergency fix - return array with exactly FIXED_DIGIT_COUNT nulls
      return Array(FIXED_DIGIT_COUNT).fill(null);
    }
    
    return result;
  }, [lastDigit, recentDigits]);

  // Track new digit arrival for animation
  useEffect(() => {
    const currentDigit = (lastDigit !== null && lastDigit !== undefined && typeof lastDigit === 'number') 
      ? lastDigit 
      : null;
    
    const isNewDigit = prevLastDigitRef.current !== null && 
                       currentDigit !== null && 
                       prevLastDigitRef.current !== currentDigit;

    if (isNewDigit) {
      setIsRefreshing(true);
      setIsAnimating(true);
      setTimeout(() => {
        setIsRefreshing(false);
        setIsAnimating(false);
      }, 500);
    }

    prevLastDigitRef.current = currentDigit;
  }, [lastDigit]);

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Refresh indicator - only show when new digit arrives */}
      {isRefreshing && isAnimating && (
        <div className="absolute top-2 right-4 z-10 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs text-blue-600 font-medium animate-pulse">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
          New digit!
        </div>
      )}
      
      {/* ====== RECENT DIGITS CAROUSEL - Grid layout with position numbers ====== */}
      <div 
        className="border rounded-lg mb-2 bg-white"
        style={{
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'rgba(229, 231, 235, 1)',
          borderRadius: '0.5rem',
          backgroundColor: 'rgba(255, 255, 255, 1)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '0.5rem'
        }}
      >
        {/* Digit grid container with overflow handling */}
        <div className="relative overflow-hidden p-2 w-full">
          {/* Enhanced digit display with animation container */}
          <div 
            ref={containerRef}
            id="recentDigits"
            className="grid grid-flow-col auto-cols-max gap-2 w-full overflow-x-auto scrollbar-hide py-1 px-0.5"
          >
            {/* CRITICAL: Always render exactly 12 items - use Array.from to ensure fixed count */}
            {Array.from({ length: FIXED_DIGIT_COUNT }, (_, i) => {
              // Get digit at index i - displayDigits is guaranteed to have exactly FIXED_DIGIT_COUNT items
              const digit = (displayDigits && Array.isArray(displayDigits) && i < displayDigits.length && displayDigits[i] !== null && displayDigits[i] !== undefined) 
                ? displayDigits[i] 
                : null;
              const currentDigit = (lastDigit !== null && lastDigit !== undefined && typeof lastDigit === 'number') 
                ? lastDigit 
                : null;
              
              // Render empty placeholder if no digit at this position
              if (digit === null) {
                return (
                  <div
                    key={`digit-empty-${i}`}
                    className="digit-box"
                    data-index={i}
                    style={{
                      minWidth: '40px',
                      height: '40px',
                    }}
                  />
                );
              }
              
              const isHot = digit === hotDigit;
              const isCold = digit === coldDigit && percentages[digit] === minPerc;
              // Current digit is ALWAYS the first one (position 0, leftmost) if currentDigit exists
              const isCurrentDigit = (currentDigit !== null && i === 0 && digit === currentDigit);
            
              // Build class names
              let digitBoxClasses = 'digit-box';
              if (isCurrentDigit) {
                digitBoxClasses += ' latest-digit new-digit';
              }
              
              // Use same colors as charts
              let bgColor = '#e5e5e5'; // Light grey default
              let borderColor = '#d3d3d3';
              let textColor = '#000000';
              
              // Current digit gets special highlight (blue) - highest priority
              if (isCurrentDigit) {
                bgColor = '#3b82f6'; // Blue for current digit
                borderColor = '#2563eb';
                textColor = '#ffffff';
              } else if (isHot) {
                bgColor = '#14b8a6'; // Teal/turquoise for hot
                borderColor = '#0d9488';
                textColor = '#ffffff';
              } else if (isCold) {
                bgColor = '#ef4444'; // Red for cold
                borderColor = '#dc2626';
                textColor = '#ffffff';
              }
              
              return (
                <div
                  key={`digit-${digit}-${i}`}
                  className={digitBoxClasses}
                  data-value={digit}
                  data-index={i}
                  onClick={() => onSelectDigit?.(digit)}
                  style={{
                    backgroundColor: bgColor,
                    borderColor: borderColor,
                    color: textColor,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '0.5rem',
                    padding: '8px',
                    minWidth: isCurrentDigit ? '48px' : '40px',
                    height: isCurrentDigit ? '48px' : '40px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease-out',
                    animation: isCurrentDigit ? 'digitPulse 2s ease-in-out infinite' : 'none',
                  }}
                >
                  <div className="digit-value" style={{ fontSize: isCurrentDigit ? '20px' : '18px', fontWeight: 'bold' }}>
                    {digit}
                  </div>
                  <div className="digit-position" style={{ fontSize: '10px', marginTop: '2px', opacity: 0.7 }}>
                    {i + 1}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Shadow indicators for scroll */}
          <div className="absolute top-0 left-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent pointer-events-none z-10"></div>
          <div className="absolute top-0 right-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent pointer-events-none z-10"></div>
        </div>
      </div>
      
      <style>{`
        /* Hide scrollbar */
        .scrollbar-hide {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;  /* Chrome, Safari and Opera */
        }
        
        /* Pulse animation for current digit */
        @keyframes digitPulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
          }
        }
      `}</style>

      {/* Tick Count Buttons */}
      <div className="flex justify-center gap-2 px-4 md:pr-[200px] pb-3">
        {TICK_COUNTS.map((count) => (
          <Button
            key={count}
            variant={selectedTickCount === count ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTickCount(count)}
            className={`rounded-md font-medium min-w-12 h-8 text-xs ${selectedTickCount === count ? 'bg-gray-700 text-white' : 'bg-white border-[#e5e5e5] text-gray-700'}`}
          >
            {count}t
          </Button>
        ))}
      </div>

      {/* Charts Grid - Vertical on mobile, side by side on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 md:pr-[200px] pb-4 flex-1 min-h-0 overflow-y-auto">
        {/* BAR CHART - Matching reference image exactly */}
        <div className="bg-white rounded-lg p-3 border border-[#e5e5e5] flex flex-col relative isolate" style={{ minHeight: '280px' }}>
          <h3 className="text-center text-sm font-semibold text-gray-700 mb-3 flex-shrink-0">
            Last digit stats for the latest {total} ticks on
          </h3>
          {/* Chart container with white background and light grey border */}
          <div className="bg-white border border-[#e5e5e5] rounded p-3 relative flex-1" style={{ minHeight: '200px' }}>
            {/* Faint horizontal grid lines */}
            <div className="absolute inset-0 pointer-events-none z-0" style={{ 
              backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 19px, #e5e5e5 19px, #e5e5e5 20px)',
              backgroundPosition: '0 0',
              backgroundSize: '100% 20px'
            }} />
            
            {/* Bars */}
            <div className="grid grid-cols-10 gap-0.5 md:gap-1 relative z-20 h-full items-end" style={{ minHeight: '180px' }}>
              {percentages.map((percentage, index) => {
                const count = digitStats[index];
                const isHot = index === hotDigit;
                const isCold = index === coldDigit && percentage === minPerc;

                // Calculate bar height based on max percentage
                const barHeight = maxPerc > 0
                  ? count > 0
                    ? Math.max((percentage / maxPerc) * 100, 2)
                    : 0
                  : 0;

                // Colors matching the reference image exactly:
                // - Teal/turquoise (#14b8a6) for highest frequency (hot digit)
                // - Red (#ef4444) for lowest frequency (cold digit)
                // - Light grey (#e5e5e5) for all others with subtle darker grey border
                let barColor = '#e5e5e5'; // Light grey default
                let barBorderColor = '#d3d3d3'; // Subtle darker grey border
                
                if (isHot) {
                  barColor = '#14b8a6'; // Teal/turquoise for highest
                  barBorderColor = '#0d9488';
                } else if (isCold) {
                  barColor = '#ef4444'; // Red for lowest
                  barBorderColor = '#dc2626';
                }

                return (
                  <div
                    key={index}
                    className="flex flex-col items-center justify-end cursor-pointer group relative"
                    onClick={() => onSelectDigit?.(index)}
                    style={{ height: '100%' }}
                  >
                    {/* Percentage label - smaller on both mobile and desktop to prevent overlap */}
                    <div className="mb-0.5 md:mb-0.5 font-medium text-gray-700 leading-tight w-full text-center">
                      <span 
                        className="block text-[7px] md:text-[9px]"
                        style={{
                          lineHeight: '1',
                          whiteSpace: 'nowrap',
                          transform: 'scale(0.95)',
                          transformOrigin: 'center'
                        }}
                      >
                        {isMobile ? `${percentage.toFixed(0)}%` : `${percentage.toFixed(1)}%`}
                      </span>
                    </div>
                    
                    {/* Bar */}
                    <div
                      className="w-full relative"
                      style={{ 
                        height: `${barHeight}%`,
                        backgroundColor: barColor,
                        border: `1px solid ${barBorderColor}`,
                        minHeight: count > 0 ? '4px' : '0',
                        transition: 'height 0.3s ease-out, background-color 0.3s ease-out, border-color 0.3s ease-out'
                      }}
                    />
                    
                    {/* Digit label below */}
                    <div className="mt-1 md:mt-1.5 text-[10px] md:text-xs font-medium text-gray-700">
                      {index}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* PIE/DOUGHNUT CHART - Matching bar chart style */}
        <div className="bg-white rounded-lg p-3 border border-[#e5e5e5] flex flex-col relative isolate">
          <h3 className="text-center text-sm font-semibold text-gray-700 mb-3 flex-shrink-0">
            Last digit stats for the latest {total} ticks on
          </h3>
          <div className="bg-white border border-[#e5e5e5] rounded p-3 flex flex-col items-center justify-start flex-1 min-h-0 overflow-visible relative">
            <div className="relative flex-shrink-0 mb-2 z-10" style={{ overflow: 'visible' }}>
              <svg viewBox="0 0 240 240" className="w-36 h-36" style={{ transition: 'all 0.3s ease-out', overflow: 'visible' }}>
                <circle cx="120" cy="120" r="110" fill="none" stroke="#e5e5e5" strokeWidth="22" />
                {(() => {
                  let start = -Math.PI / 2;
                  return digitStats.map((count, i) => {
                    if (count === 0) return null;
                    const angle = (count / total) * Math.PI * 2;
                    const end = start + angle;
                    const large = angle > Math.PI ? 1 : 0;
                    const x1 = 120 + 105 * Math.cos(start);
                    const y1 = 120 + 105 * Math.sin(start);
                    const x2 = 120 + 105 * Math.cos(end);
                    const y2 = 120 + 105 * Math.sin(end);
                    start = end;
                    
                    // Use same colors as bar chart
                    const isHot = i === hotDigit;
                    const isCold = i === coldDigit && percentages[i] === minPerc;
                    let fillColor = '#e5e5e5'; // Light grey default
                    
                    if (isHot) {
                      fillColor = '#14b8a6'; // Teal/turquoise for highest
                    } else if (isCold) {
                      fillColor = '#ef4444'; // Red for lowest
                    }
                    
                    return (
                      <path
                        key={i}
                        d={`M120,120 L${x1},${y1} A105,105 0 ${large},1 ${x2},${y2} Z`}
                        fill={fillColor}
                        stroke="#fff"
                        strokeWidth="2"
                        style={{ transition: 'fill 0.3s ease-out' }}
                      />
                    );
                  });
                })()}
                <circle cx="120" cy="120" r="78" fill="white" />
                <text x="120" y="108" textAnchor="middle" className="text-2xl font-black fill-gray-800">{total}</text>
                <text x="120" y="135" textAnchor="middle" className="text-[10px] fill-gray-500 font-medium">ticks</text>
              </svg>
              
            </div>

            <div className="grid grid-cols-1 gap-1 mt-auto text-[8px] w-full flex-shrink-0">
              {digitStats.map((count, i) => count > 0 && (
                <div key={i} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 flex-shrink-0"
                    style={{ 
                      backgroundColor: i === hotDigit ? '#14b8a6' : 
                                     (i === coldDigit && percentages[i] === minPerc) ? '#ef4444' : '#e5e5e5',
                      border: `1px solid ${i === hotDigit ? '#0d9488' : 
                               (i === coldDigit && percentages[i] === minPerc) ? '#dc2626' : '#d3d3d3'}`
                    }}
                  />
                  <span className="text-gray-700 text-[8px] leading-tight truncate">
                    {i} ({percentages[i].toFixed(2)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
