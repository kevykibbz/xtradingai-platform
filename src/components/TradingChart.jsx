// TradingChart.js
import React, { forwardRef, useImperativeHandle, useRef, useEffect, useCallback, memo, useMemo, useState } from 'react';
import {
    createChart,
    AreaSeries,
    CandlestickSeries,
    LineSeries,
    HistogramSeries,
    BarSeries,
    version,
    createSeriesMarkers,
    LineStyle
} from 'lightweight-charts';

// Indicator imports removed

const TradingChart = memo(forwardRef(({ data, chartType, timeInterval, indicators = [], symbol, barriers = [], drawingTool = null, onDrawingCreated = null }, ref) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRef = useRef({});
    const mainSeriesRef = useRef(null);
    const numPanesRef = useRef(0);
    const fitContentRef = useRef(false);
    const autoScrollRef = useRef(true);
    const userInteractedRef = useRef(false);  // Tracks if user has zoomed/dragged
    const isZoomedInRef = useRef(false);  // Tracks if zoomed in (narrower view)
    const prevRangeWidthRef = useRef(null);  // Track previous visible range width for zoom detection
    const scrollTimeoutRef = useRef(null);
    const latestTimeRef = useRef(null);
    const lastDataRef = useRef([]);  // Track previous data to detect appends/updates
    const rangeChangeHandlerRef = useRef(null);
    const priceRangeHandlerRef = useRef(null);
    const isMounted = useRef(true);
    // Indicator-related refs removed
    const barrierPriceLinesRef = useRef([]);
    const drawingSeriesRef = useRef([]);
    const drawingsMapRef = useRef(new Map()); // Map of drawingId -> series array
    const xtradingBoxesRef = useRef([]);
    const markerPrimitiveRef = useRef([]);
    const ttscalperLayerRef = useRef(null);
    // const ttStateRef = useRef(createTTScalperState(100)); // Removed - indicator functionality disabled
    const lastTTCoordsRef = useRef(new Map());
    const ttResizeRAFRef = useRef(null);
    const isPriceScaleChangingRef = useRef(false);
    const prevChartTypeRef = useRef(chartType);
    const prevTimeframeRef = useRef(timeInterval);
    const gainzOverlayRef = useRef(null);
    const overlayPaddingUpdateRef = useRef(null);





    // Indicator-related state removed

    // Helper to filter out invalid data points (null/undefined/NaN values)
    const sanitizeData = useCallback((data) => 
        data.filter(point => point?.value != null && !isNaN(point.value)), 
        []
    );
    const sanitizeDataTT = useCallback(
  (data) =>
    (data || []).filter(
      (point) =>
        point &&
        typeof point.time === 'number' &&
        !Number.isNaN(point.time) &&
        point.time > 0 &&                 // unix ms
        typeof point.value === 'number' &&
        !Number.isNaN(point.value),
    ),
  [],
);
    const normalizeADX = (data) =>
        data.map(p => ({
            time: p.time,
            value: p.value ?? undefined,
        }));

    // Indicator rendering helper functions removed
    // Memoize whether original data has OHLC
    const hasOHLC = useMemo(() => data?.length > 0 && 'open' in data[0], [data]);

    // const shouldResetTTState = // Removed - indicator functionality disabled
    //     prevChartTypeRef.current !== chartType ||
    //     prevTimeframeRef.current !== timeInterval;


    // Memoize processed main data to avoid recomputing on every render
    const processedMainData = useMemo(() => {
        // console.log('Processing main data, original length:', data?.length);
        if (!data || data.length === 0) return [];
        let processed = data;
        // if (processed.length > 1000) {  // Commented out to prevent slicing and start time changes that cause view resets
        //     processed = processed.slice(-1000);
        // }
        return 'open' in processed[0] ? processed : processed.map(d => ({ ...d, open: d.value, high: d.value, low: d.value, close: d.value }));
    }, [data]);

    useEffect(() => {
        if (data?.length === 0 && markerPrimitiveRef.current.length > 0) {
            markerPrimitiveRef.current.forEach(primitive => {
            primitive.setMarkers([]);
            });
            // markerPrimitiveRef.current = [];  // Reset array
            console.log('✅ ALL marker primitives cleared!');
        }
        }, [data?.length]);


    // Indicator computations removed - no longer used

    const processData = useCallback((rawMainData) => {
        // console.log('processData called with rawMainData length:', rawMainData?.length);
        if (!isMounted.current || !mainSeriesRef.current || !chartRef.current || rawMainData.length === 0) return;

        const timeScale = chartRef.current.timeScale();
        const oldStart = lastDataRef.current[0]?.time;
        const newStart = rawMainData[0].time;
        const startChanged = newStart !== oldStart;
        const isMajor = lastDataRef.current.length === 0 || startChanged;

        latestTimeRef.current = rawMainData[rawMainData.length - 1].time;

        const shift = startChanged ? (newStart - oldStart) : 0;

        // Indicator rendering removed - overlays processing disabled
        const chart = chartRef.current;
        // All indicator processing removed - no overlays or panes

        // Pane indicators processing removed
        

        if (isMajor) {
            // Full reset for main series
            const mainData = chartType === 'area' 
                ? rawMainData.map(d => ({ time: d.time, value: d.close }))
                : rawMainData;
            mainSeriesRef.current.setData(mainData);
            // Indicator functionality removed - FVG overlay processing disabled
            

            // Handle view after full setData
            const oldVisible = timeScale.getVisibleRange();
            if (userInteractedRef.current && oldVisible && startChanged) {
                // Preserve and shift view
                let newFrom = oldVisible.from + shift;
                let newTo = oldVisible.to + shift;
                const dataFrom = newStart;
                const dataTo = latestTimeRef.current;
                newFrom = Math.max(newFrom, dataFrom);
                newTo = Math.min(newTo, dataTo);
                if (newFrom < newTo) {
                    timeScale.setVisibleRange({ from: newFrom, to: newTo });
                } else {
                    // Fallback if out of bounds
                    timeScale.scrollToRealTime();
                }
            } else if (fitContentRef.current) {
                timeScale.fitContent();
                fitContentRef.current = false;
            } else if (autoScrollRef.current && !userInteractedRef.current && latestTimeRef.current) {
                if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
                scrollTimeoutRef.current = setTimeout(() => {
                    timeScale.scrollToRealTime();
                }, 100);
            }
        } else {
            const oldLen = lastDataRef.current.length;
            const newLen = rawMainData.length;
            if (chartType === 'area') {
                const getAreaPoint = (d) => ({ time: d.time, value: d.close });
                if (newLen > oldLen) {
                    // Append new points (handles batch)
                    for (let i = oldLen; i < newLen; i++) {
                        mainSeriesRef.current.update(getAreaPoint(rawMainData[i]));
                    }
                } else if (newLen === oldLen && oldLen > 0) {
                    // Update last point (e.g., current candle)
                    mainSeriesRef.current.update(getAreaPoint(rawMainData[newLen - 1]));
                }
            } else {
                if (newLen > oldLen) {
                    // Append new points (handles batch)
                    for (let i = oldLen; i < newLen; i++) {
                        mainSeriesRef.current.update(rawMainData[i]);
                    }
                } else if (newLen === oldLen && oldLen > 0) {
                    // Update last point (e.g., current candle)
                    mainSeriesRef.current.update(rawMainData[newLen - 1]);
                }
            }
            // Indicator functionality removed - FVG overlay processing disabled
            
        }

        lastDataRef.current = [...rawMainData];

        // Apply rightOffset only if auto-scrolling (not interacted)
        if (autoScrollRef.current) {
            timeScale.applyOptions({ rightOffset: 20 });
        }
    }, [chartType]);

    // Call processData when processedMainData changes
    useEffect(() => {
        if (processedMainData.length > 0) {
            processData(processedMainData);
        }
    }, [processedMainData, processData]);
    
useEffect(() => {
    prevChartTypeRef.current = chartType;
    prevTimeframeRef.current = timeInterval;
    }, [chartType, timeInterval]);

// Indicator functionality removed - TTScalper processing disabled


// Indicator functionality removed - TTScalper scale changes disabled


    useEffect(() => {
        isMounted.current = true;
        
        const container = chartContainerRef.current;
        const gainzOverlay = document.createElement("div");
        gainzOverlay.style.position = "absolute";
        gainzOverlay.style.top = "0";
        gainzOverlay.style.left = "0";
        gainzOverlay.style.width = "100%";
        gainzOverlay.style.height = "100%";
        gainzOverlay.style.pointerEvents = "none";
        gainzOverlayRef.current = gainzOverlay;

        chartContainerRef.current.style.position = "relative";
        // Indicator overlay removed
        if (!container) return;
        if (chartRef.current) {
            try {
                chartRef.current.remove();
            } catch (e) {
                // Ignore
            }
        }
        seriesRef.current = {};
        lastDataRef.current = [];  // Reset on chart recreate
        container.innerHTML = '';

        const newWidth = container.clientWidth || 800;
        const newHeight = container.clientHeight || 600;
        // Indicator panes removed - no pane indicators
        numPanesRef.current = 0;
        const minSectionHeight = 150;  // Minimum height per section (main or pane) to avoid squishing
        const totalSections = 1 + numPanesRef.current;  // Main + panes
        let sectionHeight = Math.max(newHeight / totalSections, minSectionHeight);
        // If equal split exceeds available space with mins, adjust: give main more if needed
        const minTotal = totalSections * minSectionHeight;
        if (minTotal > newHeight) {
            sectionHeight = newHeight / totalSections; 
        }
        const mainHeight = Math.max(newHeight - (numPanesRef.current * sectionHeight), sectionHeight);  // Main gets remaining or equal

        const chartOptions = {
            width: newWidth,
            height: newHeight,
            layout: {
                textColor: 'black',
                background: { type: 'solid', color: 'white' },
                panes: {
                    separatorColor: '#f22c3d',
                    separatorHoverColor: 'rgba(255, 0, 0, 0.1)',
                    enableResize: true,  // Enable manual resize of panes (drag separators)
                },
            },
            grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
            handleScroll: {
                mouseWheel: false,  // Disable wheel panning to allow zoom everywhere
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
            },
            handleScale: {
                axisPressedMouseMove: {
                    time: true,
                    price: true,
                },
                mouseWheel: true,  // Wheel now zooms (time + price based on hover)
                pinch: true,
            },
            timeScale: { 
                timeVisible: true, 
                secondsVisible: false,
                rightOffset: 20,
                barSpacing: 5,  // Increased for better drag responsiveness
                rightBarStaysOnScroll: false,  // Start with auto-follow; toggle to true on interaction
            },
            localization: {},
            // 👇 REQUIRED FOR V5 PRIMITIVES
            enablePrimitiveRendering: true,
        };
        const chart = createChart(container, chartOptions);
        chartRef.current = chart;
        const addCandlestickCompat = (opts, paneIndex) => {
            if (!chart) return null;
            if (typeof chart.addCandlestickSeries === 'function') {
                return paneIndex != null ? chart.addCandlestickSeries(opts, paneIndex) : chart.addCandlestickSeries(opts);
            }
            if (typeof chart.addSeries === 'function') {
                return paneIndex != null ? chart.addSeries(CandlestickSeries, opts, paneIndex) : chart.addSeries(CandlestickSeries, opts);
            }
            throw new Error('No compatible candlestick creation method on chart');
        };

        const addLineCompat = (opts, paneIndex) => {
            if (!chart) return null;
            if (typeof chart.addLineSeries === 'function') {
                return paneIndex != null ? chart.addLineSeries(opts, paneIndex) : chart.addLineSeries(opts);
            }
            if (typeof chart.addSeries === 'function') {
                return paneIndex != null ? chart.addSeries(LineSeries, opts, paneIndex) : chart.addSeries(LineSeries, opts);
            }
            throw new Error('No compatible line creation method on chart');
        };
        const addHistogramCompat = (opts, paneIndex) => {
           if (!chart) return null;
           if (typeof chart.addHistogramSeries === 'function') {
               return paneIndex != null ? chart.addHistogramSeries(opts, paneIndex) : chart.addHistogramSeries(opts);
           }
           if (typeof chart.addSeries === 'function') {
               return paneIndex != null ? chart.addSeries(HistogramSeries, opts, paneIndex) : chart.addSeries(HistogramSeries, opts);
           }
           // degrade gracefully by returning null
           return null;
       };
       // Subscribe to visible time range changes to detect manual pan/zoom to past
        const timeScale = chart.timeScale();
        const handleRangeChange = (range) => {
            if (!range || !latestTimeRef.current) return;

            const currentTo = range.to;
            const currentFrom = range.from;
            const currentWidth = currentTo - currentFrom;

            // Detect pan to past: if end of view is significantly before latest (e.g., <95% to avoid minor drifts)
            if (currentTo < latestTimeRef.current * 0.95) {
                userInteractedRef.current = true;
                autoScrollRef.current = false;
                timeScale.applyOptions({ rightBarStaysOnScroll: true });  // Lock: prevent auto-scroll to new data
                console.log('User panned to past—auto-scroll disabled and right bar locked');
            }

            // Detect zoom in/out by comparing range width
            if (prevRangeWidthRef.current !== null) {
                const prevWidth = prevRangeWidthRef.current;
                if (currentWidth < prevWidth * 0.9) {  // Zoomed in (width decreased >10%)
                    isZoomedInRef.current = true;
                    autoScrollRef.current = false;
                    timeScale.applyOptions({ rightBarStaysOnScroll: true });  // Lock on zoom in too
                    console.log('Zoomed in—view locked until zoom out');
                } else if (currentWidth > prevWidth * 1.1 && isZoomedInRef.current) {  // Zoomed out (width increased >10%) and was zoomed in
                    isZoomedInRef.current = false;
                    // Optionally re-enable auto-scroll here if desired, or keep manual reset
                    console.log('Zoomed out—zoom lock released');
                }
            }
            prevRangeWidthRef.current = currentWidth;

            // Indicator overlay rendering removed
        };
        timeScale.subscribeVisibleTimeRangeChange(handleRangeChange);
        rangeChangeHandlerRef.current = handleRangeChange;
        // Indicator overlay rendering on time range change removed
        const updateOverlayRightPadding = () => {
            const cont = chartContainerRef.current;
            const overlay = gainzOverlayRef.current;
            if (!cont || !overlay || !chart?.priceScale) return;
            let w = 0;
            let lw = 0;
            try {
                const rightPS = chart.priceScale('right');
                if (rightPS && typeof rightPS.width === 'function') {
                    w = rightPS.width() || 0;
                }
                const leftPS = chart.priceScale('left');
                if (leftPS && typeof leftPS.width === 'function') {
                    lw = leftPS.width() || 0;
                }
            } catch (e) {}
            const rightPad = Math.max(48, w || 0);
            const leftPad = Math.max(0, lw || 0);
            overlay.style.left = `${leftPad}px`;
            overlay.style.right = '';
            overlay.style.width = `calc(100% - ${leftPad + rightPad}px)`;
            overlay.style.boxSizing = 'border-box';
            overlay.style.overflow = 'hidden';
        };
        overlayPaddingUpdateRef.current = updateOverlayRightPadding;
        updateOverlayRightPadding();

        let mainSeries;
        if (chartType === 'area' || !hasOHLC) {
            // area series compat
            mainSeries = (typeof chart.addAreaSeries === 'function')
                ? chart.addAreaSeries({
                    topColor: 'rgba(128, 128, 128, 0.3)',
                    bottomColor: 'rgba(128, 128, 128, 0.1)',
                    lineColor: '#808080',
                    lineWidth: 2,
                    lastValueVisible: false,    // removes dotted line
                    priceLineVisible: false 
                })
                : chart.addSeries(AreaSeries, {
                    topColor: 'rgba(128, 128, 128, 0.3)',
                    bottomColor: 'rgba(128, 128, 128, 0.1)',
                    lineColor: '#808080',
                    lineWidth: 2,
                    lastValueVisible: false,    // removes dotted line
                    priceLineVisible: false 
            });
        } else if (chartType === 'ohlc') {
            mainSeries = (typeof chart.addBarSeries === 'function')
                ? chart.addBarSeries({
                    upColor: '#26a69a',
                    downColor: '#ef5350',
                    borderVisible: true,
                    borderUpColor: '#26a69a',
                    borderDownColor: '#ef5350',
                    lastValueVisible: false,    // removes dotted line
                    priceLineVisible: false
                })
                : chart.addSeries(BarSeries, {
                    upColor: '#26a69a',
                    downColor: '#ef5350',
                    borderVisible: true,
                    borderUpColor: '#26a69a',
                    borderDownColor: '#ef5350',
                    lastValueVisible: false,    // removes dotted line
                    priceLineVisible: false
            });
        } else {
            const candleOptions = {
                    upColor: '#26a69a',
                    downColor: '#ef5350',
                    borderVisible: false,
                    wickUpColor: '#26a69a',
                    wickDownColor: '#ef5350',
                    lastValueVisible: false,    // removes dotted line
                    priceLineVisible: false
            };
            if (chartType === 'hollow') {
                    candleOptions.upColor = 'transparent';
                    candleOptions.downColor = 'transparent';
                    candleOptions.borderVisible = true;
                    candleOptions.borderUpColor = '#26a69a';
                    candleOptions.borderDownColor = '#ef5350';
                    candleOptions.lastValueVisible = false;
                    candleOptions.priceLineVisible = false;
            }
            mainSeries = addCandlestickCompat(candleOptions);
        }
        mainSeriesRef.current = mainSeries;

        container.appendChild(gainzOverlay);

        return () => {
            if (chartRef.current) {
                try {
                    chartRef.current.remove();
                } catch (e) {
                    // Ignore
                }
            }
            if (rangeChangeHandlerRef.current && chartRef.current?.timeScale) {
                try {
                    chartRef.current.timeScale().unsubscribeVisibleTimeRangeChange(rangeChangeHandlerRef.current);
                } catch (e) {
                    // Ignore
                }
            }
            if (priceRangeHandlerRef.current && chartRef.current?.priceScale) {
                try {
                    chartRef.current.priceScale('right').unsubscribeVisiblePriceRangeChange(priceRangeHandlerRef.current);
                } catch (e) {
                    // Ignore
                }
            }
            isMounted.current = false;
        };
    }, [chartType, hasOHLC]);

    useImperativeHandle(ref, () => ({
        onScrollStateChange: (callback) => {
            // Provide scroll state change callback if needed
        }
    }));

    return <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />;
}));

export default TradingChart;