import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ChevronDown, Search, ArrowUpDown, ChevronsUpDown, Zap, GitCommit, Waves, Repeat, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const tradeTypes = [
  { id: 'rise_fall', label: 'Rise/Fall', icon: ArrowUpDown, category: 'Up/Down' },
  { id: 'higher_lower', label: 'Higher/Lower', icon: ChevronsUpDown, category: 'Up/Down' },
  { id: 'touch_no_touch', label: 'Touch/No Touch', icon: GitCommit, category: 'In/Out' },
  { id: 'ends_in_out', label: 'Ends In/Out', icon: Repeat, category: 'In/Out' },
  { id: 'stays_in_goes_out', label: 'Stays In/Goes Out', icon: Waves, category: 'In/Out' },
  { id: 'matches_differs', label: 'Matches/Differs', icon: Zap, category: 'Digits' },
  { id: 'even_odd', label: 'Even/Odd', icon: ArrowUpDown, category: 'Digits' },
  { id: 'over_under', label: 'Over/Under', icon: ChevronsUpDown, category: 'Digits' },
  { id: 'accumulators', label: 'Accumulators', icon: Zap, category: 'Advanced' },
  { id: 'multipliers', label: 'Multipliers', icon: ChevronsUpDown, category: 'Advanced' },
  // Add more to match image: Vanillas (Call/Put), Turbos, Multipliers
    { id: 'call_put', label: 'Call/Put', icon: ArrowUpDown, category: 'Options' },
  { id: 'turbos', label: 'Turbos', icon: Zap, category: 'Advanced' },
];

const categoryIcons = {
  'All': <Zap className="h-4 w-4" />,
  'Up/Down': <ArrowUpDown className="h-4 w-4" />,
  'In/Out': <Waves className="h-4 w-4" />,
  'Digits': <Zap className="h-4 w-4" />,
  'Advanced': <ChevronsUpDown className="h-4 w-4" />,
  'Options': <ChevronsUpDown className="h-4 w-4" />,
};

const SelectorButton = ({ selectedType, onClick }) => {
    const selectedTradeType = useMemo(() => {
        return tradeTypes.find(t => t.id === selectedType) || tradeTypes[0];
    }, [selectedType]);
    const Icon = selectedTradeType.icon;

    return (
        <Button
          variant="outline"
          role="combobox"
          onClick={onClick}
          className="w-full justify-between p-2 h-auto bg-white shadow-sm border-gray-300"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 bg-gray-100 rounded-sm">
                <Icon className="h-5 w-5 text-red-500" />
            </div>
            <div>
                <p className="font-bold text-sm text-left">{selectedTradeType.label}</p>
                 <p className="text-xs text-gray-500 text-left">{selectedTradeType.category}</p>
            </div>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
    );
};

// Updated Mobile Carousel Component with Native Horizontal Scrolling
const MobileCarousel = ({ selectedType, onSelectType, className }) => {
  const selectedTradeType = useMemo(() => {
    return tradeTypes.find(t => t.id === selectedType) || tradeTypes[0];
  }, [selectedType]);

  // Group by categories for carousel sections, but flatten for simple horizontal scroll
  // For a true carousel, you could use a library like embla-carousel, but here we use native scroll
  const allTypes = useMemo(() => tradeTypes, []);

  return (
    <div className={`w-full ${className || ''}`}>
      <div
        className="flex overflow-x-auto space-x-2 py-2 px-1 rounded-md border [-webkit-overflow-scrolling:touch] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
        style={{ scrollbarWidth: 'thin', msOverflowStyle: 'auto' }} // For Firefox/IE thin scrollbar
      >
        {allTypes.map((type) => {
          const ItemIcon = type.icon;
          const isSelected = selectedType === type.id;
          return (
            <Button
              key={type.id}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              className={`min-w-[100px] h-auto p-2 flex flex-col items-center justify-center rounded-md shrink-0 whitespace-normal ${isSelected ? 'bg-blue-500 text-white shadow-md' : 'bg-white border-gray-300'}`}
              onClick={() => onSelectType(type.id)}
            >
              <ItemIcon className={`h-4 w-4 mb-1 ${isSelected ? 'text-white' : 'text-red-500'}`} />
              <span className={`text-xs font-medium text-center leading-tight ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                {type.label}
              </span>
              {isSelected && (
                <span className="text-xs text-white/80 text-center">{type.category}</span>
              )}
            </Button>
          );
        })}
      </div>
      {/* Optional: Add subtle fade indicators for scrollability */}
      <div className="relative mt-1">
        <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-white to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-white to-transparent pointer-events-none" />
      </div>
    </div>
  );
};

const TradeTypeSelector = ({ selectedType, onSelectType, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const { toast } = useToast();

  const filteredTypes = useMemo(() => {
    return tradeTypes.filter(type => 
        (activeCategory === 'All' || type.category === activeCategory) &&
        type.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, activeCategory]);

  const categories = useMemo(() => {
    return ['All', ...new Set(tradeTypes.map(t => t.category))];
  }, []);

  const handleSelect = (id) => {
    onSelectType(id);
  };

  return (
    <div className="flex flex-col h-full bg-white">
        <div className="flex items-center p-2 border-b">
            <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold ml-2">Trade types</h2>
        </div>
        <div className="flex flex-1 overflow-hidden">
            <div className="w-[140px] bg-gray-50 border-r p-2">
                <div className="space-y-1 mt-2">
                {categories.map((category) => (
                    <Button
                    key={category}
                    variant={activeCategory === category ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => {
                        setActiveCategory(category);
                        setSearchQuery('');
                    }}
                    >
                    {React.cloneElement(categoryIcons[category], { className: "mr-2 h-4 w-4" })}
                    {category}
                    </Button>
                ))}
                </div>
            </div>
            <div className="flex-1 flex flex-col">
                <div className="p-2 border-b">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    />
                </div>
                </div>
                <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {filteredTypes.length > 0 ? filteredTypes.map((type) => {
                        const ItemIcon = type.icon;
                        return (
                        <Button
                            key={type.id}
                            variant={selectedType === type.id ? 'secondary' : 'ghost'}
                            className="w-full justify-start h-auto p-2"
                            onClick={() => handleSelect(type.id)}
                        >
                            <ItemIcon className="mr-3 h-5 w-5 text-red-500" />
                            <span className="font-medium text-sm">{type.label}</span>
                        </Button>
                        );
                    }) : (
                        <p className="p-4 text-sm text-center text-gray-500">No trade types found.</p>
                    )}
                </div>
                </ScrollArea>
            </div>
        </div>
    </div>
  );
};

TradeTypeSelector.Button = SelectorButton;
TradeTypeSelector.MobileCarousel = MobileCarousel;
export default TradeTypeSelector;