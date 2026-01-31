import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { setTradeType as setTradeTypeRedux } from '@/store/slices/tradeTypeSlice';

// --- CONFIGURATION CONSTANTS (NO CHANGE) ---

const tradeTypes = [
    { id: 'rise_fall', label: 'Rise/Fall', icon: 'ArrowUpDown', category: 'Up/Down', color: 'blue', actionButtons: ['rise', 'fall'] },
    { id: 'higher_lower', label: 'Higher/Lower', icon: 'ChevronsUpDown', category: 'Up/Down', color: 'blue', actionButtons: ['higher', 'lower'] },
    { id: 'touch_no_touch', label: 'Touch/No Touch', icon: 'GitCommit', category: 'In/Out', color: 'purple', actionButtons: ['touch', 'no_touch'] },
    { id: 'ends_in_out', label: 'Ends In/Out', icon: 'Repeat', category: 'In/Out', color: 'purple', actionButtons: ['ends_in', 'ends_out'] },
    { id: 'stays_in_goes_out', label: 'Stays In/Out', icon: 'Waves', category: 'In/Out', color: 'purple', actionButtons: ['stays_in', 'goes_out'] },
    { id: 'matches_differs', label: 'Matches/Differs', icon: 'Zap', category: 'Digits', color: 'green', actionButtons: ['matches', 'differs'] },
    { id: 'even_odd', label: 'Even/Odd', icon: 'ArrowUpDown', category: 'Digits', color: 'green', actionButtons: ['even', 'odd'] },
    { id: 'over_under', label: 'Over/Under', icon: 'ChevronsUpDown', category: 'Digits', color: 'green', actionButtons: ['over', 'under'] },
    { id: 'accumulators', label: 'Accumulators', icon: 'Layers', category: 'Advanced', color: 'orange', actionButtons: ['buy'] },
    { id: 'multipliers', label: 'Multipliers', icon: 'TrendingUp', category: 'Advanced', color: 'orange', actionButtons: ['up', 'down'] },
    { id: 'call_put', label: 'Call/Put', icon: 'ArrowUpDown', category: 'Options', color: 'red', actionButtons: ['call', 'put'] },
    { id: 'turbos', label: 'Turbos', icon: 'Zap', category: 'Advanced', color: 'orange', actionButtons: ['up', 'down'] },
];

const colorClasses = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-600', button: 'bg-blue-500 hover:bg-blue-600' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-600', button: 'bg-purple-500 hover:bg-purple-600' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: 'text-green-600', button: 'bg-green-500 hover:bg-green-600' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-600', button: 'bg-orange-500 hover:bg-orange-600' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-600', button: 'bg-red-500 hover:bg-red-600' },
};

// --- NEW/UPDATED CONSTANTS ---

const ITEM_GAP = 8;
const ITEM_WIDTH = 140; // 🎯 FIX: Increased width to prevent truncation of longer labels like "Higher/Lower"
const AUTO_SCROLL_SPEED = 0.15;
const AUTO_SCROLL_RESTART_DELAY = 5000;

// ---------------------------------------------

