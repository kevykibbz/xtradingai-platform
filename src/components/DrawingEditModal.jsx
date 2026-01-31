import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Trash2, RotateCcw, Palette } from 'lucide-react';

const DrawingEditModal = ({ isOpen, setIsOpen, drawing, onUpdate, onDelete, onReset }) => {
    const [color, setColor] = useState('#000000');
    const [fillColor, setFillColor] = useState('rgba(0, 0, 0, 0.1)');

    useEffect(() => {
        if (drawing) {
            setColor(drawing.metadata?.color || '#000000');
            setFillColor(drawing.metadata?.fillColor || 'rgba(0, 0, 0, 0.1)');
        }
    }, [drawing]);

    const handleDone = () => {
        if (onUpdate && drawing) {
            onUpdate(drawing.id, {
                color,
                fillColor
            });
        }
        setIsOpen(false);
    };

    const handleDelete = () => {
        if (onDelete && drawing) {
            onDelete(drawing.id);
        }
        setIsOpen(false);
    };

    const handleReset = () => {
        if (onReset && drawing) {
            onReset(drawing.id);
        }
    };

    if (!drawing) return null;

    const drawingType = drawing.type || 'drawing';
    const drawingLabel = drawing.label || drawingType.charAt(0).toUpperCase() + drawingType.slice(1);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg font-semibold">{drawingLabel}</DialogTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Result Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Palette className="h-4 w-4 text-gray-600" />
                            <div className="text-sm font-medium text-gray-700">Color Settings</div>
                        </div>
                        
                        {/* Color Input */}
                        <div className="space-y-2">
                            <Label htmlFor="color" className="text-sm text-gray-600 flex items-center gap-2">
                                Line Color
                                <div 
                                    className="h-4 w-4 rounded border border-gray-300"
                                    style={{ backgroundColor: color }}
                                />
                            </Label>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        id="color"
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="h-10 w-full cursor-pointer"
                                    />
                                </div>
                                <Input
                                    type="text"
                                    value={color}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (/^#[0-9A-F]{6}$/i.test(val)) {
                                            setColor(val);
                                        }
                                    }}
                                    className="h-10 w-24 font-mono text-xs"
                                    placeholder="#000000"
                                />
                            </div>
                        </div>

                        {/* Fill Color Input - only for channel and rectangle */}
                        {(drawing.type === 'channel' || drawing.type === 'rectangle') && (
                            <div className="space-y-2">
                                <Label htmlFor="fillColor" className="text-sm text-gray-600 flex items-center gap-2">
                                    Fill Color
                                    <div 
                                        className="h-4 w-4 rounded border border-gray-300"
                                        style={{ backgroundColor: fillColor }}
                                    />
                                </Label>
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            id="fillColor"
                                            type="color"
                                            value={fillColor.startsWith('#') ? fillColor : (fillColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/) ? `#${parseInt(fillColor.match(/rgba?\((\d+)/)?.[1] || '0').toString(16).padStart(2, '0')}${parseInt(fillColor.match(/rgba?\(\d+,\s*(\d+)/)?.[1] || '0').toString(16).padStart(2, '0')}${parseInt(fillColor.match(/rgba?\(\d+,\s*\d+,\s*(\d+)/)?.[1] || '0').toString(16).padStart(2, '0')}` : '#000000')}
                                            onChange={(e) => {
                                                // Convert hex to rgba for fill
                                                const hex = e.target.value;
                                                const r = parseInt(hex.slice(1, 3), 16);
                                                const g = parseInt(hex.slice(3, 5), 16);
                                                const b = parseInt(hex.slice(5, 7), 16);
                                                // Extract alpha from current fillColor or default to 0.1
                                                const alphaMatch = fillColor.match(/[\d.]+\)$/);
                                                const alpha = alphaMatch ? parseFloat(alphaMatch[0].replace(')', '')) : 0.1;
                                                setFillColor(`rgba(${r}, ${g}, ${b}, ${alpha})`);
                                            }}
                                            className="h-10 w-full cursor-pointer"
                                        />
                                    </div>
                                    <Input
                                        type="text"
                                        value={fillColor}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val.startsWith('rgba') || val.startsWith('rgb')) {
                                                setFillColor(val);
                                            }
                                        }}
                                        className="h-10 w-32 font-mono text-xs"
                                        placeholder="rgba(0,0,0,0.1)"
                                    />
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-500">Opacity:</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={fillColor.match(/[\d.]+\)$/) ? parseFloat(fillColor.match(/[\d.]+\)$/)[0].replace(')', '')) : 0.1}
                                        onChange={(e) => {
                                            const alpha = parseFloat(e.target.value);
                                            const colorMatch = fillColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                                            if (colorMatch) {
                                                setFillColor(`rgba(${colorMatch[1]}, ${colorMatch[2]}, ${colorMatch[3]}, ${alpha})`);
                                            }
                                        }}
                                        className="flex-1"
                                    />
                                    <span className="text-xs text-gray-500 w-8 text-right">
                                        {Math.round((fillColor.match(/[\d.]+\)$/) ? parseFloat(fillColor.match(/[\d.]+\)$/)[0].replace(')', '')) : 0.1) * 100)}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={handleDelete}
                        title="Delete"
                    >
                        <Trash2 className="h-5 w-5" />
                    </Button>
                    
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleReset}
                            className="px-4"
                        >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Reset
                        </Button>
                        <Button
                            onClick={handleDone}
                            className="px-6 bg-red-600 hover:bg-red-700 text-white"
                        >
                            Done
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default DrawingEditModal;

