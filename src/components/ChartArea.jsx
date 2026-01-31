import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Download, Pencil, ZoomIn, ZoomOut, ListFilter, Search, Settings2, SlidersHorizontal, Terminal, ChevronDown, Lock, Unlock, X, Brain, TrendingUp, TrendingDown, ArrowRight, ChevronLeft, ChevronRight, Target, Waves, Zap, Layers, Globe, AreaChart, CandlestickChart, Clock, Plus, Minus } from 'lucide-react';
import { useDerivAPI } from '@/contexts/DerivContext';
import TradingChart from '@/components/TradingChart';
import MarketSelector from '@/components/MarketSelector';
import ChartSettingsModal from '@/components/ChartSettingsModal';
// IndicatorsModal removed
import DrawingToolsModal from '@/components/DrawingToolsModal';
import DrawingEditModal from '@/components/DrawingEditModal';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DigitsAnalysisPanel } from './DigitsAnalysisPanel';
import { CandleWithImage, CryptoIcon, Forex, GlobalImage, Gold, StockChart } from '@/components/CandleWithImage.jsx';
import { cn } from '@/lib/utils';

// Zoom lock icon component - shows crosshair when unlocked, lock when locked
const ZoomLockIcon = ({ className, isLocked = false }) => {
    if (isLocked) {
        // Show lock icon when locked
        return (
            <svg 
                width="16" 
                height="16" 
                viewBox="0 0 16 16" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className={className}
            >
                <rect x="5" y="7" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <path d="M5 7V5C5 3.34315 6.34315 2 8 2C9.65685 2 11 3.34315 11 5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
        );
    } else {
        // Show crosshair icon when unlocked
        return (
            <svg 
                width="16" 
                height="16" 
                viewBox="0 0 16 16" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className={className}
            >
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="8" y1="10" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="2" y1="8" x2="6" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="10" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
            </svg>
        );
    }
};

// MarketIcon component (copied from MarketSelector for local use)
const MarketIcon = ({ market, flags, className = "" }) => {
    const currencyToCountry = {
        'EUR': 'eu', 'USD': 'us', 'GBP': 'gb', 'JPY': 'jp', 'AUD': 'au', 'CAD': 'ca', 'CHF': 'ch', 'NZD': 'nz'
    };
    
    if (market === 'forex' && flags?.length === 2) {
        return (
            <div className="flex -space-x-2 overflow-hidden">
                {flags.map(flag => {
                    const countryCode = currencyToCountry[flag.toUpperCase()] || flag.toLowerCase();
                    return (
                        <img
                            key={flag}
                            className="inline-block h-5 w-5 rounded-full"
                            src={`/flags/${countryCode}.svg`}
                            alt={flag}
                        />
                    );
                })}
            </div>
        );
    }
    
    const icons = {
        forex: Forex,
        indices: StockChart,
        synthetic_index: CandleWithImage,
        commodities: Gold,
        cryptocurrency: CryptoIcon,
    };
    const Icon = icons[market] || Globe;
    return <Icon className={cn("h-5 w-5 text-gray-500", className)} />;
};

