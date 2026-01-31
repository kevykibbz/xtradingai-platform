
import React, { useState } from 'react';
import { Search, TrendingUp, Globe, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDerivAPI } from '@/contexts/DerivContext';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

const Sidebar = ({ selectedMarket, setSelectedMarket }) => {
  const { activeSymbols, connected } = useDerivAPI();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All', icon: Globe },
    { id: 'forex', label: 'Forex', icon: TrendingUp },
    { id: 'synthetic_index', label: 'Synthetics', icon: Zap }
  ];

  const filteredSymbols = activeSymbols.filter(symbol => {
    const matchesSearch = symbol.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         symbol.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || symbol.market === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          Markets
        </span>
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex gap-1 p-2 border-b border-slate-800">
        {categories.map(cat => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Icon className="h-3 w-3" />
              {cat.label}
            </button>
          );
        })}
      </div>

      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-2 space-y-1">
          {!connected && (
            <div className="text-center py-8 text-slate-400 text-sm">
              Connecting to markets...
            </div>
          )}
          {connected && filteredSymbols.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              No markets found
            </div>
          )}
          {filteredSymbols.map((symbol) => (
            <motion.button
              key={symbol.symbol}
              onClick={() => setSelectedMarket(symbol)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full p-3 rounded-lg text-left transition-all ${
                selectedMarket?.symbol === symbol.symbol
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {symbol.display_name}
                  </div>
                  <div className="text-xs opacity-70 mt-0.5">
                    {symbol.symbol}
                  </div>
                </div>
                {symbol.market === 'forex' && (
                  <TrendingUp className="h-4 w-4 ml-2 flex-shrink-0 opacity-50" />
                )}
                {symbol.market === 'synthetic_index' && (
                  <Zap className="h-4 w-4 ml-2 flex-shrink-0 opacity-50" />
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default Sidebar;
