import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Search, Star, Globe, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDerivAPI } from '@/contexts/DerivContext';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import Sparkline from '@/components/Sparkline';
import { cn } from '@/lib/utils';
import { CandleWithImage, CryptoIcon, Forex, GlobalImage, Gold, StockChart } from "@/components/CandleWithImage.jsx";

function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

const currencyToCountry = {
    'EUR': 'eu',
    'USD': 'us',
    'GBP': 'gb',
    'JPY': 'jp',
    'AUD': 'au',
    'CAD': 'ca',
    'CHF': 'ch',
    'NZD': 'nz',
    'SGD': 'sg',
    'NOK': 'no',
    'SEK': 'se',
    'DKK': 'dk',
    'PLN': 'pl',
    'CZK': 'cz',
    'HUF': 'hu',
    'ILS': 'il',
    'ZAR': 'za',
    'TRY': 'tr',
    'MXN': 'mx',
    'HKD': 'hk',
    'KRW': 'kr',
    'INR': 'in',
    'CNY': 'cn',
    'BRL': 'br',
    'RUB': 'ru',
    'THB': 'th',
    'MYR': 'my',
    'IDR': 'id',
    'PHP': 'ph',
    'VND': 'vn',
    'AED': 'ae',
    'SAR': 'sa',
    'KWD': 'kw',
    'QAR': 'qa',
    'OMR': 'om',
    'BHD': 'bh',
    'JOD': 'jo',
    'LBP': 'lb',
    'EGP': 'eg',
};

