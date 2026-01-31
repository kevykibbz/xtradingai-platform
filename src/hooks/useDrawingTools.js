// src/hooks/useDrawingTools.js
import { useRef, useCallback } from 'react';

export const useDrawingTools = (chartRef) => {
  const activeToolRef = useRef(null);
  const primitivesRef = useRef([]);
  const clickHandlerRef = useRef(null);
  const startPointRef = useRef(null);

  const activateTool = useCallback((toolId) => {
    const chart = chartRef.current;
    if (!chart) return;

    deactivateTool();
    activeToolRef.current = toolId;

    chart.applyOptions({
      handleScroll: false,
      handleScale: false,
    });
  }, [chartRef]);

  const deactivateTool = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;

    activeToolRef.current = null;
    startPointRef.current = null;

    if (clickHandlerRef.current) {
      chart.unsubscribeClick(clickHandlerRef.current);
      clickHandlerRef.current = null;
    }

    chart.applyOptions({
      handleScroll: true,
      handleScale: true,
    });
  }, [chartRef]);

  const drawLine = (p1, p2, color = '#2962FF') => {
    const chart = chartRef.current;
    if (!chart) return;

    const line = chart.addLineSeries({  // ← This works in v5!
      color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    line.setData([
      { time: p1.time, value: p1.price },
      { time: p2.time, value: p2.price },
    ]);

    primitivesRef.current.push(line);
  };

  const drawHorizontal = (price, color = '#FF6D00') => {
    const chart = chartRef.current;
    if (!chart) return;

    const line = chart.addLineSeries({
      color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const range = chart.timeScale().getVisibleRange();
    if (!range) return;

    // fallback
    line.setData([
      { time: range.from, value: price },
      { time: range.to, value: price },
    ]);

    primitivesRef.current.push(line);
  };

  const drawChannel = (p1, p2) => {
    const mid = (p1.price + p2.price) / 2;
    const diff = Math.abs(p1.price - p2.price);

    drawLine({ time: p1.time, price: mid + diff }, { time: p2.time, price: mid + diff }, '#E91E63');
    drawLine({ time: p1.time, price: mid - diff }, { time: p2.time, price: mid - diff }, '#E91E63');
    drawLine(p1, p2, '#E91E63');
  };

  const drawFib = (p1, p2) => {
    const high = Math.max(p1.price, p2.price);
    const low = Math.min(p1.price, p2.price);
    const diff = high - low;
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

    levels.forEach(l => {
      const price = high - diff * l;
      const color = l === 0 || l === 1 ? '#FF9800' : '#9C27B0';
      drawHorizontal(price, color);
    });
  };

  const startDrawing = useCallback((tool) => {
    const chart = chartRef.current;
    if (!chart) return;

    activateTool(tool.id);
    startPointRef.current = null;

    const handleClick = (param) => {
      if (!param?.time || param.point === undefined) return;

      // In Lightweight-Charts v5, param.point.y is already the price!
      const price = param.point.y;
      const point = { time: param.time, price };

      if (!startPointRef.current) {
        startPointRef.current = point;
        return;
      }

      const p1 = startPointRef.current;
      const p2 = point;

      switch (tool.id) {
        case 'line':
        case 'trend':
        case 'ray':
        case 'arrow':
          drawLine(p1, p2);
          break;
        case 'channel':
          drawChannel(p1, p2);
          break;
        case 'fib-retracement':
          drawFib(p1, p2);
          break;
        case 'horizontal':
          drawHorizontal(p2.price);
          break;
        case 'rectangle':
          const top = Math.max(p1.price, p2.price);
          const bot = Math.min(p1.price, p2.price);
          drawLine({ time: p1.time, price: top }, { time: p2.time, price: top }, '#4CAF50');
          drawLine({ time: p2.time, price: top }, { time: p2.time, price: bot }, '#4CAF50');
          drawLine({ time: p2.time, price: bot }, { time: p1.time, price: bot }, '#4CAF50');
          drawLine({ time: p1.time, price: bot }, { time: p1.time, price: top }, '#4CAF50');
          break;
        default:
          break;
      }

      startPointRef.current = null;
      deactivateTool(); // one drawing per two clicks
    };

    clickHandlerRef.current = handleClick;
    chart.subscribeClick(handleClick);
  }, [chartRef]);

  const clearAllDrawings = useCallback(() => {
    primitivesRef.current.forEach(s => {
      try { s.remove(); } catch (e) {}
    });
    primitivesRef.current = [];
    deactivateTool();
  }, [deactivateTool]);

  return {
    startDrawing,
    deactivateTool,
    clearAllDrawings,
  };
};