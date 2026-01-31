import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronDown, Search, Star, Globe, Coins, ChevronRight, ChevronLeft, X, } from 'lucide-react';
import { useDerivAPI } from '@/contexts/DerivContext';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import Sparkline from '@/components/Sparkline';
import { cn } from '@/lib/utils';
import { CandleWithImage, CryptoIcon, Forex, GlobalImage, Gold, StockChart } from "@/components/CandleWithImage.jsx";
// Simple custom debounce hook to avoid external dependency
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

  return [debouncedValue];
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
  // Add more as needed
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
  const color = isUp ? 'text-green-500' : 'text-red-500';
  return (
    <Button
      variant="ghost"
      className={cn("w-full justify-between h-auto p-4 md:p-2 border-b border-gray-100 hover:bg-gray-50 rounded-lg mx-2 mt-1", className)}
      onClick={() => onSelect(symbol)}
    >
      <div className="flex items-center gap-4">
        <MarketIcon market={symbol.market} flags={symbol.flags} className="h-8 w-8 md:h-6 md:w-6 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base md:text-sm truncate">{symbol.name}</p>
          <p className="text-xs text-gray-500 hidden md:block">{symbol.market_display_name}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 md:flex-row md:gap-4 md:items-center">
        <div className="w-24 h-5 md:w-20 md:h-6">
          <Sparkline data={history} color={isUp ? '#22c55e' : '#ef4444'} />
        </div>
        <div className="flex items-center text-xs">
          <span className={cn("sr-only", color)}>{isUp ? 'Uptrend' : 'Downtrend'}</span>
        </div>
        <Star className="h-5 w-5 text-gray-300 hover:text-yellow-400 self-end md:self-auto" />
      </div>
    </Button>
  );
};

const SubmarketButton = ({ subKey, label, activeCategory, onClick }) => (
  <Button
    variant={activeCategory === subKey ? 'secondary' : 'ghost'}
    className="w-full justify-start pl-8 text-sm font-medium text-gray-600 px-3 py-2"
    onClick={() => onClick(subKey)}
  >
    {label}
  </Button>
);

const CategoryButtonMobile = ({ catKey, catLabel, icon: Icon, activeCategory, onClick, hasSubs }) => (
  <Button
    variant={activeCategory === catKey || activeCategory.startsWith(`${catKey}_`) ? 'secondary' : 'ghost'}
    size="sm"
    className="w-full justify-start text-sm font-medium px-3 py-3 rounded-md mb-1 flex items-center gap-2 min-h-[48px]"
    onClick={onClick}
  >
    <Icon className="h-4 w-4" />
    {catLabel}
    {hasSubs && <ChevronRight className="h-4 w-4 ml-auto" />}
  </Button>
);

const NoMarkets = ({ isShowingSubs, debouncedSearchQuery, onClearSearch }) => (
  <div className="flex items-center justify-center h-48 text-gray-500 text-base text-center px-4 bg-gray-50 rounded-lg m-4">
    <div>
      <p>{isShowingSubs ? `Select a subcategory to view markets` : `No markets found${debouncedSearchQuery ? ` for "${debouncedSearchQuery}"` : ''}`}</p>
      {debouncedSearchQuery && <p className="text-sm mt-1">Try "EUR/USD" or "Volatility".</p>}
      {debouncedSearchQuery && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onClearSearch}
        >
          Clear Search
        </Button>
      )}
    </div>
  </div>
);

