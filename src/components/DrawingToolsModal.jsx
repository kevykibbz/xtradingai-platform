import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Zap, Edit, Minus, TrendingUp, Waves, GitCommit, Spline, RectangleHorizontal, MousePointer, Trash2, ChevronRight, ChevronLeft, Menu, Search, Settings } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const DrawingToolsModal = ({ isOpen, setIsOpen, onToolSelect, activeDrawings = [], onRemoveDrawing, onClearAllDrawings, onSelectDrawing, selectedTool = null }) => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('all');
    const [isMobile, setIsMobile] = useState(false);
    const [viewMode, setViewMode] = useState('categories');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                setViewMode('categories');
            } else {
                setViewMode('content');
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (isOpen) {
            if (isMobile) {
                setViewMode('categories');
            } else {
                setViewMode('content');
            }
            setSearchTerm('');
        }
    }, [isOpen, isMobile]);

    // Debug: Log when selectedTool changes
    useEffect(() => {
        if (selectedTool) {
        }
    }, [selectedTool, activeTab]);

    const tools = [
        { id: 'channel', label: 'Channel', icon: GitCommit, category: 'trend', description: 'Draw parallel trend lines' },
        { id: 'continuous', label: 'Continuous', icon: Spline, category: 'freehand', description: 'Freehand drawing' },
        { id: 'fib-fan', label: 'Fibonacci Fan', icon: Waves, category: 'fibonacci', description: 'Fibonacci trend lines' },
        { id: 'horizontal', label: 'Horizontal Line', icon: Minus, category: 'basic', description: 'Horizontal reference line' },
        { id: 'line', label: 'Line', icon: TrendingUp, category: 'basic', description: 'Straight line between two points' },
        { id: 'ray', label: 'Ray', icon: TrendingUp, category: 'basic', description: 'Line extending infinitely in one direction' },
        { id: 'rectangle', label: 'Rectangle', icon: RectangleHorizontal, category: 'shapes', description: 'Rectangle shape' },
        { id: 'trend', label: 'Trend Line', icon: TrendingUp, category: 'trend', description: 'Trend line with handles' },
        { id: 'vertical', label: 'Vertical Line', icon: Minus, category: 'basic', description: 'Vertical reference line' },
        { id: 'arrow', label: 'Arrow', icon: TrendingUp, category: 'markers', description: 'Directional arrow' },
        { id: 'text', label: 'Text', icon: Edit, category: 'markers', description: 'Add text annotation' },
        { id: 'ellipse', label: 'Ellipse', icon: RectangleHorizontal, category: 'shapes', description: 'Ellipse or circle' },
        { id: 'polygon', label: 'Polygon', icon: Spline, category: 'shapes', description: 'Multi-sided shape' },
    ];

    const categories = [
        { id: 'active', label: 'Active', icon: Zap, color: 'bg-blue-500' },
        { id: 'all', label: 'All drawings', icon: Edit, color: 'bg-blue-500' },
    ];

    const filteredTools = tools.filter(tool =>
        tool.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchTerm.toLowerCase())
    ).filter(tool =>
        activeTab === 'all' || activeTab === 'active' || tool.category === activeTab
    );

    const handleToolClick = (tool) => {
        if (onToolSelect) {
            // If clicking the same tool that's already selected, deactivate it
            if (selectedTool && selectedTool.id === tool.id) {
                onToolSelect(null); // Deactivate
                toast({
                    description: `${tool.label} deactivated`,
                    duration: 2000,
                });
            } else {
                onToolSelect(tool); // Activate new tool
                toast({
                    description: `${tool.label} selected - Click on chart to draw (you can draw multiple)`,
                    duration: 2000,
                });
            }
        } else {
            console.error('onToolSelect is not available!');
        }
        // Keep modal open so user can see the selection
        // setIsOpen(false);
    };

    const handleCategorySelect = (categoryId) => {
        setActiveTab(categoryId);
        if (isMobile) {
            setViewMode('content');
        }
    };

    const handleBackToCategories = () => {
        setViewMode('categories');
        setSearchTerm('');
    };

    const currentCategory = categories.find(cat => cat.id === activeTab);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="w-[70vw] max-w-3xl h-[65vh] sm:h-[60vh] flex flex-col p-0 overflow-hidden [&>button]:hidden">
                {/* Header */}
                <DialogHeader className="flex-row items-center justify-between border-b pb-3 px-4 pt-4">
                    <div className="flex items-center gap-2">
                        {isMobile && viewMode === 'content' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBackToCategories}>
                                <ChevronRight className="h-4 w-4 rotate-180" />
                            </Button>
                        )}
                        <DialogTitle className="text-base sm:text-lg">
                            {isMobile ? (viewMode === 'categories' ? 'Drawing Tools' : currentCategory?.label || 'Tools') : 'Drawing tools'}
                        </DialogTitle>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-70 hover:opacity-100"
                        onClick={() => setIsOpen(false)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden min-h-0">
                    {/* Desktop Sidebar */}
                    {!isMobile && (
                        <div className="w-48 bg-white border-r flex-shrink-0 overflow-hidden flex flex-col">
                            <div className="flex-1 overflow-y-auto p-2">
                                <div className="space-y-1">
                                    {categories.map((cat) => {
                                        const isSelected = activeTab === cat.id;
                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => setActiveTab(cat.id)}
                                                className={`w-full flex items-center p-2 rounded-md text-left transition-all relative ${
                                                    isSelected
                                                        ? 'bg-gray-50'
                                                        : 'hover:bg-gray-50 text-gray-600'
                                                }`}
                                            >
                                                {isSelected && (
                                                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500" />
                                                )}
                                                <cat.icon className={`h-4 w-4 mr-2 flex-shrink-0 ${
                                                    isSelected ? 'text-gray-900' : 'text-gray-500'
                                                }`} />
                                                <span className={`text-sm flex-1 ${
                                                    isSelected ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'
                                                }`}>
                                                    {cat.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mobile Categories View */}
                    {isMobile && viewMode === 'categories' && (
                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-2">
                                {categories.map((cat) => {
                                    const isSelected = activeTab === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => handleCategorySelect(cat.id)}
                                            className={`w-full flex items-center p-4 rounded-lg transition-all text-left bg-white border hover:bg-gray-50 active:bg-gray-100 ${
                                                isSelected ? 'border-gray-300 bg-gray-50' : ''
                                            }`}
                                        >
                                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center mr-3">
                                                <cat.icon className="h-5 w-5 text-blue-600" />
                                            </div>
                                            <div className="flex-1">
                                                <div className={`font-medium text-sm ${isSelected ? 'font-semibold' : ''}`}>{cat.label}</div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-gray-400 ml-2" />
                                        </button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    )}

                    {/* Content View */}
                    {(viewMode === 'content' || !isMobile) && (
                        <ScrollArea className="flex-1 p-3 sm:p-4">

                            {activeTab === 'active' ? (
                                activeDrawings.length === 0 && !selectedTool ? (
                                    <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500 text-center px-4">
                                        <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                            <Edit className="h-8 w-8 text-gray-400" />
                                        </div>
                                        <p className="font-medium text-sm mb-2">No Active Drawings</p>
                                        <p className="text-xs text-gray-500 mb-4 max-w-xs">Select a drawing tool to start drawing on your chart</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Show selected tool if no drawings but tool is selected */}
                                        {selectedTool && (
                                            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-500 rounded-lg mb-2">
                                                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <selectedTool.icon className="h-5 w-5 text-blue-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <span className="text-sm font-semibold text-blue-900">{selectedTool.label}</span>
                                                    <p className="text-xs text-blue-700 mt-0.5">
                                                        {activeDrawings.length === 0 
                                                            ? 'Ready to draw - Click on chart' 
                                                            : `Active - Click on chart to draw more (${activeDrawings.length} drawings)`}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                                        onClick={() => {
                                                            if (onToolSelect) {
                                                                onToolSelect(null); // Deactivate tool
                                                            }
                                                        }}
                                                        title="Deactivate tool"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {/* Show existing drawings */}
                                        {activeDrawings.map((drawing) => {
                                            const tool = tools.find(t => t.id === drawing.type);
                                            const Icon = tool?.icon || Edit;
                                            const drawingColor = drawing.color || drawing.metadata?.color || '#000000';
                                            const fillColor = drawing.fillColor || drawing.metadata?.fillColor;
                                            return (
                                                <div
                                                    key={drawing.id}
                                                    className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors group"
                                                >
                                                    <div className="h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 relative">
                                                        <Icon className="h-5 w-5 text-gray-600" />
                                                        {/* Color indicator */}
                                                        <div 
                                                            className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white"
                                                            style={{ backgroundColor: drawingColor }}
                                                            title={`Color: ${drawingColor}`}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-sm font-medium text-gray-700 block truncate">{drawing.label || tool?.label}</span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-xs text-gray-500">{drawing.type}</span>
                                                            {fillColor && (
                                                                <div className="flex items-center gap-1">
                                                                    <div 
                                                                        className="h-2 w-2 rounded-full border border-gray-300"
                                                                        style={{ backgroundColor: fillColor }}
                                                                        title={`Fill: ${fillColor}`}
                                                                    />
                                                                    <span className="text-xs text-gray-400">Fill</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {onSelectDrawing && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                                                onClick={() => onSelectDrawing(drawing.id)}
                                                                title="Double-click to edit colors"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {onRemoveDrawing && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                                                onClick={() => onRemoveDrawing(drawing.id)}
                                                                title="Remove drawing"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Clear All button */}
                                        {activeDrawings.length > 0 && onClearAllDrawings && (
                                            <div className="pt-2 border-t mt-2">
                                                <Button
                                                    variant="outline"
                                                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                                    onClick={() => {
                                                        if (window.confirm(`Are you sure you want to remove all ${activeDrawings.length} drawing(s)?`)) {
                                                            onClearAllDrawings();
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Clear All Drawings ({activeDrawings.length})
                                                </Button>
                                            </div>
                                        )}
                                        {/* Show selected tool along with drawings if both exist */}
                                        {selectedTool && activeDrawings.length > 0 && (
                                            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-500 rounded-lg mt-2">
                                                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <selectedTool.icon className="h-5 w-5 text-blue-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <span className="text-sm font-semibold text-blue-900">{selectedTool.label}</span>
                                                    <p className="text-xs text-blue-700 mt-0.5">Ready to draw - Click on chart</p>
                                                </div>
                                                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                            </div>
                                        )}
                                    </div>
                                )
                            ) : (
                                filteredTools.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500 text-center px-4">
                                        <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                            <Search className="h-8 w-8 text-gray-400" />
                                        </div>
                                        <p className="font-medium text-sm mb-2">No Tools Found</p>
                                        <p className="text-xs text-gray-500 mb-4 max-w-xs">
                                            {searchTerm ? `No tools found for "${searchTerm}"` : `No tools available`}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {filteredTools.map(tool => {
                                            const Icon = tool.icon;
                                            const isActive = selectedTool && selectedTool.id === tool.id;
                                            if (isActive) {
                                            }
                                            return (
                                                <button
                                                    key={tool.id}
                                                    onClick={() => handleToolClick(tool)}
                                                    className={`w-full flex items-center gap-3 p-3 bg-white border rounded-lg hover:border-gray-300 transition-all text-left group ${
                                                        isActive 
                                                            ? 'border-blue-500 bg-blue-50 hover:bg-blue-100' 
                                                            : 'border-gray-200 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                        isActive ? 'bg-blue-100' : 'bg-gray-50'
                                                    }`}>
                                                        <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-600'}`} />
                                                    </div>
                                                    <span className={`text-sm font-medium flex-1 ${
                                                        isActive ? 'text-blue-900 font-semibold' : 'text-gray-700'
                                                    }`}>{tool.label}</span>
                                                    {isActive ? (
                                                        <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )
                            )}
                        </ScrollArea>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default DrawingToolsModal;