import React from 'react';
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Custom chart type icons
const AreaIcon = ({ className }) => (
    <svg viewBox="0 0 40 30" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 20 L8 15 L16 10 L24 12 L32 8 L40 5 L40 30 L0 30 Z" fill="currentColor" fillOpacity="0.3"/>
        <path d="M0 20 L8 15 L16 10 L24 12 L32 8 L40 5" stroke="currentColor" strokeWidth="2" fill="none"/>
    </svg>
);

const CandleIcon = ({ className }) => (
    <svg viewBox="0 0 40 30" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* First candle - red */}
        <line x1="10" y1="5" x2="10" y2="25" stroke="#ef4444" strokeWidth="2"/>
        <rect x="7" y="8" width="6" height="8" fill="#ef4444"/>
        <rect x="7" y="18" width="6" height="7" fill="#ef4444"/>
        {/* Second candle - teal */}
        <line x1="25" y1="10" x2="25" y2="25" stroke="#14b8a6" strokeWidth="2"/>
        <rect x="22" y="10" width="6" height="10" fill="#14b8a6"/>
        <rect x="22" y="22" width="6" height="3" fill="#14b8a6"/>
    </svg>
);

const HollowIcon = ({ className }) => (
    <svg viewBox="0 0 40 30" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* First candle - red outline */}
        <line x1="10" y1="5" x2="10" y2="25" stroke="#ef4444" strokeWidth="2"/>
        <rect x="7" y="8" width="6" height="8" stroke="#ef4444" strokeWidth="1.5" fill="none"/>
        <rect x="7" y="18" width="6" height="7" stroke="#ef4444" strokeWidth="1.5" fill="none"/>
        {/* Second candle - teal outline */}
        <line x1="25" y1="10" x2="25" y2="25" stroke="#14b8a6" strokeWidth="2"/>
        <rect x="22" y="10" width="6" height="10" stroke="#14b8a6" strokeWidth="1.5" fill="none"/>
        <rect x="22" y="22" width="6" height="3" stroke="#14b8a6" strokeWidth="1.5" fill="none"/>
    </svg>
);

const OHLCIcon = ({ className }) => (
    <svg viewBox="0 0 40 30" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* First OHLC bar - red */}
        <line x1="10" y1="5" x2="10" y2="8" stroke="#ef4444" strokeWidth="2"/>
        <line x1="10" y1="8" x2="10" y2="18" stroke="#ef4444" strokeWidth="2"/>
        <line x1="8" y1="18" x2="12" y2="18" stroke="#ef4444" strokeWidth="2"/>
        <line x1="10" y1="18" x2="10" y2="22" stroke="#ef4444" strokeWidth="2"/>
        <line x1="8" y1="22" x2="12" y2="22" stroke="#ef4444" strokeWidth="2"/>
        <line x1="10" y1="22" x2="10" y2="25" stroke="#ef4444" strokeWidth="2"/>
        {/* Second OHLC bar - teal */}
        <line x1="25" y1="10" x2="25" y2="12" stroke="#14b8a6" strokeWidth="2"/>
        <line x1="25" y1="12" x2="25" y2="18" stroke="#14b8a6" strokeWidth="2"/>
        <line x1="23" y1="18" x2="27" y2="18" stroke="#14b8a6" strokeWidth="2"/>
        <line x1="25" y1="18" x2="25" y2="22" stroke="#14b8a6" strokeWidth="2"/>
        <line x1="23" y1="22" x2="27" y2="22" stroke="#14b8a6" strokeWidth="2"/>
        <line x1="25" y1="22" x2="25" y2="25" stroke="#14b8a6" strokeWidth="2"/>
    </svg>
);

const ChartSettingsModal = ({ isOpen, setIsOpen, chartType, setChartType, timeInterval, setTimeInterval }) => {
    const chartTypes = [
        { id: 'area', label: 'Area', icon: AreaIcon },
        { id: 'candle', label: 'Candle', icon: CandleIcon },
        { id: 'hollow', label: 'Hollow', icon: HollowIcon },
        { id: 'ohlc', label: 'OHLC', icon: OHLCIcon },
    ];

    const timeIntervals = [
        { id: '1t', label: '1 tick' }, 
        { id: '1m', label: '1 minute' }, 
        { id: '2m', label: '2 minutes' }, 
        { id: '3m', label: '3 minutes' },
        { id: '5m', label: '5 minutes' }, 
        { id: '10m', label: '10 minutes' }, 
        { id: '15m', label: '15 minutes' }, 
        { id: '30m', label: '30 minutes' },
        { id: '1h', label: '1 hour' }, 
        { id: '2h', label: '2 hours' }, 
        { id: '4h', label: '4 hours' }, 
        { id: '8h', label: '8 hours' },
        { id: '1d', label: '1 day' },
    ];

    const shouldDisableInterval = (id) => {
        if (chartType === 'area') {
            return false;
        }
        return id === '1t';
    };

    const shouldDisableChart = (id) => timeInterval === '1t' && id !== 'area';

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[500px] w-[95vw] max-w-[500px] p-0 gap-0 flex flex-col max-h-[90vh] sm:max-h-[85vh]">
                {/* Header with title */}
                <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900">Chart types</h2>
                </div>

                <ScrollArea className="flex-1 overflow-y-auto">
                    <div className="px-6 py-6">
                        {/* Chart types section */}
                        <div className="mb-8">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {chartTypes.map((type) => {
                                    const Icon = type.icon;
                                    const isSelected = chartType === type.id;
                                    const isDisabled = shouldDisableChart(type.id);
                                    
                                    return (
                                        <button
                                            key={type.id}
                                            onClick={() => {
                                                if (!isDisabled) {
                                                    setChartType(type.id);
                                                    if (type.id !== 'area') {
                                                        setTimeInterval('1m');
                                                    }
                                                }
                                            }}
                                            disabled={isDisabled}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                                                "h-20 w-full",
                                                isSelected 
                                                    ? "border-[#14b8a6] bg-gray-50" 
                                                    : "border-gray-200 bg-white hover:border-gray-300",
                                                isDisabled && "opacity-40 cursor-not-allowed"
                                            )}
                                        >
                                            <Icon className="h-8 w-8 text-gray-700" />
                                            <span className={cn(
                                                "text-xs font-medium",
                                                isSelected ? "font-semibold text-gray-900" : "text-gray-600"
                                            )}>
                                                {type.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Time interval section */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-4">Time interval</h3>
                            {/* Grid: 2 columns on mobile, 4 columns on desktop */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {timeIntervals.map((interval) => {
                                    const isSelected = timeInterval === interval.id;
                                    const isDisabled = shouldDisableInterval(interval.id);
                                    
                                    return (
                                        <button
                                            key={interval.id}
                                            onClick={() => {
                                                if (!isDisabled) {
                                                    setTimeInterval(interval.id);
                                                }
                                            }}
                                            disabled={isDisabled}
                                            className={cn(
                                                "px-3 py-2 text-sm font-medium rounded-md border transition-all",
                                                isSelected 
                                                    ? "border-[#14b8a6] bg-gray-50 text-gray-900" 
                                                    : isDisabled
                                                    ? "border-gray-200 bg-white text-gray-400 cursor-not-allowed"
                                                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                                            )}
                                        >
                                            {interval.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default ChartSettingsModal;