const MobileTradeTypeCarousel = ({
                                     selectedType,
                                     onSelectType,
                                     className
                                 }) => {
    // 🗑️ REMOVED: isDragging, touchStartX/Y, isSwiping, lastScrollLeft state/logic
    const dispatch = useAppDispatch();

    const [isAutoScrolling, setIsAutoScrolling] = useState(true);
    const scrollContainerRef = useRef(null);
    const containerRef = useRef(null);
    const animationIdRef = useRef(null);
    const scrollPositionRef = useRef(0);
    const directionRef = useRef(1); // Keep direction for auto-scroll
    const touchTimeoutRef = useRef(null);
    const isScrollingProgrammaticallyRef = useRef(false);
    const touchStartXRef = useRef(0);
    const touchStartYRef = useRef(0);
    const isSwipingRef = useRef(false);


    const duplicatedItems = [...tradeTypes, ...tradeTypes, ...tradeTypes];
    const startAutoScroll = useCallback(() => {
        if (!isAutoScrolling || !scrollContainerRef.current) return;

        const scroll = () => {
            if (!scrollContainerRef.current || !isAutoScrolling) {
                animationIdRef.current = null;
                return;
            }

            const container = scrollContainerRef.current;
            const scrollWidth = container.scrollWidth;
            const containerWidth = container.clientWidth;

            isScrollingProgrammaticallyRef.current = true;
            scrollPositionRef.current += AUTO_SCROLL_SPEED * directionRef.current;

            const thirdSectionWidth = scrollWidth / 3;
            const middleSectionStart = thirdSectionWidth;
            const middleSectionEnd = thirdSectionWidth * 2;

            if (scrollPositionRef.current >= middleSectionEnd - containerWidth) {
                scrollPositionRef.current = middleSectionStart + (scrollPositionRef.current - (middleSectionEnd - containerWidth));
                container.scrollLeft = scrollPositionRef.current;
            } else if (scrollPositionRef.current <= 0) {
                scrollPositionRef.current = middleSectionEnd - containerWidth + scrollPositionRef.current;
                container.scrollLeft = scrollPositionRef.current;
            } else {
                container.scrollLeft = scrollPositionRef.current;
            }

            isScrollingProgrammaticallyRef.current = false;
            animationIdRef.current = requestAnimationFrame(scroll);
        };

        if (!animationIdRef.current) {
            if (scrollContainerRef.current) {
                const scrollWidth = scrollContainerRef.current.scrollWidth;

                scrollPositionRef.current = scrollWidth / 3;

                isScrollingProgrammaticallyRef.current = true;
                scrollContainerRef.current.scrollLeft = scrollPositionRef.current;
                isScrollingProgrammaticallyRef.current = false;
            }
            animationIdRef.current = requestAnimationFrame(scroll);
        }
    }, [isAutoScrolling]);

    const stopAutoScroll = useCallback(() => {
        if (animationIdRef.current) {
            cancelAnimationFrame(animationIdRef.current);
            animationIdRef.current = null;
        }
    }, []);

    const handleInteractionStart = useCallback(() => {
        setIsAutoScrolling(false);
        stopAutoScroll();
    }, [stopAutoScroll]);

    const handleInteractionEnd = useCallback(() => {
        if (touchTimeoutRef.current) {
            clearTimeout(touchTimeoutRef.current);
        }
        touchTimeoutRef.current = setTimeout(() => {
            setIsAutoScrolling(true);
        }, AUTO_SCROLL_RESTART_DELAY);
    }, []);

    const scrollToItem = useCallback((direction) => {
        if (!scrollContainerRef.current) return;
        
        handleInteractionStart();
        
        const container = scrollContainerRef.current;
        const containerWidth = container.clientWidth;
        const scrollAmount = ITEM_WIDTH + ITEM_GAP;
        const currentScroll = container.scrollLeft;
        
        let targetScroll;
        if (direction === 'prev') {
            targetScroll = currentScroll - scrollAmount;
        } else {
            targetScroll = currentScroll + scrollAmount;
        }
        
        scrollPositionRef.current = targetScroll;
        isScrollingProgrammaticallyRef.current = true;
        
        container.style.scrollBehavior = 'smooth';
        container.scrollLeft = targetScroll;
        
        setTimeout(() => {
            if (container) {
                container.style.scrollBehavior = 'auto';
                isScrollingProgrammaticallyRef.current = false;
            }
            handleInteractionEnd();
        }, 400);
    }, [handleInteractionStart, handleInteractionEnd]);

    // Touch swipe handlers
    const handleTouchStart = useCallback((e) => {
        const touch = e.touches[0];
        touchStartXRef.current = touch.clientX;
        touchStartYRef.current = touch.clientY;
        isSwipingRef.current = false;
        handleInteractionStart();
    }, [handleInteractionStart]);

    const handleTouchMove = useCallback((e) => {
        if (!touchStartXRef.current || !touchStartYRef.current) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartXRef.current;
        const deltaY = touch.clientY - touchStartYRef.current;
        
        // Determine if this is a horizontal swipe (more horizontal than vertical)
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            isSwipingRef.current = true;
            // Prevent default scrolling behavior during swipe
            e.preventDefault();
        }
    }, []);

    const handleTouchEnd = useCallback((e) => {
        if (!touchStartXRef.current || !isSwipingRef.current) {
            handleInteractionEnd();
            return;
        }

        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartXRef.current;
        const deltaY = touch.clientY - touchStartYRef.current;
        
        // Check if it's a valid swipe (more horizontal than vertical, and minimum distance)
        const minSwipeDistance = 50;
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
            // Swipe left (next) or right (prev)
            if (deltaX > 0) {
                scrollToItem('prev');
            } else {
                scrollToItem('next');
            }
        }
        
        // Reset touch state
        touchStartXRef.current = 0;
        touchStartYRef.current = 0;
        isSwipingRef.current = false;
        handleInteractionEnd();
    }, [handleInteractionEnd, scrollToItem]);

    const handleClick = useCallback((id, index) => {
        handleInteractionStart();
        // CRITICAL: Update Redux store for trade type change - triggers proposal fetching
        dispatch(setTradeTypeRedux(id));
        onSelectType(id);

        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const containerWidth = container.clientWidth;

            const middleSectionStart = (container.scrollWidth / 3);
            const targetIndex = index % tradeTypes.length;

            const targetScroll =
                middleSectionStart +
                (targetIndex * (ITEM_WIDTH + ITEM_GAP)) -
                (containerWidth / 2) +
                (ITEM_WIDTH / 2);

            scrollPositionRef.current = targetScroll;
            isScrollingProgrammaticallyRef.current = true;

            container.style.scrollBehavior = 'smooth';
            container.scrollLeft = targetScroll;

            setTimeout(() => {
                if (container) {
                    container.style.scrollBehavior = 'auto';
                    isScrollingProgrammaticallyRef.current = false;
                }
            }, 400);
        }

        handleInteractionEnd();
    }, [onSelectType, handleInteractionStart, handleInteractionEnd, dispatch]);

    const getIconComponent = useCallback((iconName) => {
        const IconComponent = Icons[iconName] || Icons.Zap;
        return IconComponent;
    }, []);

    useEffect(() => {
        if (isAutoScrolling) {
            startAutoScroll();
        }

        return () => {
            stopAutoScroll();
            if (touchTimeoutRef.current) {
                clearTimeout(touchTimeoutRef.current);
            }
        };
    }, [isAutoScrolling, startAutoScroll, stopAutoScroll]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (!isScrollingProgrammaticallyRef.current) {
                scrollPositionRef.current = container.scrollLeft;
                handleInteractionStart();
            }
        };

        const handleScrollEnd = () => {
            handleInteractionEnd();
        }

        container.addEventListener('scroll', handleScroll);
        container.addEventListener('touchend', handleScrollEnd);
        container.addEventListener('mouseup', handleScrollEnd);

        return () => {
            container.removeEventListener('scroll', handleScroll);
            container.removeEventListener('touchend', handleScrollEnd);
            container.removeEventListener('mouseup', handleScrollEnd);
        }
    }, [handleInteractionStart, handleInteractionEnd]);


    return (
        <div
            ref={containerRef}
            className={`relative w-full bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 ${className || ''}`}
            onMouseEnter={handleInteractionStart}
            onMouseLeave={handleInteractionEnd}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            style={{
                touchAction: 'pan-x',
                userSelect: 'none'
            }}
        >
            <div className="relative px-0 py-1">
                {/* Prev/Next Navigation Buttons */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        scrollToItem('prev');
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 p-0 bg-white/95 hover:bg-white shadow-lg border border-gray-200 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                    aria-label="Previous trade type"
                >
                    <ChevronLeft className="h-4 w-4 text-gray-700" />
                </button>
                
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        scrollToItem('next');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 p-0 bg-white/95 hover:bg-white shadow-lg border border-gray-200 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                    aria-label="Next trade type"
                >
                    <ChevronRight className="h-4 w-4 text-gray-700" />
                </button>

                <div
                    ref={scrollContainerRef}
                    className="flex overflow-x-scroll scrollbar-hide px-10"
                    style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        gap: `${ITEM_GAP}px`,
                        paddingLeft: `calc(50vw - ${ITEM_WIDTH / 2}px + 40px)`,
                        paddingRight: `calc(50vw - ${ITEM_WIDTH / 2}px + 40px)`,
                        cursor: 'grab',
                        userSelect: 'none',
                        WebkitOverflowScrolling: 'touch',
                        willChange: 'transform, scroll-left'
                    }}
                >
                    {duplicatedItems.map((type, index) => {
                        const Icon = getIconComponent(type.icon);
                        const isSelected = selectedType === type.id;
                        const colors = colorClasses[type.color] || colorClasses.blue;

                        const dynamicWidth = ITEM_WIDTH;

                        return (
                            <motion.button
                                key={`${type.id}-${index}`}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    const actualIndex = index % tradeTypes.length;
                                    handleClick(type.id, actualIndex);
                                }}
                                className={`flex items-center px-3 py-1 rounded-lg border transition-all duration-200 flex-shrink-0 ${
                                    isSelected
                                        ? `${colors.bg} ${colors.border} shadow-sm`
                                        : 'bg-white border-gray-200 hover:bg-gray-50'
                                }`}
                                style={{
                                    minWidth: `${dynamicWidth}px`,
                                    width: `${dynamicWidth}px`,
                                    touchAction: 'manipulation'
                                }}
                            >
                                <div className={`p-1.5 rounded-md mr-2 ${
                                    isSelected ? `${colors.bg.replace('50', '100')}` : 'bg-gray-100'
                                }`}>
                                    <Icon className={`h-3.5 w-3.5 ${isSelected ? colors.icon : 'text-gray-500'}`} />
                                </div>
                                <span className={`text-xs font-medium whitespace-nowrap ${
                                    isSelected ? colors.text : 'text-gray-700'
                                }`} style={{ 
                                    overflow: 'visible',
                                    textOverflow: 'clip'
                                }}>
                                    {type.label}
                                </span>
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-gray-50 to-transparent pointer-events-none z-10" />
            <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none z-10" />
        </div>
    );
};