const ChartArea = ({
    selectedMarket,
    setSelectedMarket,
    chartData,
    setChartData,
    chartType,
    setChartType,
    timeInterval,
    setTimeInterval,
    isScriptRunnerOpen,
    setIsScriptRunnerOpen,
    tradeType,
    onSelectDigit,
    selectedDigit,
    onOpenTradeTypeSelector,
    aiPrediction,
    activeIndicators,
    setActiveIndicators,
    chartBarriers,
    openPositions = [],
  }) => {
    const { subscribeTick, getHistory, tickData, marketHistory } = useDerivAPI();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
    const [isDrawingToolsOpen, setIsDrawingToolsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTickCount, setSelectedTickCount] = useState(100);
    const [isZoomLocked, setIsZoomLocked] = useState(false);
    const [selectedDrawingTool, setSelectedDrawingTool] = useState(null);
    const [isScrolledToPast, setIsScrolledToPast] = useState(false);
    
    // Track previous market, interval, and chartType to detect actual changes (not just re-renders)
    // Initialize as null to detect first mount
    const prevMarketRef = useRef(null);
    const prevIntervalRef = useRef(null);
    const prevChartTypeRef = useRef(null);
    const isInitialMountRef = useRef(true);
    const loadingStartTimeRef = useRef(null);
    const loadingTimeoutRef = useRef(null);
    const [drawingsCount, setDrawingsCount] = useState(0);
    const [activeDrawings, setActiveDrawings] = useState([]);
    const [editingDrawing, setEditingDrawing] = useState(null);
    const [isDrawingEditModalOpen, setIsDrawingEditModalOpen] = useState(false);
    const tradingChartRef = useRef();
    const lastTickRef = useRef(null);
    const { toast } = useToast();

    const digitsTradeTypes = ['matches_differs', 'even_odd', 'over_under'];
    const isDigitsTrade = tradeType && digitsTradeTypes.includes(tradeType);
    const isCandle = chartType !== 'area';
    
    // State for rotating through top 5 methods
    const [currentMethodIndex, setCurrentMethodIndex] = useState(0);
    
    // Calculate top 5 methods for auto-rotation
    const top5Methods = useMemo(() => {
        if (!aiPrediction) return [];
        
        const hasDigitPrediction = typeof aiPrediction.digitPrediction === 'number' && aiPrediction.digitPrediction !== null && aiPrediction.digitPrediction !== undefined;
        const digitConfidence = hasDigitPrediction ? Math.round((aiPrediction.digitConfidence || 0.5) * 100) : null;
        
        const methods = [
            {
                name: 'Matches/Differs',
                confidence: hasDigitPrediction ? digitConfidence : (aiPrediction.matchesDiffersConfidence ?? aiPrediction.confidence),
                digit: hasDigitPrediction ? aiPrediction.digitPrediction : null
            },
            {
                name: 'Touch/No Touch',
                confidence: hasDigitPrediction ? digitConfidence : (aiPrediction.touchNoTouchConfidence ?? aiPrediction.confidence),
                digit: hasDigitPrediction ? aiPrediction.digitPrediction : null
            },
            {
                name: 'Rise/Fall',
                confidence: aiPrediction.confidence,
                digit: null
            },
            {
                name: 'Higher/Lower',
                confidence: aiPrediction.higherLowerConfidence ?? aiPrediction.confidence,
                digit: null
            },
            {
                name: 'Even/Odd',
                confidence: hasDigitPrediction ? digitConfidence : (aiPrediction.evenOddConfidence ?? aiPrediction.confidence),
                digit: hasDigitPrediction ? aiPrediction.digitPrediction : null
            },
            {
                name: 'Over/Under',
                confidence: hasDigitPrediction ? digitConfidence : (aiPrediction.overUnderConfidence ?? aiPrediction.confidence),
                digit: hasDigitPrediction ? aiPrediction.digitPrediction : null
            },
            {
                name: 'Ends In/Out',
                confidence: aiPrediction.endsInOutConfidence ?? aiPrediction.confidence,
                digit: null
            },
            {
                name: 'Stays In/Goes Out',
                confidence: aiPrediction.staysInGoesOutConfidence ?? aiPrediction.confidence,
                digit: null
            },
            {
                name: 'Call/Put',
                confidence: aiPrediction.confidence,
                digit: null
            },
            {
                name: 'Turbos',
                confidence: aiPrediction.confidence,
                digit: null
            }
        ];
        
        return methods
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5);
    }, [aiPrediction]);
    
    // Auto-rotate through top 5 methods
    useEffect(() => {
        if (top5Methods.length === 0) {
            setCurrentMethodIndex(0);
            return;
        }
        const interval = setInterval(() => {
            setCurrentMethodIndex((prev) => (prev + 1) % top5Methods.length);
        }, 3000); // Change every 3 seconds
        return () => clearInterval(interval);
    }, [top5Methods.length]);
    
    // Trade types that use barriers
    const barrierTradeTypes = ['higher_lower', 'touch_no_touch', 'ends_in_out', 'stays_in_goes_out', 'turbos', 'call_put'];
    const usesBarriers = tradeType && barrierTradeTypes.includes(tradeType);

    const lastTick = tickData?.[selectedMarket?.symbol];

    // Helper function to get decimals from pip
    const getDecimalsFromPip = useCallback((pip) => {
        const pipValue = Number(pip);
        if (pipValue === 0.00001) return 5;
        if (pipValue === 0.0001) return 4;
        if (pipValue === 0.001) return 3;
        if (pipValue === 0.01) return 2;
        if (pipValue === 0.1) return 1;
        return 4; // default
    }, []);
    
    // Calculate price info for mobile market selector
    const mobilePriceInfo = useMemo(() => {
        if (!selectedMarket || !tickData[selectedMarket.symbol]) {
            return null;
        }
        const tick = tickData[selectedMarket.symbol];
        const history = marketHistory?.[selectedMarket.symbol];
        const pip = Number(selectedMarket.pip) || 0.0001;
        let decimals = 4;
        if (pip === 0.00001) decimals = 5;
        else if (pip === 0.0001) decimals = 4;
        else if (pip === 0.001) decimals = 3;
        else if (pip === 0.01) decimals = 2;
        else if (pip === 0.1) decimals = 1;
        
        const price = tick.quote.toFixed(decimals);
        
        if (history && history.length > 0) {
            const openPrice = history[0].value;
            const change = (tick.quote - openPrice).toFixed(decimals);
            const pctChange = ((tick.quote - openPrice) / openPrice * 100).toFixed(2);
            return { price, change, pctChange, isUp: tick.quote >= openPrice };
        }
        return { price, change: '...', pctChange: '...', isUp: true };
    }, [selectedMarket, tickData, marketHistory]);

    const getPeriodStart = useCallback((timestampMs, granularitySeconds) => {
        return Math.floor(timestampMs / 1000 / granularitySeconds) * granularitySeconds * 1000;
    }, []);

    const getGranularity = useCallback((interval) => {
        const unit = interval.slice(-1);
        const value = parseInt(interval.slice(0, -1));
        if (unit === 'm') return value * 60;
        if (unit === 'h') return value * 3600;
        if (unit === 'd') return value * 86400;
        return 1;
    }, []);

    const handleHistory = useCallback((history, isUpdate = false) => {
        // Clear any existing timeout
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
        }

        const cleanHistory = history.filter(d => {
            if (isCandle) return d && d.time && d.open != null && d.high != null && d.low != null && d.close != null;
            return d && d.time && d.value != null;
        }).map(point => ({
            ...point,
            time: isCandle ? getPeriodStart(point.time, getGranularity(timeInterval)) : point.time
        }));
        if (isUpdate) {
            setChartData(prevData => {
                if (!prevData || prevData.length === 0) return cleanHistory;
                const uniqueNew = cleanHistory.filter(newPt => !prevData.some(oldPt => oldPt.time === newPt.time));
                return [...prevData, ...uniqueNew];
            });
        } else {
            setChartData(cleanHistory);
        }
        
        // Emit chart ready event when we have data (don't wait for minimum time)
        if (cleanHistory.length > 0) {
            // Emit immediately for progress tracking
            window.dispatchEvent(new CustomEvent('chart-ready'));
        }
        
        // Keep loading bar visible for at least 1 second for UX
        const minLoadingTime = 1000; // 1 second
        const elapsed = loadingStartTimeRef.current ? Date.now() - loadingStartTimeRef.current : 0;
        const remainingTime = Math.max(0, minLoadingTime - elapsed);
        
        if (remainingTime > 0) {
            loadingTimeoutRef.current = setTimeout(() => {
                setIsLoading(false);
                loadingTimeoutRef.current = null;
            }, remainingTime);
        } else {
            setIsLoading(false);
        }
    }, [setChartData, isCandle, timeInterval, getPeriodStart, getGranularity]);

    useEffect(() => {
        if (selectedMarket) {
            // Compare current values with previous values stored in refs
            const prevSymbol = prevMarketRef.current?.symbol;
            const currentSymbol = selectedMarket.symbol;
            const marketChanged = prevSymbol !== currentSymbol;
            
            const prevInterval = prevIntervalRef.current;
            const intervalChanged = prevInterval !== timeInterval;
            
            const prevChartType = prevChartTypeRef.current;
            const chartTypeChanged = prevChartType !== chartType;
            
            // On initial mount, we need to fetch data (marketChanged will be true because prevSymbol is null)
            // On subsequent renders, clear/fetch if market, interval, or chartType actually changed
            // ChartType change requires refetch because data format differs (area vs candles)
            const shouldFetchData = isInitialMountRef.current || marketChanged || intervalChanged || chartTypeChanged;
            
            if (shouldFetchData) {
                // Clear any existing loading timeout
                if (loadingTimeoutRef.current) {
                    clearTimeout(loadingTimeoutRef.current);
                    loadingTimeoutRef.current = null;
                }
                
                // Only clear data if market, interval, or chartType actually changed (not on refresh or re-render)
                // On initial mount, we want to fetch fresh data, but don't clear if data already exists
                if (!isInitialMountRef.current && (marketChanged || intervalChanged || chartTypeChanged)) {
                    setIsLoading(true);
                    loadingStartTimeRef.current = Date.now();
                    setChartData([]);
                } else if (isInitialMountRef.current) {
                    setIsLoading(true);
                    loadingStartTimeRef.current = Date.now();
                }
                
                // Safety timeout: ensure loading bar doesn't stay forever (max 30 seconds)
                loadingTimeoutRef.current = setTimeout(() => {
                    setIsLoading(false);
                    loadingTimeoutRef.current = null;
                }, 30000);
            }
            
            // Update refs with current values AFTER checking for changes
            prevMarketRef.current = selectedMarket;
            prevIntervalRef.current = timeInterval;
            prevChartTypeRef.current = chartType;
            isInitialMountRef.current = false; // Mark that initial mount is complete
            
            const style = isDigitsTrade ? 'ticks' : (timeInterval.endsWith('t') ? 'ticks' : 'candles');
            let granularity;
            if (!isDigitsTrade && style === 'candles') {
                granularity = getGranularity(timeInterval);
            }
            // Increase history count for long-term data display
            // For digits trades, use more ticks; for candles, use more candles
            const historyCount = isDigitsTrade ? 1000 : (isCandle ? 5000 : 5000);

            // Fetch history if it's initial mount or if market/interval/chartType changed
            if (shouldFetchData) {
                getHistory(selectedMarket.symbol, style, granularity, historyCount, handleHistory);
            }
            
            // Always ensure tick subscription is active (it handles duplicate subscriptions internally)
            // Subscribe after a small delay to ensure WebSocket is ready
            const subscribeTimer = setTimeout(() => {
                subscribeTick(selectedMarket.symbol);
            }, 100);
            
            return () => {
                clearTimeout(subscribeTimer);
            };
        } else {
            // If no market selected, reset refs and clear loading
            prevMarketRef.current = null;
            prevIntervalRef.current = null;
            prevChartTypeRef.current = null;
            isInitialMountRef.current = true; // Reset for next market selection
            setIsLoading(false);
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
            }
        }

        // Cleanup timeout on unmount or dependency change
        return () => {
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
            }
        };
    }, [selectedMarket, timeInterval, chartType, getHistory, subscribeTick, handleHistory, isCandle, isDigitsTrade, getGranularity]);

    // Set up scroll state tracking
    useEffect(() => {
        if (tradingChartRef.current && tradingChartRef.current.onScrollStateChange) {
            tradingChartRef.current.onScrollStateChange((isScrolled) => {
                setIsScrolledToPast(isScrolled);
            });
        }
    }, [selectedMarket]);

    useEffect(() => {
        if (lastTick && selectedMarket?.symbol === lastTick.symbol && lastTick.quote != null) {
            if (lastTickRef.current && lastTickRef.current.epoch === lastTick.epoch && lastTickRef.current.quote === lastTick.quote) {
                return;
            }
            lastTickRef.current = lastTick;
            const tickTime = lastTick.epoch * 1000;
            const tickValue = lastTick.quote;
            setChartData(prevData => {
                if (isDigitsTrade || !isCandle) {
                    if (!prevData || prevData.length === 0) {
                        return [{ time: tickTime, value: tickValue }];
                    }
                    const lastPoint = prevData[prevData.length - 1];
                    if (lastPoint.time === tickTime) {
                        return [...prevData.slice(0, -1), { ...lastPoint, value: tickValue }];
                    }
                    return [...prevData, { time: tickTime, value: tickValue }];
                } else {
                    const granularity = getGranularity(timeInterval);
                    const currentPeriodStart = getPeriodStart(tickTime, granularity);
                    if (!prevData || prevData.length === 0) {
                        return [{
                            time: currentPeriodStart,
                            open: tickValue,
                            high: tickValue,
                            low: tickValue,
                            close: tickValue,
                        }];
                    }
                    const lastPoint = prevData[prevData.length - 1];
                    const lastPeriodStart = getPeriodStart(lastPoint.time, granularity);
                    if (currentPeriodStart === lastPeriodStart) {
                        return [
                            ...prevData.slice(0, -1),
                            {
                                ...lastPoint,
                                high: Math.max(lastPoint.high || tickValue, tickValue),
                                low: Math.min(lastPoint.low || tickValue, tickValue),
                                close: tickValue,
                            },
                        ];
                    } else {
                        return [
                            ...prevData,
                            {
                                time: currentPeriodStart,
                                open: lastPoint.close,
                                high: tickValue,
                                low: tickValue,
                                close: tickValue,
                            },
                        ];
                    }
                }
            });
        }
    }, [lastTick, isDigitsTrade, isCandle, selectedMarket, timeInterval, getGranularity, getPeriodStart]);

    const recentDigits = useMemo(() => {
        if (!isDigitsTrade || chartData.length === 0) return [];
        const decimals = selectedMarket ? getDecimalsFromPip(selectedMarket.pip) : null;
        
        // Get the most recent digits from chart data
        // Get enough to ensure we have 20 total when combined with currentDigit
        // We need 19 digits from chartData (currentDigit will be the 20th)
        // Get more than needed to account for filtering
        const dataSlice = chartData.slice(-25); // Get last 25 ticks to ensure we have enough after filtering
        const digits = dataSlice
            .filter(d => d?.value != null)
            .map(d => {
                // Get last digit from decimal part
                // Example: 23.40 -> 0, 23.34 -> 4, 123.456 -> 6
                let numStr;
                if (decimals !== null && decimals !== undefined) {
                    numStr = Math.abs(d.value).toFixed(decimals);
                } else {
                    numStr = Math.abs(d.value).toString();
                }
                const parts = numStr.split('.');
                let digit = 0;
                if (parts.length > 1 && parts[1].length > 0) {
                    // Get last digit from decimal part
                    const decimalPart = parts[1];
                    const lastChar = decimalPart.slice(-1);
                    digit = parseInt(lastChar, 10);
                } else {
                    // Get last digit from integer part if no decimal
                    const intPart = parts[0];
                    const lastChar = intPart.slice(-1);
                    digit = parseInt(lastChar, 10);
                }
                return isNaN(digit) ? 0 : digit;
            });
        
        // Reverse to get most recent first (newest at index 0)
        // Return up to 19 digits (currentDigit will be prepended to make 20 total)
        return digits.reverse();
    }, [chartData, isDigitsTrade, selectedMarket, getDecimalsFromPip]);

    const lastDigit = useMemo(() => {
        // Helper function to get last digit from decimal part
        // Example: 23.40 -> 0, 23.34 -> 4, 123.456 -> 6
        const getLastDigitFromValue = (value, decimals = null) => {
            if (value == null || isNaN(value)) return null;
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
                return isNaN(digit) ? null : digit;
            }
            // If no decimal part, get last digit from integer part
            const intPart = parts[0];
            const lastChar = intPart.slice(-1);
            const digit = parseInt(lastChar, 10);
            return isNaN(digit) ? null : digit;
        };

        const decimals = selectedMarket ? getDecimalsFromPip(selectedMarket.pip) : null;

        // Priority 1: Use lastTick.quote (most current real-time market value)
        if (lastTick?.quote != null) {
            const digit = getLastDigitFromValue(lastTick.quote, decimals);
            if (digit !== null) return digit;
        }
        
        // Priority 2: Use tickData for current market price (try both symbol and id)
        if (selectedMarket) {
            const tick = tickData[selectedMarket.symbol] || tickData[selectedMarket.id];
            if (tick?.quote != null) {
                const digit = getLastDigitFromValue(tick.quote, decimals);
                if (digit !== null) return digit;
            }
        }
        
        // Priority 3: Use last chart data point (real-time updated)
        if (chartData.length > 0) {
            const lastData = chartData[chartData.length - 1];
            if (lastData?.value != null) {
                const digit = getLastDigitFromValue(lastData.value, decimals);
                if (digit !== null) return digit;
            }
        }
        return null;
    }, [lastTick, chartData, selectedMarket, tickData, getDecimalsFromPip]);


    const availableTicks = useMemo(() => Math.min(selectedTickCount, chartData.length), [selectedTickCount, chartData.length]);

    const recentData = useMemo(() => chartData.slice(-availableTicks), [chartData, availableTicks]);

    const currentDigitStats = useMemo(() => {
        const stats = Array(10).fill(0);
        const decimals = selectedMarket ? getDecimalsFromPip(selectedMarket.pip) : null;
        recentData.forEach(d => {
            if (d?.value != null) {
                // Get last digit from decimal part
                // Example: 23.40 -> 0, 23.34 -> 4, 123.456 -> 6
                let numStr;
                if (decimals !== null && decimals !== undefined) {
                    numStr = Math.abs(d.value).toFixed(decimals);
                } else {
                    numStr = Math.abs(d.value).toString();
                }
                const parts = numStr.split('.');
                let digit = 0;
                if (parts.length > 1 && parts[1].length > 0) {
                    // Get last digit from decimal part
                    const decimalPart = parts[1];
                    const lastChar = decimalPart.slice(-1);
                    digit = parseInt(lastChar, 10);
                } else {
                    // Get last digit from integer part if no decimal
                    const intPart = parts[0];
                    const lastChar = intPart.slice(-1);
                    digit = parseInt(lastChar, 10);
                }
                if (!isNaN(digit) && digit >= 0 && digit <= 9) stats[digit]++;
            }
        });
        return stats;
    }, [recentData, selectedMarket, getDecimalsFromPip]);

    const totalStats = availableTicks;

    const handleZoom = (direction) => {
        if (tradingChartRef.current?.isReady && !isZoomLocked) {
            tradingChartRef.current.zoom(direction);
        } else {
        }
    };

    const toggleZoomLock = () => {
        setIsZoomLocked(!isZoomLocked);
        toast({ description: isZoomLocked ? 'Zoom unlocked!' : 'Zoom locked—pinch to navigate.', duration: 1500 });
    };

    const handleNotImplemented = () => {
        toast({ description: "This feature isn't implemented yet." });
    };

    const handleDrawingToolSelect = (tool) => {
        if (tool === null) {
            // Deactivate tool
            setSelectedDrawingTool(null);
            toast({
                title: "Drawing Tool Deactivated",
                description: "Drawing tool has been deactivated.",
                duration: 2000,
            });
            return;
        }
        setSelectedDrawingTool(tool);
        toast({
            title: "Drawing Tool Activated",
            description: `${tool.label} is now active. Click on the chart to draw. You can draw multiple items.`,
            duration: 3000,
        });
    };

    // Update drawings count periodically
    useEffect(() => {
        const updateDrawingsInfo = () => {
            if (tradingChartRef.current) {
                const count = tradingChartRef.current.getDrawingsCount?.() || 0;
                const drawings = tradingChartRef.current.getDrawings?.() || [];
                setDrawingsCount(count);
                setActiveDrawings(drawings);
            }
        };

        // Update immediately and then periodically
        updateDrawingsInfo();
        const interval = setInterval(updateDrawingsInfo, 500);
        
        return () => clearInterval(interval);
    }, [chartData, selectedDrawingTool]); // Update when chart data or drawing tool changes

    // Set up double-click callback for drawings
    useEffect(() => {
        if (tradingChartRef.current && tradingChartRef.current.setDrawingDoubleClickCallback) {
            tradingChartRef.current.setDrawingDoubleClickCallback((drawing) => {
                setEditingDrawing(drawing);
                setIsDrawingEditModalOpen(true);
            });
        }
    }, []);

    const handleUpdateDrawing = useCallback((drawingId, updates) => {
        if (tradingChartRef.current && tradingChartRef.current.updateDrawing) {
            tradingChartRef.current.updateDrawing(drawingId, updates);
            // Refresh active drawings list
            if (tradingChartRef.current.getDrawings) {
                setActiveDrawings(tradingChartRef.current.getDrawings());
            }
        }
    }, []);

    const handleResetDrawing = useCallback((drawingId) => {
        if (tradingChartRef.current && tradingChartRef.current.getDrawing) {
            const drawing = tradingChartRef.current.getDrawing(drawingId);
            if (drawing) {
                // Reset to default colors
                const defaultColor = '#000000';
                const defaultFillColor = drawing.type === 'channel' ? 'rgba(0, 0, 0, 0.1)' : null;
                handleUpdateDrawing(drawingId, {
                    color: defaultColor,
                    fillColor: defaultFillColor
                });
            }
        }
    }, [handleUpdateDrawing]);

    const handleRemoveDrawing = useCallback((drawingId) => {
        if (tradingChartRef.current && tradingChartRef.current.removeDrawing) {
            const success = tradingChartRef.current.removeDrawing(drawingId);
            if (success) {
                // Update drawings info immediately
                const count = tradingChartRef.current.getDrawingsCount?.() || 0;
                const drawings = tradingChartRef.current.getDrawings?.() || [];
                setDrawingsCount(count);
                setActiveDrawings(drawings);
                
                // Don't clear drawing tool - keep it active (like Deriv)
                // User can continue drawing or manually deactivate
                
                toast({
                    title: "Drawing Removed",
                    description: "The drawing has been removed from the chart.",
                    duration: 2000,
                });
            }
        }
    }, [toast]);

    const handleClearAllDrawings = useCallback(() => {
        if (tradingChartRef.current && tradingChartRef.current.clearAllDrawings) {
            tradingChartRef.current.clearAllDrawings();
            setDrawingsCount(0);
            setActiveDrawings([]);
            
            // Clear drawing tool state when clearing all drawings
            setSelectedDrawingTool(null);
            
            toast({
                title: "All Drawings Cleared",
                description: "All drawings have been removed from the chart.",
                duration: 2000,
            });
        }
    }, [toast]);

    // Get chart type icon
    const getChartTypeIcon = () => {
        switch (chartType) {
            case 'area': return AreaChart;
            case 'candle': return CandlestickChart;
            case 'hollow': return CandlestickChart;
            case 'ohlc': return CandlestickChart;
            default: return AreaChart;
        }
    };

    // Format time interval for display
    const formatTimeInterval = (interval) => {
        if (interval.endsWith('t')) return interval;
        if (interval.endsWith('m')) return interval.replace('m', 'm');
        if (interval.endsWith('h')) return interval.replace('h', 'h');
        if (interval.endsWith('d')) return interval.replace('d', 'd');
        return interval;
    };

    const chartTools = [
        { 
            id: 'settings', 
            label: 'Chart Settings', 
            icon: Settings2, 
            action: () => setIsSettingsOpen(true),
            badge: () => {
                const ChartTypeIcon = getChartTypeIcon();
                return (
                    <div className="absolute -top-1 -right-1 bg-gray-700 text-white rounded-full p-0.5" title={`${chartType} - ${formatTimeInterval(timeInterval)}`}>
                        <ChartTypeIcon className="h-2.5 w-2.5" />
                    </div>
                );
            }
        },
        // Indicators button removed
        /*
        { 
            id: 'indicators', 
            label: 'Indicators', 
            icon: SlidersHorizontal, 
            action: () => setIsIndicatorsOpen(true),
            badge: () => activeIndicators.length > 0 ? (
                <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-bold">
                    {activeIndicators.length}
                </div>
            ) : null
        },
        */
        { 
            id: 'draw', 
            label: 'Drawing Tools', 
            icon: Pencil, 
            action: () => setIsDrawingToolsOpen(true),
            badge: () => {
                if (drawingsCount > 0) {
                    return (
                        <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-bold">
                            {drawingsCount}
                        </div>
                    );
                } else if (selectedDrawingTool) {
                    return (
                        <div className="absolute -top-1 -right-1 bg-green-500 rounded-full h-2 w-2"></div>
                    );
                }
                return null;
            }
        },
        { 
            id: 'download', 
            label: 'Download', 
            icon: Download, 
            action: handleNotImplemented 
        },
    ];

    const zoomTools = [
        { id: 'zoom-in', label: 'Zoom In', icon: Plus, action: () => handleZoom('in') },
        { id: 'zoom-lock', label: isZoomLocked ? 'Unlock Zoom' : 'Lock Zoom', icon: ZoomLockIcon, isLocked: isZoomLocked, action: toggleZoomLock },
        { id: 'zoom-out', label: 'Zoom Out', icon: Minus, action: () => handleZoom('out') },
    ];

    const handleScriptRunnerToggle = useCallback(() => {
        setIsScriptRunnerOpen(!isScriptRunnerOpen);
    }, [isScriptRunnerOpen, setIsScriptRunnerOpen]);

    return (
        <div className="flex-1 flex flex-col bg-[#fafafa] relative z-5 min-w-0 h-full">
            {/* Loading bar removed - no loading indicators shown */}

            {!isDigitsTrade && (
                <div 
                    className="w-full hidden md:block md:absolute md:top-4 md:left-16 md:z-20 pt-8 md:pt-0" 
                    style={{ 
                        willChange: 'auto',
                        contain: 'layout style paint',
                        transform: 'translateZ(0)'
                    }}
                >
                    <MarketSelector
                        selectedMarket={selectedMarket}
                        setSelectedMarket={setSelectedMarket}
                    />
                </div>
            )}


            <div className="absolute top-20 left-0 z-20 flex flex-col items-start gap-2 md:gap-2 md:top-20 md:left-4 pt-8 md:pt-0">
                {!isDigitsTrade && (
                    <>
                        <div className="bg-[#fafafa] border border-gray-200 rounded-xl p-1.5 md:p-2 flex flex-col gap-1 shadow-sm">
                            {chartTools.map(tool => {
                                const BadgeComponent = tool.badge;
                                return (
                                    <button
                                        key={tool.id}
                                        onClick={tool.action}
                                        className={`relative p-2 md:p-2.5 rounded-lg transition-all duration-150 hover:bg-gray-100 hover:text-gray-900 active:scale-95 text-gray-700 ${
                                            tool.id === 'draw' && selectedDrawingTool ? 'bg-gray-100 text-gray-900' : ''
                                        }`}
                                        title={tool.label}
                                    >
                                        <tool.icon className="h-5 w-5 md:h-4 w-4" />
                                        {BadgeComponent && <BadgeComponent />}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="hidden md:flex border border-gray-200 rounded-xl p-1.5 md:p-2 flex-col gap-1 shadow-sm">
                            {zoomTools.map(tool => {
                                const isDisabled = isZoomLocked && (tool.id === 'zoom-in' || tool.id === 'zoom-out');
                                return (
                                    <button
                                        key={tool.id}
                                        onClick={tool.action}
                                        disabled={isDisabled}
                                        className={`relative p-2 md:p-2.5 rounded-lg transition-all duration-150 hover:bg-gray-100 hover:text-gray-900 active:scale-95 text-gray-700 ${
                                            tool.id === 'zoom-lock' && isZoomLocked ? 'bg-gray-100 text-gray-900' : ''
                                        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        title={tool.label}
                                    >
                                        {tool.id === 'zoom-lock' ? (
                                            <tool.icon className="h-5 w-5 md:h-4 w-4" isLocked={tool.isLocked} />
                                        ) : (
                                            <tool.icon className="h-5 w-5 md:h-4 w-4" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>


            {/* Market selector button - mobile only, positioned on left side (hidden for digits trade) */}
            {!isDigitsTrade && (
                <div className="md:hidden absolute top-4 left-4 z-20" style={{ willChange: 'auto' }}>
                    <Button
                        key={selectedMarket?.symbol || 'no-market-mobile'}
                        variant="outline"
                        onClick={() => window.dispatchEvent(new CustomEvent('openMobileMarketSelector'))}
                        className="bg-[#fafafa] border border-gray-200 rounded-lg shadow-sm h-auto px-3 py-2.5 max-w-[180px] min-h-[48px]"
                    >
                        {selectedMarket ? (
                            <div className="flex items-center gap-2 min-w-0 w-full">
                                <div className="flex-shrink-0">
                                    <MarketIcon market={selectedMarket.market} flags={selectedMarket.flags} className="h-5 w-5 text-gray-500" />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col items-start">
                                    <span className="text-xs font-semibold text-black truncate w-full">{selectedMarket.name}</span>
                                    {mobilePriceInfo && (
                                        <div className="flex items-center gap-1 text-[10px] text-gray-500 min-h-[14px]">
                                            <span className="tabular-nums">{mobilePriceInfo.price}</span>
                                            <span className="tabular-nums">{mobilePriceInfo.change}</span>
                                            <span>({mobilePriceInfo.pctChange}%)</span>
                                            <span className="text-gray-500">▼</span>
                                        </div>
                                    )}
                                </div>
                                <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 ml-1" />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-gray-400" />
                                <span className="text-xs font-medium text-gray-600">Select Market</span>
                                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                            </div>
                        )}
                    </Button>
                </div>
            )}


            <div className={`flex-1 pr-0 ${isScriptRunnerOpen ? 'pb-40 md:pb-52' : 'pb-0'} relative md:pb-0 pb-12 md:pt-0 w-full h-full min-h-[350px] max-h-[calc(100vh-220px)] md:max-h-none`}>
                <div className="relative h-full w-full rounded-2xl overflow-hidden sm:border sm:border-gray-200 sm:rounded-none sm:ml-1 sm:mt-1 sm:mb-1 sm:mr-0 sm:shadow-inner flex flex-col">
                    {isDigitsTrade ? (
                        <div className="flex-1 min-h-[250px] sm:min-h-[450px] relative flex flex-col">
                            {/* Market selector - positioned at top for digits trade (both mobile and desktop) - ALWAYS VISIBLE */}
                            <div className="w-full pt-4 px-4 pb-2 z-10">
                                <div className="max-w-[280px] md:max-w-none">
                                    <MarketSelector
                                        selectedMarket={selectedMarket}
                                        setSelectedMarket={setSelectedMarket}
                                    />
                                </div>
                            </div>
                            {selectedMarket ? (
                                <div className="flex-1 min-h-0 overflow-hidden">
                                    <DigitsAnalysisPanel
                                        chartData={chartData}
                                        selectedTickCount={selectedTickCount}
                                        setSelectedTickCount={setSelectedTickCount}
                                        recentDigits={recentDigits}
                                        lastDigit={lastDigit}
                                        selectedDigit={selectedDigit}
                                        tradeType={tradeType}
                                        onSelectDigit={onSelectDigit}
                                        selectedMarket={selectedMarket}
                                    />
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-gray-500">
                                    <p>Please select a market to view digit analysis</p>
                                </div>
                            )}
                        </div>
                    ) : selectedMarket ? (
                        <div className="flex-1 h-auto sm:min-h-[450px] relative" style={{ willChange: 'auto' }}>
                            <div className="absolute inset-0 rounded-b-2xl overflow-hidden h-full w-full" style={{ contain: 'layout style paint' }}>
                                <TradingChart
                                    key={`${selectedMarket.symbol}-${chartType}-${timeInterval}`}
                                    ref={tradingChartRef}
                                    data={chartData}
                                    chartType={chartType}
                                    symbol={selectedMarket.symbol}
                                    indicators={activeIndicators}
                                    drawingTool={selectedDrawingTool}
                                    barriers={chartBarriers}
                                    marketName={selectedMarket.name || selectedMarket.display_name || ''}
                                    isZoomLocked={isZoomLocked}
                                    onToggleZoomLock={toggleZoomLock}
                                />
                            </div>
                            
                            {/* Jump to Latest Button - appears when scrolled to past */}
                            {isScrolledToPast && (
                                <Button
                                    onClick={() => {
                                        if (tradingChartRef.current && tradingChartRef.current.jumpToLatest) {
                                            tradingChartRef.current.jumpToLatest();
                                        }
                                    }}
                                    className="absolute top-1/2 -translate-y-1/2 right-4 z-30 h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
                                    title="Jump to Latest"
                                >
                                    <ArrowRight className="h-5 w-5" />
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center bg-white min-h-[350px]">
                            <div className="text-center text-gray-500 p-4">
                                <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-10" />
                                <p className="text-lg font-semibold mb-2">No Market Selected</p>
                                <p className="text-sm">Choose a market to view charts</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {aiPrediction && (() => {
                // Check if digit prediction exists
                const hasDigitPrediction = typeof aiPrediction.digitPrediction === 'number';
                const digitConfidence = hasDigitPrediction ? Math.round((aiPrediction.digitConfidence || 0.5) * 100) : null;
                
                // Define all available signals in the correct order
                // Order: Over/Under first, then Touch/No Touch, Even/Odd, Matches/Differs, then AI signals, then rest
                const allSignals = [
                    {
                        id: 'over_under',
                        title: 'Over / Under',
                        icon: TrendingUp,
                        direction: aiPrediction.direction,
                        confidence: hasDigitPrediction ? digitConfidence : (aiPrediction.overUnderConfidence ?? aiPrediction.confidence),
                        description: `Last digit ${aiPrediction.direction === 'RISE' ? 'over' : 'under'} threshold.`,
                        gradient: 'from-rose-50 to-white',
                        textColor: 'text-rose-600',
                        borderColor: 'border-rose-200',
                        iconColor: 'text-rose-600',
                        tag: 'Digit threshold trade',
                        isHighlighted: false,
                        priority: 0
                    },
                    {
                        id: 'touch_no_touch',
                        title: 'Touch / No Touch',
                        icon: Target,
                        direction: aiPrediction.direction,
                        confidence: hasDigitPrediction ? digitConfidence : (aiPrediction.touchNoTouchConfidence ?? aiPrediction.confidence),
                        description: hasDigitPrediction 
                            ? `First touch signal: AI predicts digit ${aiPrediction.digitPrediction} will touch. Barrier trading strategy.`
                            : `Price may ${aiPrediction.direction === 'RISE' ? 'touch' : 'not touch'} barrier level. Barrier trading strategy.`,
                        gradient: hasDigitPrediction ? 'from-purple-100 to-purple-50' : 'from-purple-50 to-white',
                        textColor: 'text-purple-600',
                        borderColor: hasDigitPrediction ? 'border-purple-400' : 'border-purple-200',
                        iconColor: 'text-purple-600',
                        tag: hasDigitPrediction ? `Digit ${aiPrediction.digitPrediction} first touch` : 'Barrier trading strategy',
                        digit: hasDigitPrediction ? aiPrediction.digitPrediction : null,
                        isHighlighted: hasDigitPrediction,
                        priority: 1
                    },
                    {
                        id: 'even_odd',
                        title: 'Even / Odd',
                        icon: BarChart3,
                        direction: aiPrediction.direction,
                        confidence: hasDigitPrediction ? digitConfidence : (aiPrediction.evenOddConfidence ?? aiPrediction.confidence),
                        description: `Last digit likely to be ${aiPrediction.direction === 'RISE' ? 'even' : 'odd'}.`,
                        gradient: 'from-teal-50 to-white',
                        textColor: 'text-teal-600',
                        borderColor: 'border-teal-200',
                        iconColor: 'text-teal-600',
                        tag: 'Binary digit option',
                        isHighlighted: false,
                        priority: 2
                    },
                    {
                        id: 'matches_differs',
                        title: 'Matches / Differs',
                        icon: Layers,
                        direction: aiPrediction.direction,
                        confidence: hasDigitPrediction ? digitConfidence : (aiPrediction.matchesDiffersConfidence ?? aiPrediction.confidence),
                        description: hasDigitPrediction
                            ? `Favoured digit ${aiPrediction.digitPrediction} (${digitConfidence}%)`
                            : `Last digit may ${aiPrediction.direction === 'RISE' ? 'match' : 'differ'} prediction.`,
                        gradient: hasDigitPrediction ? 'from-pink-100 to-pink-50' : 'from-pink-50 to-white',
                        textColor: 'text-pink-600',
                        borderColor: hasDigitPrediction ? 'border-pink-400' : 'border-pink-200',
                        iconColor: 'text-pink-600',
                        tag: hasDigitPrediction ? `Favoured digit ${aiPrediction.digitPrediction}` : 'Digit comparison',
                        digit: hasDigitPrediction ? aiPrediction.digitPrediction : null,
                        isHighlighted: hasDigitPrediction,
                        priority: 3
                    },
                    {
                        id: 'rise_fall',
                        title: 'Rise / Fall',
                        icon: TrendingUp,
                        direction: aiPrediction.direction,
                        confidence: aiPrediction.confidence,
                        description: `AI suggests ${aiPrediction.direction === 'RISE' ? 'RISE' : 'FALL'} on the next few ticks. Best for quick binaries.`,
                        gradient: 'from-green-50 to-white',
                        textColor: aiPrediction.direction === 'RISE' ? 'text-green-600' : 'text-red-600',
                        borderColor: 'border-green-300',
                        iconColor: 'text-green-600',
                        tag: 'Best for quick binaries',
                        isHighlighted: true,
                        priority: 4
                    },
                    {
                        id: 'higher_lower',
                        title: 'Higher / Lower',
                        icon: TrendingUp,
                        direction: aiPrediction.direction,
                        confidence: aiPrediction.higherLowerConfidence ?? aiPrediction.confidence,
                        description: `Bias to price closing ${aiPrediction.direction === 'RISE' ? 'HIGHER' : 'LOWER'} than current level. Good when trend is strong.`,
                        gradient: 'from-blue-50 to-white',
                        textColor: 'text-blue-600',
                        borderColor: 'border-blue-300',
                        iconColor: 'text-blue-600',
                        tag: 'Good when trend is strong',
                        isHighlighted: true,
                        priority: 5
                    },
                    {
                        id: 'ends_in_out',
                        title: 'Ends In / Out',
                        icon: Waves,
                        direction: aiPrediction.direction,
                        confidence: aiPrediction.endsInOutConfidence ?? aiPrediction.confidence,
                        description: `Price likely to end ${aiPrediction.direction === 'RISE' ? 'in' : 'out'} of range.`,
                        gradient: 'from-cyan-50 to-white',
                        textColor: 'text-cyan-600',
                        borderColor: 'border-cyan-200',
                        iconColor: 'text-cyan-600',
                        tag: 'Range-based trading',
                        isHighlighted: false,
                        priority: 6
                    },
                    {
                        id: 'stays_in_goes_out',
                        title: 'Stays In / Goes Out',
                        icon: Zap,
                        direction: aiPrediction.direction,
                        confidence: aiPrediction.staysInGoesOutConfidence ?? aiPrediction.confidence,
                        description: `Price expected to ${aiPrediction.direction === 'RISE' ? 'stay in' : 'go out'} range.`,
                        gradient: 'from-indigo-50 to-white',
                        textColor: 'text-indigo-600',
                        borderColor: 'border-indigo-200',
                        iconColor: 'text-indigo-600',
                        tag: 'Range volatility play',
                        isHighlighted: false,
                        priority: 7
                    }
                ];

                // Show all signals on one page with horizontal scroll and navigation buttons (desktop shows all)
                const scrollContainerRef = useRef(null);
                const isDraggingRef = useRef(false);
                const startXRef = useRef(0);
                const scrollLeftRef = useRef(0);

                const scrollSignals = (direction) => {
                    if (!scrollContainerRef.current) return;
                    const scrollAmount = 220; // Width of card + gap
                    const currentScroll = scrollContainerRef.current.scrollLeft;
                    const newScroll = direction === 'left' 
                        ? currentScroll - scrollAmount 
                        : currentScroll + scrollAmount;
                    scrollContainerRef.current.scrollTo({ left: newScroll, behavior: 'smooth' });
                };

                // Touch and mouse drag handlers
                const handleMouseDown = (e) => {
                    if (!scrollContainerRef.current) return;
                    isDraggingRef.current = true;
                    startXRef.current = e.pageX - scrollContainerRef.current.offsetLeft;
                    scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
                    scrollContainerRef.current.style.cursor = 'grabbing';
                    scrollContainerRef.current.style.userSelect = 'none';
                };

                const handleMouseMove = (e) => {
                    if (!isDraggingRef.current || !scrollContainerRef.current) return;
                    e.preventDefault();
                    const x = e.pageX - scrollContainerRef.current.offsetLeft;
                    const walk = (x - startXRef.current) * 2; // Scroll speed multiplier
                    scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
                };

                const handleMouseUp = () => {
                    if (!scrollContainerRef.current) return;
                    isDraggingRef.current = false;
                    scrollContainerRef.current.style.cursor = 'grab';
                    scrollContainerRef.current.style.userSelect = '';
                };

                const handleMouseLeave = () => {
                    if (!scrollContainerRef.current) return;
                    isDraggingRef.current = false;
                    scrollContainerRef.current.style.cursor = 'grab';
                    scrollContainerRef.current.style.userSelect = '';
                };

                return (
                    <div className="hidden md:block w-full border-t border-gray-200 bg-white px-3 py-1.5 overflow-hidden">
                        <div className="flex items-center gap-2 mb-1.5">
                            <Brain className="h-3 w-3 text-blue-600" />
                            <span className="text-[10px] font-semibold text-gray-800">
                                AI Trade Ideas
                            </span>
                            {aiPrediction.lastUpdated && (
                                <span className="ml-auto text-[9px] text-gray-400">
                                    Updated {new Date(aiPrediction.lastUpdated).toLocaleTimeString()}
                                </span>
                            )}
                        </div>
                        
                        {/* All signals in one carousel */}
                        <div className="relative">
                            {/* Navigation Buttons - Overlay on left and right */}
                            {allSignals.length > 3 && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 p-0 bg-white/95 hover:bg-white shadow-lg border border-gray-200 rounded-full"
                                            onClick={() => scrollSignals('left')}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-8 w-8 p-0 bg-white/95 hover:bg-white shadow-lg border border-gray-200 rounded-full"
                                            onClick={() => scrollSignals('right')}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                                
                            <div 
                                ref={scrollContainerRef}
                                className={`flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide cursor-grab active:cursor-grabbing ${allSignals.length > 3 ? 'px-10' : ''}`}
                                style={{ 
                                    scrollbarWidth: 'none', 
                                    msOverflowStyle: 'none',
                                    WebkitOverflowScrolling: 'touch',
                                    touchAction: 'pan-x'
                                }}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseLeave}
                                onTouchStart={(e) => {
                                    if (!scrollContainerRef.current) return;
                                    startXRef.current = e.touches[0].pageX - scrollContainerRef.current.offsetLeft;
                                    scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
                                }}
                                onTouchMove={(e) => {
                                    if (!scrollContainerRef.current) return;
                                    e.preventDefault();
                                    const x = e.touches[0].pageX - scrollContainerRef.current.offsetLeft;
                                    const walk = (x - startXRef.current) * 2;
                                    scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
                                }}
                            >
                                {allSignals.map((signal) => {
                                        const IconComponent = signal.icon;
                                        const isHighlighted = signal.isHighlighted;
                                        return (
                                            <div 
                                                key={signal.id} 
                                                className={`min-w-[180px] max-w-xs flex-shrink-0 rounded-lg border-2 ${signal.borderColor} bg-gradient-to-br ${signal.gradient} px-2.5 py-1.5 flex flex-col justify-between transition-all ${
                                                    isHighlighted 
                                                        ? signal.id === 'matches_differs' 
                                                            ? 'shadow-xl ring-4 ring-pink-200 ring-opacity-60' 
                                                            : 'shadow-xl ring-4 ring-blue-200 ring-opacity-60'
                                                        : 'shadow-sm'
                                                }`}
                                                style={isHighlighted ? {
                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                                    borderWidth: '3px',
                                                    transform: 'scale(1.02)'
                                                } : {}}
                                            >
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <div className="flex items-center gap-1">
                                                        <IconComponent className={`h-2.5 w-2.5 ${signal.iconColor}`} />
                                                        <span className={`text-[10px] font-semibold ${isHighlighted ? 'text-gray-900 font-bold' : 'text-gray-800'}`}>
                                                            {signal.title}
                                                            {isHighlighted && (
                                                                <span className={`ml-1 text-[8px] ${signal.id === 'matches_differs' ? 'text-pink-600' : 'text-blue-600'}`}>★</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className={`flex items-baseline gap-0.5 ${isHighlighted ? (signal.id === 'matches_differs' ? 'bg-pink-50 px-1.5 py-0.5 rounded-md' : 'bg-blue-50 px-1.5 py-0.5 rounded-md') : ''}`}>
                                                        {signal.digit ? (
                                                            <>
                                                                <span className={`text-[11px] font-bold ${signal.textColor}`}>
                                                                    {signal.digit}
                                                                </span>
                                                                <span className={`text-[10px] font-bold ${signal.textColor}`}>
                                                                    {signal.confidence}%
                                                                </span>
                                                                <span className={`text-[8px] font-medium text-gray-600`}>
                                                                    match
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className={`text-[11px] font-bold ${signal.textColor}`}>
                                                                    {signal.confidence}%
                                                                </span>
                                                                <span className={`text-[8px] font-medium text-gray-600`}>
                                                                    edge
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="text-[9px] text-gray-600 mb-0.5 line-clamp-2">
                                                    {(() => {
                                                        // Highlight trade types, digits, and "best method" phrases
                                                        const text = signal.description || '';
                                                        // Trade type keywords to highlight - match phrases first, then single words
                                                        const tradeTypePhrases = /\b(end in|end out|ends in|ends out|stay in|go out|stays in|goes out|no touch|touch)\b/gi;
                                                        const tradeTypeWords = /\b(RISE|FALL|HIGHER|LOWER|MATCHES|DIFFERS|matches|differs|match|differ|EVEN|ODD|even|odd|OVER|UNDER|over|under|CALL|PUT|call|put|UP|DOWN|up|down)\b/gi;
                                                        // Digit numbers (0-9) especially when mentioned with "digit" or in context
                                                        const digitPattern = /\b(digit\s+[0-9]|[0-9]\s*\([0-9.]+%\)|Favoured\s+digit\s+[0-9])\b/gi;
                                                        // Best method phrases
                                                        const bestMethodPattern = /\b(Best for|Good when|Ideal for|Perfect for|Recommended for|Suitable for|Optimal for|Great for)([^.!?]*?)(?=[.!?]|$)/gi;
                                                        
                                                        const parts = [];
                                                        let lastIndex = 0;
                                                        const matches = [];
                                                        
                                                        // Find all trade type phrase matches first (longer phrases)
                                                        let match;
                                                        while ((match = tradeTypePhrases.exec(text)) !== null) {
                                                            matches.push({ index: match.index, length: match[0].length, text: match[0], type: 'trade' });
                                                        }
                                                        
                                                        // Find all single trade type word matches
                                                        tradeTypeWords.lastIndex = 0;
                                                        while ((match = tradeTypeWords.exec(text)) !== null) {
                                                            // Check if this match overlaps with any existing phrase match
                                                            const overlaps = matches.some(m => 
                                                                match.index >= m.index && match.index < m.index + m.length
                                                            );
                                                            if (!overlaps) {
                                                                matches.push({ index: match.index, length: match[0].length, text: match[0], type: 'trade' });
                                                            }
                                                        }
                                                        
                                                        // Find all best method matches
                                                        bestMethodPattern.lastIndex = 0;
                                                        while ((match = bestMethodPattern.exec(text)) !== null) {
                                                            matches.push({ index: match.index, length: match[0].length, text: match[0], type: 'method' });
                                                        }
                                                        
                                                        // Sort matches by index
                                                        matches.sort((a, b) => a.index - b.index);
                                                        
                                                        // Build parts array
                                                        matches.forEach((match) => {
                                                            // Add text before match
                                                            if (match.index > lastIndex) {
                                                                parts.push({ text: text.substring(lastIndex, match.index), highlight: false });
                                                            }
                                                            // Add highlighted match
                                                            parts.push({ text: match.text, highlight: true, type: match.type });
                                                            lastIndex = match.index + match.length;
                                                        });
                                                        
                                                        // Add remaining text
                                                        if (lastIndex < text.length) {
                                                            parts.push({ text: text.substring(lastIndex), highlight: false });
                                                        }
                                                        
                                                        // If no matches, return original text
                                                        if (parts.length === 0) {
                                                            return text;
                                                        }
                                                        
                                                        return parts.map((part, idx) => {
                                                            if (part.highlight) {
                                                                let className;
                                                                if (part.type === 'digit') {
                                                                    className = "font-extrabold text-pink-700 bg-pink-100 px-1.5 py-0.5 rounded-md border border-pink-300 shadow-sm";
                                                                } else if (part.type === 'trade') {
                                                                    className = "font-extrabold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-md border border-purple-300 shadow-sm";
                                                                } else {
                                                                    className = "font-extrabold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-md border border-blue-300 shadow-sm";
                                                                }
                                                                return (
                                                                    <span key={idx} className={className}>
                                                                        {part.text}
                                                                    </span>
                                                                );
                                                            }
                                                            return <span key={idx}>{part.text}</span>;
                                                        });
                                                    })()}
                                                </p>
                                                <div className="flex items-center justify-between text-[8px] text-gray-500">
                                                    <span className={isHighlighted ? 'font-semibold text-gray-700' : ''}>{signal.tag}</span>
                                                    <ArrowRight className="h-2.5 w-2.5" />
                                                </div>
                                            </div>
                                        );
                                })}
                            </div>
                        </div>

                        {/* Signal count indicator */}
                        {allSignals.length > 6 && (
                            <div className="flex items-center justify-center mt-2">
                                <span className="text-[10px] text-gray-500">
                                    {allSignals.length} signals available
                                </span>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Desktop Script Runner Button */}
            <div className="hidden md:block w-full min-h-[4px] bg-white border-t border-gray-200 px-1.5 py-[2px]">
                {selectedMarket && (
                    <Button
                        onClick={handleScriptRunnerToggle}
                        variant="outline"
                        size="sm"
                        className="bg-white/90 backdrop-blur-md border-gray-300 hover:bg-white hover:border-gray-400 shadow-sm transition-all duration-200 text-[11px] font-medium h-6 px-1"
                    >
                        <Terminal className="h-3 w-3 mr-1" />
                        Script Runner
                    </Button>
                )}
            </div>

            {/* Mobile Floating Script Runner Button */}
            {selectedMarket && (
                <div className="md:hidden fixed right-4 z-50" style={{ bottom: '280px' }}>
                    <Button
                        onClick={handleScriptRunnerToggle}
                        variant="default"
                        size="icon"
                        className="h-12 w-12 rounded-full bg-gray-800 hover:bg-gray-900 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
                        aria-label="Script Runner"
                    >
                        <span className="text-lg font-mono text-white">{">_"}</span>
                    </Button>
                </div>
            )}

            {isScriptRunnerOpen && selectedMarket && (
                <div className={`fixed left-0 right-0 bg-white border-t border-gray-200 shadow-2xl transition-all duration-300 ease-out z-40 ${isScriptRunnerOpen ? 'bottom-14 md:bottom-0 md:left-16' : 'bottom-[-100%]'} `} style={{ height: '40vh' }}>
                    <div className="h-full flex flex-col p-3 md:p-4 overflow-hidden">
                        <div className="flex justify-between items-center mb-2 md:mb-4 border-b border-gray-200 pb-2">
                            <h3 className="text-sm md:text-lg font-semibold flex items-center">
                                <Terminal className="h-4 w-4 md:h-5 md:w-5 mr-2 text-blue-600" />
                                Script Runner
                            </h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleScriptRunnerToggle}
                                className="h-6 w-6 md:h-8 md:w-8 p-0"
                            >
                                <ChevronDown className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                        </div>
                        <div className="flex-1 bg-gray-50 rounded border p-2 mb-2 md:mb-3 overflow-y-auto">
                            <textarea
                                placeholder="Enter your script code here..."
                                className="w-full h-full resize-none outline-none bg-transparent text-xs md:text-sm font-mono text-gray-800"
                                rows={6}
                            />
                        </div>
                        <div className="flex gap-2 pt-1">
                            <Button size="sm" className="flex-1 text-xs md:text-sm" onClick={handleNotImplemented}>
                                Run Script
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs md:text-sm" onClick={handleNotImplemented}>
                                Save
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <ChartSettingsModal isOpen={isSettingsOpen} setIsOpen={setIsSettingsOpen} chartType={chartType} setChartType={setChartType} timeInterval={timeInterval} setTimeInterval={setTimeInterval} />
            {/* IndicatorsModal removed */}
            <DrawingToolsModal
                isOpen={isDrawingToolsOpen}
                setIsOpen={setIsDrawingToolsOpen}
                onToolSelect={(tool) => handleDrawingToolSelect(tool)}
                activeDrawings={activeDrawings}
                onRemoveDrawing={handleRemoveDrawing}
                onClearAllDrawings={handleClearAllDrawings}
                selectedTool={selectedDrawingTool}
                onSelectDrawing={(drawingId) => {
                    if (tradingChartRef.current && tradingChartRef.current.selectDrawing) {
                        tradingChartRef.current.selectDrawing(drawingId);
                        setSelectedDrawingTool(null); // Exit drawing mode when entering edit mode
                        toast({
                            title: "Edit Mode",
                            description: "Drawing selected. Click on the chart to move points.",
                            duration: 3000,
                        });
                    }
                }}
            />
            <DrawingEditModal
                isOpen={isDrawingEditModalOpen}
                setIsOpen={setIsDrawingEditModalOpen}
                drawing={editingDrawing}
                onUpdate={handleUpdateDrawing}
                onDelete={handleRemoveDrawing}
                onReset={handleResetDrawing}
            />
        </div>
    );
};

ChartArea.displayName = 'ChartArea';

export default ChartArea;