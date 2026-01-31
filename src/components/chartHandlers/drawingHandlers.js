// Drawing tool handlers
// This file contains all drawing tool logic extracted from TradingChart.jsx
// Simplified to match Deriv's implementation pattern (like useDrawingTools.js)

/**
 * Setup drawing tool handlers for the chart
 * @param {Object} chart - The lightweight-charts chart instance
 * @param {Object} mainSeries - The main series reference
 * @param {Object} drawingTool - The active drawing tool configuration
 * @param {Array} processedMainData - Processed chart data
 * @param {Object} chartContainerRef - Reference to chart container
 * @param {Array} drawingSeriesRef - Reference array to store drawing series
 * @param {Object} drawingsMapRef - Reference to Map storing drawing metadata
 * @param {Object} selectedDrawingRef - Reference to currently selected drawing ID
 * @param {Object} editModeRef - Reference to edit mode state
 * @returns {Function} Cleanup function to unsubscribe from events
 */
export const setupDrawingHandlers = (
    chart,
    mainSeries,
    drawingTool,
    processedMainData,
    chartContainerRef,
    drawingSeriesRef,
    drawingsMapRef = null,
    selectedDrawingRef = null,
    editModeRef = null
) => {
    
    // Allow edit mode even without drawingTool
    if (!chart || !mainSeries) {
        return () => {};
    }
    
    // Handle edit mode for dragging drawings (TradingView style)
    // Allow dragging even when drawing tool is active (for channels just drawn)
    let editDragStartPoint = null;
    let editDragOffset = null;
    let editClickHandler = null;
    let editCrosshairHandler = null;
    let isDraggingDrawing = false;
    
    // Check if we should enable edit mode (selected drawing exists)
    const shouldEnableEditMode = selectedDrawingRef && selectedDrawingRef.current && 
                                 drawingsMapRef && drawingsMapRef.current.has(selectedDrawingRef.current);
    
    if (shouldEnableEditMode) {
        
        const selectedDrawing = drawingsMapRef.current.get(selectedDrawingRef.current);
        if (!selectedDrawing) {
        } else {
            // Click handler for edit mode - allows dragging the drawing
            editClickHandler = (param) => {
                if (!param?.time || param.point === undefined) return;
                if (!selectedDrawing) return;
                
                const price = param.point.y;
                const clickPoint = { time: param.time, price };
                
                if (!editDragStartPoint) {
                    // First click - store the click point and calculate offset from drawing center
                    editDragStartPoint = clickPoint;
                    isDraggingDrawing = true;
                    
                    // Calculate drawing center (average of points)
                    const drawingPoints = selectedDrawing.points || [];
                    if (drawingPoints.length >= 2) {
                        const centerTime = (drawingPoints[0].time + drawingPoints[1].time) / 2;
                        const centerPrice = (drawingPoints[0].price + drawingPoints[1].price) / 2;
                        editDragOffset = {
                            time: clickPoint.time - centerTime,
                            price: clickPoint.price - centerPrice
                        };
                    }
                    return;
                }
                
                // Second click - complete the drag
                if (editDragOffset && isDraggingDrawing) {
                    moveDrawing(selectedDrawing, clickPoint, editDragOffset);
                    // Reset for next drag
                    editDragStartPoint = null;
                    editDragOffset = null;
                    isDraggingDrawing = false;
                }
            };
            
            // Crosshair move handler for real-time dragging (TradingView style)
            editCrosshairHandler = (param) => {
                if (!isDraggingDrawing || !editDragStartPoint || !editDragOffset || !selectedDrawing) return;
                if (!param?.time || param.point === undefined) return;
                
                const price = param.point.y;
                const currentPoint = { time: param.time, price };
                
                // Move drawing in real-time as mouse moves
                moveDrawing(selectedDrawing, currentPoint, editDragOffset, true);
            };
            
            // Helper function to move a drawing
            const moveDrawing = (drawing, newPoint, offset, isPreview = false) => {
                if (!drawing || !offset) return;
                
                const newCenterTime = newPoint.time - offset.time;
                const newCenterPrice = newPoint.price - offset.price;
                
                // Calculate new points based on original relative positions
                const originalPoints = drawing.points || [];
                if (originalPoints.length >= 2) {
                    const originalCenterTime = (originalPoints[0].time + originalPoints[1].time) / 2;
                    const originalCenterPrice = (originalPoints[0].price + originalPoints[1].price) / 2;
                    
                    const timeOffset = newCenterTime - originalCenterTime;
                    const priceOffset = newCenterPrice - originalCenterPrice;
                    
                    const newP1 = {
                        time: originalPoints[0].time + timeOffset,
                        price: originalPoints[0].price + priceOffset
                    };
                    const newP2 = {
                        time: originalPoints[1].time + timeOffset,
                        price: originalPoints[1].price + priceOffset
                    };
                    
                    // Update the drawing based on type
                    if (drawing.type === 'channel') {
                        const seriesArray = Array.isArray(drawing.series) ? drawing.series : [];
                        if (seriesArray.length >= 3) {
                            const upperLine = seriesArray[0];
                            const lowerLine = seriesArray[1];
                            const fillSeries = seriesArray[2];
                            
                            // Recalculate channel with new points
                            const priceDiff = Math.abs(newP2.price - newP1.price);
                            const isP1Higher = newP1.price > newP2.price;
                            const basePrice = isP1Higher ? newP2.price : newP1.price;
                            const topPrice = isP1Higher ? newP1.price : newP2.price;
                            
                            const upperP1_new = { time: newP1.time, value: topPrice + priceDiff };
                            const upperP2_new = { time: newP2.time, value: topPrice + priceDiff };
                            const lowerP1_new = { time: newP1.time, value: basePrice };
                            const lowerP2_new = { time: newP2.time, value: basePrice };
                            
                            // Ensure time values are valid
                            const upperTime1 = typeof upperP1_new.time === 'number' ? upperP1_new.time : Math.floor(upperP1_new.time);
                            const upperTime2 = typeof upperP2_new.time === 'number' ? upperP2_new.time : Math.floor(upperP2_new.time);
                            const lowerTime1 = typeof lowerP1_new.time === 'number' ? lowerP1_new.time : Math.floor(lowerP1_new.time);
                            const lowerTime2 = typeof lowerP2_new.time === 'number' ? lowerP2_new.time : Math.floor(lowerP2_new.time);
                            
                            // Update series
                            upperLine.setData([
                                { time: upperTime1, value: upperP1_new.value },
                                { time: upperTime2, value: upperP2_new.value }
                            ]);
                            lowerLine.setData([
                                { time: lowerTime1, value: lowerP1_new.value },
                                { time: lowerTime2, value: lowerP2_new.value }
                            ]);
                            
                            // Update fill area
                            const timeDiff = newP2.time - newP1.time;
                            const numPoints = Math.max(20, Math.abs(timeDiff) / 100);
                            const fillPoints = [];
                            
                            for (let i = 0; i <= numPoints; i++) {
                                const t = newP1.time + (i / numPoints) * timeDiff;
                                const upperPrice = upperP1_new.value + (i / numPoints) * (upperP2_new.value - upperP1_new.value);
                                fillPoints.push({ time: t, value: upperPrice });
                            }
                            for (let i = numPoints; i >= 0; i--) {
                                const t = newP1.time + (i / numPoints) * timeDiff;
                                const lowerPrice = lowerP1_new.value + (i / numPoints) * (lowerP2_new.value - lowerP1_new.value);
                                fillPoints.push({ time: t, value: lowerPrice });
                            }
                            fillSeries.setData(fillPoints);
                            
                            // Update drawing metadata (only on final move, not preview)
                            if (!isPreview) {
                                drawing.points = [newP1, newP2];
                                drawing.metadata = { ...drawing.metadata, priceDiff, basePrice, topPrice };
                            }
                        }
                    } else if (drawing.type === 'line' || drawing.type === 'trend' || drawing.type === 'ray') {
                        // Update line
                        const series = Array.isArray(drawing.series) ? drawing.series[0] : drawing.series;
                        if (series) {
                            series.setData([
                                { time: newP1.time, value: newP1.price },
                                { time: newP2.time, value: newP2.price }
                            ]);
                            if (!isPreview) {
                                drawing.points = [newP1, newP2];
                            }
                        }
                    }
                }
            };
            
            // Subscribe to clicks and crosshair move for edit mode
            if (chart && typeof chart.subscribeClick === 'function') {
                chart.subscribeClick(editClickHandler);
            }
            if (chart && typeof chart.subscribeCrosshairMove === 'function') {
                chart.subscribeCrosshairMove(editCrosshairHandler);
            }
        }
        
        // Return cleanup for edit mode
        return () => {
            if (chart) {
                if (editClickHandler && typeof chart.unsubscribeClick === 'function') {
                    chart.unsubscribeClick(editClickHandler);
                }
                if (editCrosshairHandler && typeof chart.unsubscribeCrosshairMove === 'function') {
                    chart.unsubscribeCrosshairMove(editCrosshairHandler);
                }
            }
        };
    } else if (!drawingTool) {
        return () => {};
    }

    // Disable chart scrolling/zooming when drawing tool is active (like TradingView)
    // This prevents accidental panning while drawing
    try {
        if (chart && typeof chart.applyOptions === 'function') {
            chart.applyOptions({
                handleScroll: {
                    mouseWheel: false,
                    pressedMouseMove: false, // Disable drag to pan while drawing
                    horzTouchDrag: false,
                    vertTouchDrag: false,
                },
                handleScale: {
                    mouseWheel: false, // Disable zoom while drawing
                    pinch: false,
                    axisPressedMouseMove: false,
                }
            });
        }
    } catch (e) {
    }

    let startPoint = null;
    let clickHandler = null;
    let previewSeries = null; // For drag preview
    let isDragging = false;
    let mouseDownHandler = null;
    let mouseMoveHandler = null;
    let mouseUpHandler = null;
    let crosshairHandler = null; // Declare at function scope for cleanup

    // Note: We use the chart's click handler and crosshair move for accurate coordinates
    // These provide time and price directly, so no manual conversion needed

    // Clean up preview series
    const clearPreview = () => {
        if (previewSeries) {
            try {
                if (previewSeries.topLine) {
                    // Rectangle preview (multiple series)
                    chart.removeSeries(previewSeries.topLine);
                    chart.removeSeries(previewSeries.rightLine);
                    chart.removeSeries(previewSeries.bottomLine);
                    chart.removeSeries(previewSeries.leftLine);
                } else if (previewSeries.upperPreview) {
                    // Channel preview (two lines)
                    chart.removeSeries(previewSeries.upperPreview);
                    chart.removeSeries(previewSeries.lowerPreview);
                } else {
                    // Single series preview
                    chart.removeSeries(previewSeries);
                }
            } catch (e) {
            }
            previewSeries = null;
        }
    };

    // Simple click handler matching useDrawingTools.js pattern
    clickHandler = (param) => {
        // Skip if we're handling drag
        if (isDragging) {
            isDragging = false;
            return;
        }
        
        
        // Validate we have the required data
        if (!param?.time || param.point === undefined) {
            return;
        }

        // In lightweight-charts v5, param.point.y is already the price!
        const price = param.point.y;
        const point = { time: param.time, price };

        // For single-click tools (horizontal, vertical), draw immediately
        if (drawingTool.id === 'horizontal') {
            try {
                const range = chart.timeScale().getVisibleRange();
                if (!range) return;

                const lineSeries = chart.addLineSeries({
                    color: '#60A5FA',
                    lineWidth: 2,
                    priceLineVisible: false,
                    lastValueVisible: false,
                    lineStyle: 2, // dashed
                });

                lineSeries.setData([
                    { time: range.from, value: price },
                    { time: range.to, value: price },
                ]);

                drawingSeriesRef.current.push(lineSeries);
                
                // Store drawing with ID
                const drawingId = `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                if (drawingsMapRef && drawingsMapRef.current) {
                    drawingsMapRef.current.set(drawingId, {
                        id: drawingId,
                        type: 'horizontal',
                        series: lineSeries,
                        points: [{ time: range.from, price }, { time: range.to, price }],
                        label: 'Horizontal Line',
                        metadata: { price }
                    });
                }
                
                
                // Keep tool active - don't deactivate (like Deriv)
                // Reset startPoint for next drawing
                startPoint = null;
            } catch (e) {
                console.error('Error drawing horizontal line:', e);
            }
            return;
        }

        // For two-click tools, store first point and enable drag preview
        if (!startPoint) {
            startPoint = point;
            isDragging = true; // Enable drag preview
            return;
        }

        // Second click - draw the shape
        const p1 = startPoint;
        const p2 = point;
        
        // Clear any preview before drawing
        clearPreview();
        isDragging = false;

        try {
            switch (drawingTool.id) {
                case 'line':
                case 'trend':
                case 'ray':
                case 'arrow': {
                    const lineSeries = chart.addLineSeries({
                        color: '#2962FF',
                        lineWidth: 2,
                        priceLineVisible: false,
                        lastValueVisible: false,
                    });
                    lineSeries.setData([
                        { time: p1.time, value: p1.price },
                        { time: p2.time, value: p2.price },
                    ]);
                    drawingSeriesRef.current.push(lineSeries);
                    
                    const drawingId = `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    if (drawingsMapRef && drawingsMapRef.current) {
                        drawingsMapRef.current.set(drawingId, {
                            id: drawingId,
                            type: drawingTool.id,
                            series: lineSeries,
                            points: [p1, p2],
                            label: drawingTool.label,
                            metadata: {}
                        });
                    }
                    break;
                }
                
                case 'channel': {
                    try {
                        // Draw two parallel lines with fill (TradingView style channel)
                        // Channel is defined by two points - creates parallel lines with equal spacing
                        const priceDiff = Math.abs(p2.price - p1.price);
                        
                        // Determine which point is higher
                        const isP1Higher = p1.price > p2.price;
                        const basePrice = isP1Higher ? p2.price : p1.price;
                        const topPrice = isP1Higher ? p1.price : p2.price;
                        
                        // Create upper and lower parallel lines
                        const upperP1 = { time: p1.time, value: topPrice + priceDiff };
                        const upperP2 = { time: p2.time, value: topPrice + priceDiff };
                        const lowerP1 = { time: p1.time, value: basePrice };
                        const lowerP2 = { time: p2.time, value: basePrice };
                        
                        const upperLine = chart.addLineSeries({
                            color: '#2962FF',
                            lineWidth: 2,
                            priceLineVisible: false,
                            lastValueVisible: false,
                        });
                        const lowerLine = chart.addLineSeries({
                            color: '#2962FF',
                            lineWidth: 2,
                            priceLineVisible: false,
                            lastValueVisible: false,
                        });
                        
                        // Ensure time values are valid (convert to timestamp if needed)
                        const upperTime1 = typeof upperP1.time === 'number' ? upperP1.time : Math.floor(upperP1.time);
                        const upperTime2 = typeof upperP2.time === 'number' ? upperP2.time : Math.floor(upperP2.time);
                        const lowerTime1 = typeof lowerP1.time === 'number' ? lowerP1.time : Math.floor(lowerP1.time);
                        const lowerTime2 = typeof lowerP2.time === 'number' ? lowerP2.time : Math.floor(lowerP2.time);
                        
                        upperLine.setData([
                            { time: upperTime1, value: upperP1.value },
                            { time: upperTime2, value: upperP2.value }
                        ]);
                        lowerLine.setData([
                            { time: lowerTime1, value: lowerP1.value },
                            { time: lowerTime2, value: lowerP2.value }
                        ]);
                        
                        // Create fill area between the lines
                        const timeDiff = p2.time - p1.time;
                        const numPoints = Math.max(20, Math.abs(timeDiff) / 100);
                        const fillPoints = [];
                        
                        // Upper line points
                        for (let i = 0; i <= numPoints; i++) {
                            const t = p1.time + (i / numPoints) * timeDiff;
                            const upperPrice = upperP1.value + (i / numPoints) * (upperP2.value - upperP1.value);
                            fillPoints.push({ time: t, value: upperPrice });
                        }
                        // Lower line points (reverse order)
                        for (let i = numPoints; i >= 0; i--) {
                            const t = p1.time + (i / numPoints) * timeDiff;
                            const lowerPrice = lowerP1.value + (i / numPoints) * (lowerP2.value - lowerP1.value);
                            fillPoints.push({ time: t, value: lowerPrice });
                        }
                        
                        const fillSeries = chart.addAreaSeries({
                            lineColor: 'transparent',
                            topColor: 'rgba(41, 98, 255, 0.1)',
                            bottomColor: 'transparent',
                            priceLineVisible: false,
                        });
                        fillSeries.setData(fillPoints);
                        
                        drawingSeriesRef.current.push(upperLine, lowerLine, fillSeries);
                        
                        const drawingId = `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        if (drawingsMapRef && drawingsMapRef.current) {
                            drawingsMapRef.current.set(drawingId, {
                                id: drawingId,
                                type: 'channel',
                                series: [upperLine, lowerLine, fillSeries],
                                points: [p1, p2],
                                label: 'Channel',
                                metadata: { priceDiff, basePrice, topPrice }
                            });
                            
                            // Auto-select channel after drawing (TradingView style - allows immediate drag)
                            if (selectedDrawingRef) {
                                selectedDrawingRef.current = drawingId;
                                if (editModeRef) {
                                    editModeRef.current = true;
                                }
                            }
                        }
                        
                    } catch (error) {
                        console.error('Error drawing channel:', error);
                        throw error; // Re-throw to see full error
                    }
                    break;
                }
                
                case 'rectangle': {
                    const top = Math.max(p1.price, p2.price);
                    const bot = Math.min(p1.price, p2.price);
                    
                    // Draw 4 lines to form rectangle
                    const topLine = chart.addLineSeries({ color: '#4CAF50', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
                    const rightLine = chart.addLineSeries({ color: '#4CAF50', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
                    const bottomLine = chart.addLineSeries({ color: '#4CAF50', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
                    const leftLine = chart.addLineSeries({ color: '#4CAF50', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
                    
                    topLine.setData([{ time: p1.time, value: top }, { time: p2.time, value: top }]);
                    rightLine.setData([{ time: p2.time, value: top }, { time: p2.time, value: bot }]);
                    bottomLine.setData([{ time: p2.time, value: bot }, { time: p1.time, value: bot }]);
                    leftLine.setData([{ time: p1.time, value: bot }, { time: p1.time, value: top }]);
                    
                    drawingSeriesRef.current.push(topLine, rightLine, bottomLine, leftLine);
                    
                    const drawingId = `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    if (drawingsMapRef && drawingsMapRef.current) {
                        drawingsMapRef.current.set(drawingId, {
                            id: drawingId,
                            type: 'rectangle',
                            series: [topLine, rightLine, bottomLine, leftLine],
                            points: [
                                { time: p1.time, price: top },
                                { time: p2.time, price: top },
                                { time: p2.time, price: bot },
                                { time: p1.time, price: bot }
                            ],
                            label: 'Rectangle',
                            metadata: {}
                        });
                    }
                    break;
                }
                
                default:
                    break;
            }
            
            
            // Reset startPoint but keep tool active (like Deriv - allows multiple drawings)
            startPoint = null;
            
        } catch (e) {
            console.error('Error drawing:', e);
            console.error('Error details:', {
                error: e,
                message: e?.message,
                stack: e?.stack,
                drawingTool: drawingTool?.id,
                p1,
                p2
            });
            startPoint = null; // Reset on error too
        }
    };

    // Add drag-to-draw support (TradingView style)
    // Use crosshair move for preview
    if (chartContainerRef?.current) {
        const container = chartContainerRef.current;
        
        // Use crosshair move for drag preview (TradingView style)
        crosshairHandler = (param) => {
            if (!isDragging || !startPoint || !drawingTool) return;
            
            if (!param?.time || param.point === undefined) return;
            
            const price = param.point.y;
            const currentPoint = { time: param.time, price };
            
            // Show preview while dragging
            clearPreview();
            
            if (drawingTool.id === 'line' || drawingTool.id === 'trend' || drawingTool.id === 'ray') {
                previewSeries = chart.addLineSeries({
                    color: '#2962FF',
                    lineWidth: 2,
                    priceLineVisible: false,
                    lastValueVisible: false,
                    lineStyle: 1, // Dashed for preview
                });
                previewSeries.setData([
                    { time: startPoint.time, value: startPoint.price },
                    { time: currentPoint.time, value: currentPoint.price }
                ]);
            } else if (drawingTool.id === 'channel') {
                // Preview channel (two parallel lines)
                const priceDiff = Math.abs(currentPoint.price - startPoint.price);
                const isP1Higher = startPoint.price > currentPoint.price;
                const basePrice = isP1Higher ? currentPoint.price : startPoint.price;
                const topPrice = isP1Higher ? startPoint.price : currentPoint.price;
                
                const upperP1 = { time: startPoint.time, value: topPrice + priceDiff };
                const upperP2 = { time: currentPoint.time, value: topPrice + priceDiff };
                const lowerP1 = { time: startPoint.time, value: basePrice };
                const lowerP2 = { time: currentPoint.time, value: basePrice };
                
                const upperPreview = chart.addLineSeries({
                    color: '#2962FF',
                    lineWidth: 2,
                    priceLineVisible: false,
                    lastValueVisible: false,
                    lineStyle: 1, // Dashed
                });
                const lowerPreview = chart.addLineSeries({
                    color: '#2962FF',
                    lineWidth: 2,
                    priceLineVisible: false,
                    lastValueVisible: false,
                    lineStyle: 1, // Dashed
                });
                
                upperPreview.setData([
                    { time: upperP1.time, value: upperP1.value },
                    { time: upperP2.time, value: upperP2.value }
                ]);
                lowerPreview.setData([
                    { time: lowerP1.time, value: lowerP1.value },
                    { time: lowerP2.time, value: lowerP2.value }
                ]);
                
                previewSeries = { upperPreview, lowerPreview };
            } else if (drawingTool.id === 'rectangle') {
                const top = Math.max(startPoint.price, currentPoint.price);
                const bot = Math.min(startPoint.price, currentPoint.price);
                
                // Draw rectangle preview with 4 lines
                const topLine = chart.addLineSeries({ color: '#4CAF50', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, lineStyle: 1 });
                const rightLine = chart.addLineSeries({ color: '#4CAF50', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, lineStyle: 1 });
                const bottomLine = chart.addLineSeries({ color: '#4CAF50', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, lineStyle: 1 });
                const leftLine = chart.addLineSeries({ color: '#4CAF50', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, lineStyle: 1 });
                
                topLine.setData([{ time: startPoint.time, value: top }, { time: currentPoint.time, value: top }]);
                rightLine.setData([{ time: currentPoint.time, value: top }, { time: currentPoint.time, value: bot }]);
                bottomLine.setData([{ time: currentPoint.time, value: bot }, { time: startPoint.time, value: bot }]);
                leftLine.setData([{ time: startPoint.time, value: bot }, { time: startPoint.time, value: top }]);
                
                // Store all preview lines for cleanup
                previewSeries = { topLine, rightLine, bottomLine, leftLine };
            }
        };
        
        mouseUpHandler = (e) => {
            if (!isDragging || !startPoint || !drawingTool) {
                isDragging = false;
                clearPreview();
                container.style.cursor = '';
                return;
            }
            
            // Clear preview - actual drawing will be handled by click handler
            clearPreview();
            isDragging = false;
            container.style.cursor = '';
        };
        
        // Subscribe to crosshair move for drag preview
        if (chart && typeof chart.subscribeCrosshairMove === 'function') {
            chart.subscribeCrosshairMove(crosshairHandler);
        }
        
        // Add event listeners
        if (mouseDownHandler) container.addEventListener('mousedown', mouseDownHandler);
        if (mouseUpHandler) container.addEventListener('mouseup', mouseUpHandler);
        container.addEventListener('mouseleave', () => {
            if (isDragging) {
                clearPreview();
                isDragging = false;
                startPoint = null;
                container.style.cursor = '';
            }
        });
    }

    // Subscribe to clicks (for single-click tools like horizontal)
    try {
        if (chart && typeof chart.subscribeClick === 'function') {
            chart.subscribeClick(clickHandler);
        } else {
            console.error('❌ Chart or subscribeClick not available');
        }
    } catch (e) {
        console.error('❌ Error subscribing to chart clicks:', e);
    }

    // Return cleanup function
    return () => {
        // Clean up preview
        clearPreview();
        
        // Unsubscribe from crosshair move
        if (chart && crosshairHandler && typeof chart.unsubscribeCrosshairMove === 'function') {
            try {
                chart.unsubscribeCrosshairMove(crosshairHandler);
            } catch (e) {
            }
        }
        
        // Remove DOM event listeners
        if (chartContainerRef?.current) {
            const container = chartContainerRef.current;
            if (mouseDownHandler) container.removeEventListener('mousedown', mouseDownHandler);
            if (mouseUpHandler) container.removeEventListener('mouseup', mouseUpHandler);
            container.style.cursor = '';
        }
        
        // Unsubscribe from chart clicks
        try {
            if (chart && 
                typeof chart.unsubscribeClick === 'function' &&
                typeof chart.timeScale === 'function') {
                if (clickHandler) {
                    chart.unsubscribeClick(clickHandler);
                }
            }
        } catch (e) {
        }
        
        // Re-enable interactions (restore original chart behavior)
        try {
            if (chart && typeof chart.applyOptions === 'function') {
                chart.applyOptions({
                    handleScroll: {
                        mouseWheel: false, // Keep original settings
                        pressedMouseMove: true,
                        horzTouchDrag: true,
                        vertTouchDrag: true,
                    },
                    handleScale: {
                        mouseWheel: true,
                        pinch: true,
                        axisPressedMouseMove: {
                            time: true,
                            price: true,
                        },
                    }
                });
            }
        } catch (e) {
            // Chart may be disposed
        }
    };
};