export const getTradeTypeConfig = (tradeTypeId) => {
    return tradeTypes.find(t => t.id === tradeTypeId) || tradeTypes[0];
};

export const getActionButtonLabels = (tradeTypeId) => {
    const config = getTradeTypeConfig(tradeTypeId);
    const colorClass = colorClasses[config.color] || colorClasses.blue;

    const defaultLabels = {
        'rise_fall': { positive: 'Rise', negative: 'Fall', icon: 'ArrowUpDown' },
        'higher_lower': { positive: 'Higher', negative: 'Lower', icon: 'ChevronsUpDown' },
        'touch_no_touch': { positive: 'Touch', negative: 'No Touch', icon: 'Target' },
        'ends_in_out': { positive: 'Ends In', negative: 'Ends Out', icon: 'Repeat' },
        'stays_in_goes_out': { positive: 'Stays In', negative: 'Goes Out', icon: 'Waves' },
        'matches_differs': { positive: 'Matches', negative: 'Differs', icon: 'Zap' },
        'even_odd': { positive: 'Even', negative: 'Odd', icon: 'ArrowUpDown' },
        'over_under': { positive: 'Over', negative: 'Under', icon: 'ChevronsUpDown' },
        'accumulators': { positive: 'Buy', negative: null, icon: 'Layers' },
        'multipliers': { positive: 'Up', negative: 'Down', icon: 'TrendingUp' },
        'call_put': { positive: 'Call', negative: 'Put', icon: 'ArrowUpDown' },
        'turbos': { positive: 'Up', negative: 'Down', icon: 'Zap' },
    };

    return {
        ...defaultLabels[tradeTypeId] || defaultLabels.rise_fall,
        color: colorClass.button,
        textColor: config.color
    };
};

const style = document.createElement('style');
style.textContent = `
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  
  .scrollbar-hide {
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
    -webkit-overflow-scrolling: touch;
  }
  
  /* Prevent text selection during swipe */
  .scrollbar-hide * {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }
`;
document.head.appendChild(style);

export default MobileTradeTypeCarousel;