const MarketSelector = ({ selectedMarket, setSelectedMarket }) => {
  const { activeSymbols, tickData, marketHistory, subscribeTick } = useDerivAPI();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const [activeCategory, setActiveCategory] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(new Set(['derived']));
  const [expandedSubcategories, setExpandedSubcategories] = useState(new Set());
  const [isMobile, setIsMobile] = useState(false);
  const [navigationStack, setNavigationStack] = useState([]); // For mobile back navigation
  const [viewMode, setViewMode] = useState('categories'); // 'categories' or 'content'

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    setIsMobile(media.matches);
    const listener = (e) => setIsMobile(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setViewMode('categories');
    } else {
      setViewMode('content');
    }
  }, [isMobile]);

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
      // For Derived, use subgroup_display_name as subcategory; for others, use submarket_display_name
      let subKey, subLabel;
      if (processedSymbol.market === 'synthetic_index') {
        subKey = processedSymbol.subgroup_display_name.toLowerCase().replace(/\s/g, '_');
        subLabel = processedSymbol.subgroup_display_name;
      } else {
        subKey = processedSymbol.submarket_display_name.toLowerCase().replace(/\s/g, '_');
        subLabel = processedSymbol.submarket_display_name;
      }
      subKey = subKey === 'none' ? 'all' : subKey; // Treat 'none' as 'all' for no sub
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
    // Preferred order: Derived first
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

  const rawFilteredSymbols = useMemo(() => {
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
        .filter(symbol => symbol.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()));
    } else {
      return (symbolsBySubcategory[activeCategory] || []);
    }
  }, [activeSymbols, symbolsBySubcategory, activeCategory, debouncedSearchQuery]);

  const filteredSymbols = useMemo(() => rawFilteredSymbols.sort((a, b) => a.display_order - b.display_order), [rawFilteredSymbols]);

  const groupedSymbols = useMemo(() => {
    if (debouncedSearchQuery || !activeCategory.startsWith('derived')) {
      return { groups: [], symbols: filteredSymbols };
    }
    const groups = {};
    rawFilteredSymbols.forEach(symbol => {
      const sub = symbol.submarket_display_name || 'Uncategorized';
      if (!groups[sub]) {
        groups[sub] = [];
      }
      groups[sub].push(symbol);
    });
    const sortedGroups = Object.entries(groups).map(([name, syms]) => ({
      name,
      symbols: syms.sort((a, b) => a.display_order - b.display_order)
    }));
    return { groups: sortedGroups, symbols: [] };
  }, [rawFilteredSymbols, activeCategory, debouncedSearchQuery, filteredSymbols]);

  // Set default active category for desktop
  useEffect(() => {
    if (categories.length && !activeCategory && !isMobile) {
      setActiveCategory(categories[0].key);
    }
  }, [categories, activeCategory, isMobile]);

  // Set default expansions for mobile tree
  useEffect(() => {
    if (categories.length && isMobile) {
      const firstCatKey = categories[0].key;
      setExpandedCategories(prev => new Set([firstCatKey])); // Single expansion
      const firstSubs = subcategoriesByCategory[firstCatKey] || [];
      if (firstSubs.length > 0) {
        const firstSubKey = firstSubs[0].key;
        const firstFullKey = `${firstCatKey}_${firstSubKey}`;
        setExpandedSubcategories(prev => new Set([firstFullKey])); // Expand first sub
        setNavigationStack([{ type: 'sub', key: firstFullKey }]);
      }
    }
  }, [categories, subcategoriesByCategory, isMobile]);

  const currentCat = activeCategory.includes('_') ? activeCategory.split('_')[0] : activeCategory;
  const currentSubs = subcategoriesByCategory[currentCat] || [];
  const isShowingSubs = currentSubs.length > 0 && !activeCategory.includes('_') && activeCategory !== '';

  const toggleExpanded = useCallback((catKey) => {
    setExpandedCategories(prev => {
      const newSet = new Set();
      if (prev.has(catKey)) {
        // Collapse
      } else {
        newSet.add(catKey);
      }
      return newSet;
    });
    // Collapse all subs when category changes
    setExpandedSubcategories(new Set());
    setNavigationStack([]); // Reset navigation on category change
  }, []);

  const toggleExpandedSub = useCallback((fullSubKey) => {
    setExpandedSubcategories(prev => {
      const newSet = new Set();
      if (prev.has(fullSubKey)) {
        // Collapse
      } else {
        newSet.add(fullSubKey);
      }
      return newSet;
    });
    // Push to navigation stack for back button
    setNavigationStack(prev => [...prev, { type: 'sub', key: fullSubKey }]);
  }, []);

  const handleBack = useCallback(() => {
    if (navigationStack.length > 0) {
      const last = navigationStack[navigationStack.length - 1];
      if (last.type === 'sub') {
        setExpandedSubcategories(prev => {
          const newSet = new Set(prev);
          newSet.delete(last.key);
          return newSet;
        });
      }
      setNavigationStack(prev => prev.slice(0, -1));
    } else {
      setViewMode('categories');
    }
  }, [navigationStack]);

  const handleBackToCategories = useCallback(() => {
    setViewMode('categories');
    setSearchQuery('');
    setExpandedCategories(new Set(['derived']));
    setExpandedSubcategories(new Set());
    setNavigationStack([]);
  }, []);

  const [priceInfo, setPriceInfo] = useState({ price: '...', change: '...', pctChange: '...', isUp: true });
  const priceUpdateTimeoutRef = useRef(null);

  // Subscribe to real-time ticks when market is selected
  useEffect(() => {
    if (selectedMarket && subscribeTick) {
      subscribeTick(selectedMarket.symbol);
    }
  }, [selectedMarket, subscribeTick]);

  const prevMarketSymbolRef = useRef(null);

  useEffect(() => {
    // Clear any pending updates when market changes
    if (priceUpdateTimeoutRef.current) {
      clearTimeout(priceUpdateTimeoutRef.current);
      priceUpdateTimeoutRef.current = null;
    }

    // Check if market actually changed
    const currentSymbol = selectedMarket?.symbol;
    const marketChanged = prevMarketSymbolRef.current !== currentSymbol;
    
    if (marketChanged) {
      // Reset price info immediately when market changes to prevent layout shift
      setPriceInfo({ price: '...', change: '...', pctChange: '...', isUp: true });
      prevMarketSymbolRef.current = currentSymbol;
    }

    // Use symbol for tickData (matches ChartArea), fallback to id
    const tick = selectedMarket ? (tickData[selectedMarket.symbol] || tickData[selectedMarket.id]) : null;
    const history = selectedMarket ? (marketHistory[selectedMarket.symbol] || marketHistory[selectedMarket.id]) : null;

    // Debounce price updates to prevent rapid re-renders
    // Use longer delay if market just changed to allow layout to settle
    const delay = marketChanged ? 150 : 50;
    priceUpdateTimeoutRef.current = setTimeout(() => {
      if (selectedMarket && tick) {
        const pip = Number(selectedMarket.pip);
        let decimals = 4; // default
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
          setPriceInfo({ price, change, pctChange, isUp: tick.quote >= openPrice });
        } else {
          setPriceInfo({ price, change: '...', pctChange: '...', isUp: true });
        }
      } else if (selectedMarket && !tick) {
        // Market selected but no tick data yet - show loading
        setPriceInfo({ price: '...', change: '...', pctChange: '...', isUp: true });
      }
    }, delay);

    return () => {
      if (priceUpdateTimeoutRef.current) {
        clearTimeout(priceUpdateTimeoutRef.current);
      }
    };
  }, [selectedMarket, tickData, marketHistory]);

  const hasSymbols = rawFilteredSymbols.length > 0;

  const handleSelect = useCallback((s) => {
    setSelectedMarket(s);
    setOpen(false);
  }, [setSelectedMarket]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setExpandedCategories(new Set(['derived'])); // Reset to default on clear
    setExpandedSubcategories(new Set());
    setNavigationStack([]);
  }, []);

  const renderSymbolsForSub = useCallback((fullSubKey, catKey) => {
    const symbols = symbolsBySubcategory[fullSubKey] || [];
    if (symbols.length === 0) return null;
    if (catKey === 'derived') {
      const groups = {};
      symbols.forEach(symbol => {
        const submarket = symbol.submarket_display_name || 'Uncategorized';
        if (!groups[submarket]) groups[submarket] = [];
        groups[submarket].push(symbol);
      });
      const sortedGroups = Object.entries(groups)
        .map(([name, syms]) => ({
          name,
          symbols: syms.sort((a, b) => a.display_order - b.display_order),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return sortedGroups.map(({ name, symbols: groupSymbols }) => (
        <div key={name} className="mb-4">
          <div className="px-6 py-3 bg-gray-50 font-semibold text-sm uppercase text-gray-600 flex items-center gap-2 border-l-2 border-blue-200 ml-2 rounded-r-lg">
            <div className="w-1 h-4 bg-blue-500 rounded" />
            {name} ({groupSymbols.length})
          </div>
          <div className="space-y-1">
            {groupSymbols.map((symbol) => (
              <MarketRow
                key={symbol.id}
                symbol={symbol}
                history={marketHistory[symbol.id]}
                onSelect={handleSelect}
                className="ml-4"
              />
            ))}
          </div>
        </div>
      ));
    } else {
      const sortedSymbols = symbols.sort((a, b) => a.display_order - b.display_order);
      return (
        <div className="space-y-1">
          {sortedSymbols.map((symbol) => (
            <MarketRow
              key={symbol.id}
              symbol={symbol}
              history={marketHistory[symbol.id]}
              onSelect={handleSelect}
              className="ml-4"
            />
          ))}
        </div>
      );
    }
  }, [symbolsBySubcategory, marketHistory, handleSelect]);

  const renderTree = () => (
    <div className="space-y-2">
      {categories.map(({ key: catKey, label: catLabel, icon: Icon }) => {
        const isCatExpanded = expandedCategories.has(catKey);
        const subs = subcategoriesByCategory[catKey] || [];
        return (
          <div key={catKey} className="mb-3">
            <CategoryButtonMobile
              catKey={catKey}
              catLabel={catLabel}
              icon={Icon}
              activeCategory={activeCategory}
              onClick={() => toggleExpanded(catKey)}
              hasSubs={subs.length > 0}
            />
            {isCatExpanded && subs.length > 0 && (
              <div className="ml-6 space-y-2 mt-2">
                {subs.map(({ key: subKey, label: subLabel }) => {
                  const fullSubKey = `${catKey}_${subKey}`;
                  const isSubExpanded = expandedSubcategories.has(fullSubKey);
                  const subSymbols = symbolsBySubcategory[fullSubKey] || [];
                  return (
                    <div key={subKey} className="space-y-2">
                      <Button
                        variant={isSubExpanded ? "secondary" : "ghost"}
                          className={cn(
                          "w-full justify-start pl-6 pr-4 py-3 text-sm font-medium rounded-lg bg-white shadow-sm border hover:shadow-md transition-shadow duration-200 min-h-[48px]",
                          isSubExpanded && "border-l-4 border-blue-500 bg-blue-50"
                        )}
                        onClick={() => toggleExpandedSub(fullSubKey)}
                      >
                        <span className="flex-1 text-left">{subLabel}</span>
                        {subSymbols.length > 0 && (
                          <ChevronRight className={cn("h-4 w-4 ml-auto transition-transform duration-200", isSubExpanded ? 'rotate-90' : '')} />
                        )}
                      </Button>
                      {isSubExpanded && renderSymbolsForSub(fullSubKey, catKey)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderSymbolsList = () => {
    if (groupedSymbols.symbols.length > 0) {
      return groupedSymbols.symbols.map((symbol) => (
        <MarketRow
          key={symbol.id}
          symbol={symbol}
          history={marketHistory[symbol.id]}
          onSelect={handleSelect}
        />
      ));
    } else {
      return groupedSymbols.groups.map(({ name, symbols }) => (
        <div key={name} className="mb-4">
          <div className="px-4 py-3 bg-gray-50 font-semibold text-sm uppercase text-gray-600 flex items-center gap-2 border-l-2 border-blue-200 rounded-r-lg">
            <div className="w-1 h-4 bg-blue-500 rounded" />
            {name} ({symbols.length})
          </div>
          <div className="space-y-1">
            {symbols.map((symbol) => (
              <MarketRow
                key={symbol.id}
                symbol={symbol}
                history={marketHistory[symbol.id]}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      ));
    }
  };

  const buttonRef = useRef(null);

  // Memoize button content to prevent re-renders when popover opens/closes
  // Separate market name/content from price info to reduce re-renders
  const marketContent = useMemo(() => {
    if (!selectedMarket) return null;
    const numberMatch = selectedMarket.name.match(/\b(\d+)\b/);
    const hasBadge = numberMatch && selectedMarket.market === 'synthetic_index';
    
    return {
      name: selectedMarket.name,
      market: selectedMarket.market,
      flags: selectedMarket.flags,
      badge: hasBadge ? numberMatch[1] : null
    };
  }, [selectedMarket?.symbol, selectedMarket?.name, selectedMarket?.market]);

  const buttonContent = useMemo(() => {
    if (selectedMarket && marketContent) {
      return (
        <>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 relative w-6 h-6">
              <MarketIcon market={marketContent.market} flags={marketContent.flags} className="h-6 w-6 text-gray-400" />
              {marketContent.badge && (
                <div className="absolute -top-1 -right-1 bg-gray-700 text-white text-[10px] font-semibold rounded-full h-4 w-4 flex items-center justify-center leading-none">
                  {marketContent.badge}
                </div>
              )}
            </div>
            <div className="flex flex-col items-start flex-1 min-w-0">
              <p className="font-bold text-sm truncate w-full text-gray-900">{marketContent.name}</p>
              <div className="flex items-center text-xs text-gray-600 min-h-[16px]">
                <span className="tabular-nums">{priceInfo.price}</span>
                <span className="mx-1">-</span>
                <span className="tabular-nums">{priceInfo.change}</span>
                <span className="ml-1">({priceInfo.pctChange}%)</span>
                {priceInfo.isUp ? (
                  <span className="ml-1.5 text-green-500 text-[10px]">▲</span>
                ) : (
                  <span className="ml-1.5 text-red-500 text-[10px]">▼</span>
                )}
              </div>
            </div>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-gray-900" />
        </>
      );
    }
    return (
      <>
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-600">Select market...</span>
        </div>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-gray-900" />
      </>
    );
  }, [selectedMarket, marketContent, priceInfo]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          ref={buttonRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full md:w-auto justify-between p-3 min-h-[48px] bg-[#fafafa] border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors duration-150"
          style={{ 
            willChange: 'auto',
            contain: 'layout style paint',
            transform: 'translateZ(0)' // Force GPU acceleration
          }}
        >
          {buttonContent}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[80vw] max-w-4xl h-[85vh] sm:h-[75vh] flex flex-col p-0 overflow-hidden" 
        align="start"
        style={{
          transform: 'translateZ(0)',
          willChange: 'transform, opacity'
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex-row items-center justify-between border-b pb-3 px-4 pt-4">
            <div className="flex items-center gap-2">
              {isMobile && viewMode === 'content' && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBackToCategories}>
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </Button>
              )}
              <h2 className="text-base sm:text-lg">
                {isMobile ? (viewMode === 'categories' ? 'Market Categories' : 'Select Market') : 'Select Market'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {!isMobile && (
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search markets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-40 sm:w-48 h-8 sm:h-9 text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          {isMobile && viewMode === 'content' && (
            <div className="px-4 py-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-full h-9 text-sm"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-5 p-0"
                    onClick={handleClearSearch}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {navigationStack.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-blue-600 text-sm"
                  onClick={handleBack}
                >
                  <ChevronLeft className="h-4 w-4 mr-1 inline" />
                  Back
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-1 overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden md:block w-48 bg-gray-50 border-r p-2 space-y-1 overflow-y-auto">
              {categories.map(({ key: catKey, label: catLabel, icon: Icon }) => {
                const isExpanded = expandedCategories.has(catKey);
                const subs = subcategoriesByCategory[catKey] || [];
                const hasSubs = subs.length > 0;
                const isSelected = activeCategory === catKey || activeCategory.startsWith(`${catKey}_`);
                const subsCount = subs.reduce((total, sub) => {
                  const fullSubKey = `${catKey}_${sub.key}`;
                  return total + (symbolsBySubcategory[fullSubKey] || []).length;
                }, 0);

                return (
                  <div key={catKey}>
                    <button
                      onClick={() => {
                        if (hasSubs) {
                          toggleExpanded(catKey);
                        } else {
                          setActiveCategory(catKey);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center p-2 rounded-md text-left transition-colors duration-150 relative",
                        isSelected
                          ? "bg-white border border-gray-200 shadow-sm"
                          : "hover:bg-gray-100 text-gray-600"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500" />
                      )}
                      <Icon className={cn(
                        "h-4 w-4 mr-2 flex-shrink-0",
                        isSelected ? "text-blue-600" : "text-gray-500"
                      )} />
                      <span className={cn(
                        "text-sm font-medium flex-1",
                        isSelected && "font-semibold"
                      )}>{catLabel}</span>
                      {subsCount > 0 && (
                        <span className={cn(
                          "text-xs rounded-full px-2 py-0.5",
                          isSelected ? "bg-blue-100 text-blue-600" : "bg-gray-200 text-gray-600"
                        )}>
                          {subsCount}
                        </span>
                      )}
                      {hasSubs && (
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 transition-transform duration-200 ml-1",
                            isExpanded ? 'rotate-90' : ''
                          )}
                        />
                      )}
                    </button>
                    {hasSubs && isExpanded && (
                      <div className="ml-4 space-y-1 mt-1 border-l border-gray-200 pl-2">
                        {subs.map(({ key: subKey, label: subLabel }) => {
                          const fullSubKey = `${catKey}_${subKey}`;
                          const isSubSelected = activeCategory === fullSubKey;
                          const subSymbols = symbolsBySubcategory[fullSubKey] || [];
                          return (
                            <button
                              key={subKey}
                              onClick={() => setActiveCategory(fullSubKey)}
                              className={cn(
                                "w-full flex items-center pl-8 pr-2 py-2 text-sm font-medium rounded-md text-left transition-colors duration-150 relative",
                                isSubSelected
                                  ? "bg-white border border-gray-200 shadow-sm"
                                  : "hover:bg-gray-100 text-gray-600"
                              )}
                            >
                              {isSubSelected && (
                                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500" />
                              )}
                              <span className="flex-1">{subLabel}</span>
                              {subSymbols.length > 0 && (
                                <span className={cn(
                                  "text-xs rounded-full px-2 py-0.5",
                                  isSubSelected ? "bg-blue-100 text-blue-600" : "bg-gray-200 text-gray-600"
                                )}>
                                  {subSymbols.length}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex-1 flex flex-col min-h-0">


              {isMobile && viewMode === 'categories' && (
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-2">
                    {categories.map(({ key: catKey, label: catLabel, icon: Icon }) => {
                      const subs = subcategoriesByCategory[catKey] || [];
                      // Count total symbols in all subcategories for this category
                      const count = subs.reduce((total, sub) => {
                        const fullSubKey = `${catKey}_${sub.key}`;
                        return total + (symbolsBySubcategory[fullSubKey] || []).length;
                      }, 0);
                      return (
                        <button
                          key={catKey}
                          onClick={() => {
                            if (subs.length > 0) {
                              const firstSubKey = subs[0].key;
                              const firstFullKey = `${catKey}_${firstSubKey}`;
                              setActiveCategory(firstFullKey);
                              setExpandedSubcategories(new Set([firstFullKey]));
                              setNavigationStack([{ type: 'sub', key: firstFullKey }]);
                            } else {
                              setActiveCategory(catKey);
                            }
                            setViewMode('content');
                          }}
                          className="w-full flex items-center p-4 rounded-lg transition-colors duration-150 text-left bg-white border hover:bg-gray-50 active:bg-gray-100"
                        >
                          <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center mr-3">
                            <Icon className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{catLabel}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {count} {count === 1 ? 'market' : 'markets'}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-400 ml-2" />
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              {(viewMode === 'content' || !isMobile) && (
                <ScrollArea className="flex-1 p-3 sm:p-4">
                  {debouncedSearchQuery ? (
                    hasSymbols ? (
                      <div className="space-y-0">
                        {renderSymbolsList()}
                      </div>
                    ) : (
                      <NoMarkets isShowingSubs={false} debouncedSearchQuery={debouncedSearchQuery} onClearSearch={handleClearSearch} />
                    )
                  ) : isMobile ? (
                    renderTree()
                  ) : (
                    hasSymbols ? (
                      <div className="space-y-0">
                        {renderSymbolsList()}
                      </div>
                    ) : (
                      <NoMarkets isShowingSubs={isShowingSubs} debouncedSearchQuery={debouncedSearchQuery} onClearSearch={handleClearSearch} />
                    )
                  )}
                </ScrollArea>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MarketSelector;