const MarketIcon = ({ market, flags, className }) => {
    if (market === 'forex' && flags?.length === 2) {
        return (
            <div className="flex -space-x-2 overflow-hidden">
                {flags.map(flag => {
                    const countryCode = currencyToCountry[flag.toUpperCase()] || flag.toLowerCase();
                    return (
                        <img
                            key={flag}
                            className="inline-block h-6 w-6 rounded-full"
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

const MarketRow = ({ symbol, onSelect, history, className }) => {
    const isUp = history && history.length > 1 && history[history.length - 1].value > history[0].value;
    return (
        <Button
            variant="ghost"
            className={cn("w-full justify-between h-auto p-4 border-b border-gray-100 hover:bg-gray-50 rounded-none touch-manipulation", className)}
            onClick={() => onSelect(symbol)}
        >
            <div className="flex items-center gap-4">
                <MarketIcon market={symbol.market} flags={symbol.flags} className="h-8 w-8 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base truncate">{symbol.name}</p>
                    <p className="text-xs text-gray-500">{symbol.market_display_name}</p>
                </div>
            </div>
            <div className="flex flex-col items-end gap-2">
                <div className="w-24 h-5">
                    <Sparkline data={history} color={isUp ? '#22c55e' : '#ef4444'} />
                </div>
                <Star className="h-5 w-5 text-gray-300 hover:text-yellow-400" />
            </div>
        </Button>
    );
};

const MobileMarketSelector = ({ isOpen, onClose, selectedMarket, setSelectedMarket }) => {
    const { activeSymbols, marketHistory } = useDerivAPI();
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const [expandedCategories, setExpandedCategories] = useState(new Set());
    const [expandedSubcategories, setExpandedSubcategories] = useState(new Set());
    const [navigationStack, setNavigationStack] = useState([]);
    const scrollAreaRef = useRef(null);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
    const [isScrolling, setIsScrolling] = useState(false);

    const handleTouchStart = useCallback((e) => {
        setTouchStart({
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        });
        setIsScrolling(false);
    }, []);

    const handleTouchMove = useCallback((e) => {
        const touchY = e.touches[0].clientY;
        const diffY = Math.abs(touchY - touchStart.y);

        if (diffY > 10) {
            setIsScrolling(true);
        }
    }, [touchStart]);

    const handleTouchEnd = useCallback((e) => {
        const touchEnd = {
            x: e.changedTouches[0].clientX,
            y: e.changedTouches[0].clientY
        };

        const diffX = touchEnd.x - touchStart.x;
        const diffY = Math.abs(touchEnd.y - touchStart.y);

        if (!isScrolling && Math.abs(diffX) > 50 && diffY < 30) {
            if (diffX < -50) {
                onClose();
            }
        }

        setIsScrolling(false);
    }, [touchStart, isScrolling, onClose]);

    const { categories, subcategoriesByCategory, symbolsBySubcategory } = useMemo(() => {
        if (!activeSymbols.length) return { categories: [], subcategoriesByCategory: {}, symbolsBySubcategory: {} };
        const categoryMap = new Map();
        const subcategoriesMap = new Map();
        const symbolsMap = {};

        activeSymbols.forEach(rawSymbol => {
            const processedSymbol = {
                ...rawSymbol,
                id: rawSymbol.symbol,
                name: rawSymbol.display_name,
                flags: rawSymbol.market === 'forex' && rawSymbol.display_name.includes('/')
                    ? rawSymbol.display_name.split('/')
                    : [],
            };
            const catKey = processedSymbol.market_display_name.toLowerCase().replace(/\s/g, '_');
            const catLabel = processedSymbol.market_display_name;
            let iconComponent;
            if (processedSymbol.market === 'forex') iconComponent = Forex;
            else if (processedSymbol.market === 'indices') iconComponent = StockChart;
            else if (processedSymbol.market === 'cryptocurrency') iconComponent = CryptoIcon;
            else if (processedSymbol.market === 'commodities') iconComponent = Gold;
            else iconComponent = GlobalImage;

            if (!categoryMap.has(catKey)) {
                categoryMap.set(catKey, {
                    key: catKey,
                    label: catLabel,
                    icon: iconComponent
                });
            }

            let subKey, subLabel;
            if (processedSymbol.market === 'synthetic_index') {
                subKey = processedSymbol.subgroup_display_name.toLowerCase().replace(/\s/g, '_');
                subLabel = processedSymbol.subgroup_display_name;
            } else {
                subKey = processedSymbol.submarket_display_name.toLowerCase().replace(/\s/g, '_');
                subLabel = processedSymbol.submarket_display_name;
            }
            subKey = subKey === 'none' ? 'all' : subKey;
            subLabel = subLabel === 'none' ? 'All' : subLabel;

            if (!subcategoriesMap.has(catKey)) {
                subcategoriesMap.set(catKey, new Map());
            }
            if (!subcategoriesMap.get(catKey).has(subKey)) {
                subcategoriesMap.get(catKey).set(subKey, {
                    key: subKey,
                    label: subLabel,
                });
            }

            const fullSubKey = `${catKey}_${subKey}`;
            if (!symbolsMap[fullSubKey]) {
                symbolsMap[fullSubKey] = [];
            }
            symbolsMap[fullSubKey].push(processedSymbol);
        });

        let categories = Array.from(categoryMap.values());
        const preferredOrder = [
            'derived',
            'forex',
            'stock_indices',
            'commodities',
            'cryptocurrencies'
        ];
        categories = categories.sort((a, b) => {
            const indexA = preferredOrder.indexOf(a.key);
            const indexB = preferredOrder.indexOf(b.key);
            return (indexA === -1 ? preferredOrder.length : indexA) - (indexB === -1 ? preferredOrder.length : indexB);
        });

        const subcategoriesByCategory = {};
        subcategoriesMap.forEach((subs, catKey) => {
            subcategoriesByCategory[catKey] = Array.from(subs.values()).sort((a, b) => a.label.localeCompare(b.label));
        });

        return {
            categories,
            subcategoriesByCategory,
            symbolsBySubcategory: symbolsMap
        };
    }, [activeSymbols]);

    const filteredSymbols = useMemo(() => {
        if (debouncedSearchQuery) {
            return activeSymbols
                .map(rawSymbol => ({
                    ...rawSymbol,
                    id: rawSymbol.symbol,
                    name: rawSymbol.display_name,
                    flags: rawSymbol.market === 'forex' && rawSymbol.display_name.includes('/')
                        ? rawSymbol.display_name.split('/')
                        : [],
                }))
                .filter(symbol => symbol.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
                .sort((a, b) => a.display_order - b.display_order);
        }
        return [];
    }, [activeSymbols, debouncedSearchQuery]);

    const handleSelect = useCallback((symbol) => {
        setSelectedMarket(symbol);
        onClose();
    }, [setSelectedMarket, onClose]);

    const handleClearSearch = useCallback(() => {
        setSearchQuery('');
    }, []);

    const toggleExpanded = useCallback((catKey) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(catKey)) {
                newSet.delete(catKey);
            } else {
                newSet.add(catKey);
            }
            return newSet;
        });
    }, []);

    const toggleExpandedSub = useCallback((fullSubKey) => {
        setExpandedSubcategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fullSubKey)) {
                newSet.delete(fullSubKey);
                setNavigationStack(prevStack => prevStack.filter(item => item !== fullSubKey));
            } else {
                newSet.add(fullSubKey);
                setNavigationStack(prevStack => [...prevStack, fullSubKey]);
            }
            return newSet;
        });
    }, []);

    const handleBack = useCallback(() => {
        if (navigationStack.length > 0) {
            const lastKey = navigationStack[navigationStack.length - 1];
            setExpandedSubcategories(prev => {
                const newSet = new Set(prev);
                newSet.delete(lastKey);
                return newSet;
            });
            setNavigationStack(prevStack => prevStack.slice(0, -1));
        }
    }, [navigationStack]);

    const renderSymbolsForSub = useCallback((fullSubKey, catKey) => {
        const symbols = symbolsBySubcategory[fullSubKey] || [];
        if (symbols.length === 0) return null;

        const sortedSymbols = symbols.sort((a, b) => a.display_order - b.display_order);
        return (
            <div className="space-y-0 touch-pan-y">
                {sortedSymbols.map((symbol) => (
                    <MarketRow
                        key={symbol.id}
                        symbol={symbol}
                        history={marketHistory[symbol.id]}
                        onSelect={handleSelect}
                    />
                ))}
            </div>
        );
    }, [symbolsBySubcategory, marketHistory, handleSelect]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="absolute inset-0 bg-gradient-to-b from-blue-50/20 to-white/10" />

            <div className="relative h-full w-full flex items-center justify-center p-4">
                <div
                    className="bg-white w-full max-w-2xl h-full max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 touch-pan-y"
                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
                    onTouchStart={(e) => e.stopPropagation()} // Prevent backdrop touch handlers
                    onTouchMove={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                >
                    <div className="sticky top-0 bg-white border-b z-10 p-4 flex-shrink-0 touch-none">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">Select Market</h2>
                                    <p className="text-sm text-gray-500">Choose from 100+ markets</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full hover:bg-gray-100 touch-manipulation"
                                onClick={onClose}
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <Input
                                placeholder="Search markets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-11 bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 text-lg h-12 rounded-xl touch-pan-y"
                                onTouchStart={(e) => e.stopPropagation()}
                            />
                            {searchQuery && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full touch-manipulation"
                                    onClick={handleClearSearch}
                                    onTouchStart={(e) => e.stopPropagation()}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    <ScrollArea
                        ref={scrollAreaRef}
                        className="flex-1 min-h-0 touch-pan-y"
                        onTouchStart={(e) => {
                            e.stopPropagation();
                            handleTouchStart(e);
                        }}
                        onTouchMove={(e) => {
                            e.stopPropagation();
                            handleTouchMove(e);
                        }}
                        onTouchEnd={(e) => {
                            e.stopPropagation();
                            handleTouchEnd(e);
                        }}
                    >
                        <div className="p-4">
                            {debouncedSearchQuery ? (
                                filteredSymbols.length > 0 ? (
                                    <div className="space-y-1">
                                        {filteredSymbols.map((symbol) => (
                                            <MarketRow
                                                key={symbol.id}
                                                symbol={symbol}
                                                history={marketHistory[symbol.id]}
                                                onSelect={handleSelect}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                        <Search className="h-12 w-12 mb-4 opacity-50" />
                                        <p className="text-lg font-medium">No markets found</p>
                                        <p className="text-sm mt-1">Try a different search term</p>
                                        {debouncedSearchQuery && (
                                            <Button
                                                variant="outline"
                                                className="mt-4 touch-manipulation"
                                                onClick={handleClearSearch}
                                            >
                                                Clear Search
                                            </Button>
                                        )}
                                    </div>
                                )
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Quick Access</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Button
                                                variant="outline"
                                                className="h-16 flex-col gap-1 touch-manipulation"
                                                onClick={() => {
                                                    const derived = activeSymbols.find(s => s.market === 'synthetic_index');
                                                    if (derived) handleSelect(derived);
                                                }}
                                            >
                                                <CandleWithImage className="h-6 w-6" />
                                                <span className="text-xs">Derived</span>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="h-16 flex-col gap-1 touch-manipulation"
                                                onClick={() => {
                                                    const forex = activeSymbols.find(s => s.market === 'forex');
                                                    if (forex) handleSelect(forex);
                                                }}
                                            >
                                                <Forex className="h-6 w-6" />
                                                <span className="text-xs">Forex</span>
                                            </Button>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">All Categories</h3>
                                        <div className="space-y-2">
                                            {categories.map(({ key: catKey, label: catLabel, icon: Icon }) => {
                                                const isExpanded = expandedCategories.has(catKey);
                                                const subs = subcategoriesByCategory[catKey] || [];
                                                const hasSubs = subs.length > 0;

                                                return (
                                                    <div key={catKey} className="border rounded-lg overflow-hidden touch-pan-y">
                                                        <Button
                                                            variant="ghost"
                                                            className="w-full justify-between p-4 text-base font-medium rounded-none touch-manipulation"
                                                            onClick={() => hasSubs ? toggleExpanded(catKey) : null}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <Icon className="h-5 w-5 text-gray-600" />
                                                                <span>{catLabel}</span>
                                                            </div>
                                                            {hasSubs && (
                                                                <ChevronRight className={cn(
                                                                    "h-5 w-5 transition-transform duration-200",
                                                                    isExpanded ? 'rotate-90' : ''
                                                                )} />
                                                            )}
                                                        </Button>

                                                        {isExpanded && hasSubs && (
                                                            <div className="border-t bg-gray-50/50 touch-pan-y">
                                                                {subs.map(({ key: subKey, label: subLabel }) => {
                                                                    const fullSubKey = `${catKey}_${subKey}`;
                                                                    const isSubExpanded = expandedSubcategories.has(fullSubKey);
                                                                    const subSymbols = symbolsBySubcategory[fullSubKey] || [];

                                                                    return (
                                                                        <div key={subKey} className="border-b last:border-b-0">
                                                                            <Button
                                                                                variant="ghost"
                                                                                className="w-full justify-between p-4 pl-12 text-sm font-medium rounded-none bg-white touch-manipulation"
                                                                                onClick={() => subSymbols.length > 0 ? toggleExpandedSub(fullSubKey) : null}
                                                                            >
                                                                                <span>{subLabel}</span>
                                                                                {subSymbols.length > 0 && (
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-xs text-gray-500">{subSymbols.length}</span>
                                                                                        <ChevronRight className={cn(
                                                                                            "h-4 w-4 transition-transform duration-200",
                                                                                            isSubExpanded ? 'rotate-90' : ''
                                                                                        )} />
                                                                                    </div>
                                                                                )}
                                                                            </Button>

                                                                            {isSubExpanded && subSymbols.length > 0 && (
                                                                                <div className="pl-16 pr-4 py-2 bg-white touch-pan-y">
                                                                                    {renderSymbolsForSub(fullSubKey, catKey)}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {selectedMarket && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Current Selection</h3>
                                            <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-white">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <MarketIcon
                                                            market={selectedMarket.market}
                                                            flags={selectedMarket.flags}
                                                            className="h-10 w-10"
                                                        />
                                                        <div>
                                                            <p className="font-bold text-lg">{selectedMarket.name}</p>
                                                            <p className="text-sm text-gray-600">{selectedMarket.market_display_name}</p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        className="touch-manipulation"
                                                        onClick={() => handleSelect(selectedMarket)}
                                                    >
                                                        Select
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {navigationStack.length > 0 && (
                        <div className="sticky bottom-0 bg-white border-t p-4 touch-none">
                            <Button
                                variant="outline"
                                className="w-full touch-manipulation"
                                onClick={handleBack}
                            >
                                <ChevronLeft className="h-4 w-4 mr-2" />
                                Back
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MobileMarketSelector;