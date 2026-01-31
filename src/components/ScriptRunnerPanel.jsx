import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Play, Copy, Check, AlertCircle, Sparkles, Trash2, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

// Native textarea component as fallback/replacement
const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

const ScriptRunnerPanel = ({ 
  isOpen, 
  setIsOpen, 
  chartData = [], 
  selectedMarket = null, 
  lastTick = null,
  aiPrediction = null,
  tradeType = 'rise_fall',
  onAttachIndicatorsFromScript,
  activeIndicators = [],
  setActiveIndicators,
}) => {
    const [code, setCode] = useState('');
    const [output, setOutput] = useState('');
    const [copied, setCopied] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showExamples, setShowExamples] = useState(false);
    const { toast } = useToast();

    // Example indicator codes
    const exampleCodes = {
        rsi: `//@version=5
indicator("RSI Indicator", overlay=false)
length = input.int(14, title="RSI Length", minval=1)
rsi_value = ta.rsi(close, length)
plot(rsi_value, color=color.blue, linewidth=2)
hline(70, "Overbought", color=color.red, linestyle=hline.style_dashed)
hline(30, "Oversold", color=color.green, linestyle=hline.style_dashed)`,
        macd: `//@version=5
indicator("MACD", overlay=false)
fast = input.int(12, title="Fast Length")
slow = input.int(26, title="Slow Length")
signal = input.int(9, title="Signal Length")
[macdLine, signalLine, histLine] = ta.macd(close, fast, slow, signal)
plot(macdLine, color=color.blue, title="MACD")
plot(signalLine, color=color.orange, title="Signal")
plot(histLine, color=color.gray, style=plot.style_columns, title="Histogram")`,
        bollinger: `//@version=5
indicator("Bollinger Bands", overlay=true)
length = input.int(20, title="Length", minval=1)
mult = input.float(2.0, title="StdDev Multiplier", minval=0.1)
basis = ta.sma(close, length)
dev = mult * ta.stdev(close, length)
upper = basis + dev
lower = basis - dev
plot(basis, color=color.blue, title="Basis")
plot(upper, color=color.red, title="Upper")
plot(lower, color=color.green, title="Lower")`,
        maCrossover: `//@version=5
indicator("MA Crossover", overlay=true)
fast_length = input.int(9, title="Fast MA Length")
slow_length = input.int(21, title="Slow MA Length")
fast_ma = ta.ema(close, fast_length)
slow_ma = ta.ema(close, slow_length)
plot(fast_ma, color=color.blue, title="Fast MA")
plot(slow_ma, color=color.orange, title="Slow MA")
plotshape(crossover(fast_ma, slow_ma), style=shape.triangleup, 
          location=location.belowbar, color=color.green, size=size.small)
plotshape(crossunder(fast_ma, slow_ma), style=shape.triangledown, 
          location=location.abovebar, color=color.red, size=size.small)`,
        stochastic: `//@version=5
indicator("Stochastic", overlay=false)
k_period = input.int(14, title="%K Period", minval=1)
d_period = input.int(3, title="%D Period", minval=1)
k = ta.stoch(close, high, low, k_period)
d = ta.sma(k, d_period)
plot(k, color=color.blue, title="%K")
plot(d, color=color.orange, title="%D")
hline(80, "Overbought", color=color.red, linestyle=hline.style_dashed)
hline(20, "Oversold", color=color.green, linestyle=hline.style_dashed)`,
        ichimoku: `//@version=5
indicator("Ichimoku Cloud", overlay=true)
tenkan_length = input.int(9, title="Tenkan Sen")
kijun_length = input.int(26, title="Kijun Sen")
senkou_b_length = input.int(52, title="Senkou Span B")
tenkan = (ta.highest(high, tenkan_length) + ta.lowest(low, tenkan_length)) / 2
kijun = (ta.highest(high, kijun_length) + ta.lowest(low, kijun_length)) / 2
senkou_a = (tenkan + kijun) / 2
senkou_b = (ta.highest(high, senkou_b_length) + ta.lowest(low, senkou_b_length)) / 2
plot(tenkan, color=color.blue, title="Tenkan")
plot(kijun, color=color.red, title="Kijun")
plot(senkou_a, color=color.green, title="Senkou A")
plot(senkou_b, color=color.orange, title="Senkou B")`,
    };

    const loadExample = (exampleKey) => {
        if (exampleCodes[exampleKey]) {
            setCode(exampleCodes[exampleKey]);
            toast({
                title: "Example Loaded",
                description: "Example code loaded! Click 'Add to Chart' to see it in action.",
            });
            setShowExamples(false);
        }
    };
    
    // Track indicators added from scripts
    const scriptIndicators = useMemo(() => {
        return activeIndicators.filter(ind => ind.id?.startsWith('pine-'));
    }, [activeIndicators]);

    // Persist code to localStorage
    useEffect(() => {
        const savedCode = localStorage.getItem('trading-script-code');
        if (savedCode && !code) {
            setCode(savedCode);
        } else if (!savedCode && !code) {
            // Set default placeholder
            setCode('');
        }
    }, []);

    useEffect(() => {
        if (code) {
            localStorage.setItem('trading-script-code', code);
        }
    }, [code]);

    const isPineScript = (src) => {
      const lower = src.toLowerCase();
      return lower.includes('//@version') || lower.includes('indicator(') || lower.includes('strategy(');
    };

    // Extract numeric parameters from Pine Script
    const extractParam = (src, paramName, defaultValue) => {
        // Try multiple patterns: length=14, length = 14, length: 14, length(14)
        const patterns = [
            new RegExp(`${paramName}\\s*=\\s*(\\d+)`, 'i'),
            new RegExp(`${paramName}\\s*:\\s*(\\d+)`, 'i'),
            new RegExp(`${paramName}\\s*\\(\\s*(\\d+)`, 'i'),
            new RegExp(`\\b${paramName}\\s*\\(\\s*(\\d+)`, 'i'),
        ];
        for (const pattern of patterns) {
            const match = src.match(pattern);
            if (match) return parseInt(match[1]);
        }
        return defaultValue;
    };

    // Extract color from Pine Script
    const extractColor = (src, paramName, defaultValue) => {
        const patterns = [
            new RegExp(`${paramName}\\s*=\\s*color\\.(\\w+)`, 'i'),
            new RegExp(`${paramName}\\s*=\\s*#([0-9A-Fa-f]{6})`, 'i'),
        ];
        for (const pattern of patterns) {
            const match = src.match(pattern);
            if (match) {
                const colorName = match[1].toLowerCase();
                const colorMap = {
                    'blue': '#2962FF',
                    'red': '#F23645',
                    'green': '#26A69A',
                    'orange': '#FF6D00',
                    'yellow': '#FFD700',
                    'purple': '#9C27B0',
                    'pink': '#E91E63',
                    'white': '#FFFFFF',
                    'black': '#000000',
                };
                return colorMap[colorName] || `#${match[1]}` || defaultValue;
            }
        }
        return defaultValue;
    };

    const parsePineIndicators = (src) => {
      const lower = src.toLowerCase();
      const indicators = [];

      const now = Date.now();
      const baseId = (type) => `pine-${type}-${now}-${Math.random().toString(36).slice(2, 7)}`;

      // GainzAlgo V2: map to built-in GAINZ overlay indicator
      if (lower.includes("gainzalgo v2")) {
        indicators.push({
          id: baseId('GAINZ'),
          type: 'GAINZ',
          name: 'Gainz Algo V2 Alpha',
          location: 'overlay',
          enabled: true,
          options: {
            candle_stability_index_param: 0.7,
            rsi_index_param: 80,
            candle_delta_length_param: 10,
            disable_repeating_signals_param: true,
            tp_sl_multi: 1,
            rrr: '1:2',
            show_tp_sl: true,
          },
        });
      }

      // RSI - extract period parameter
      if (/\bta\.rsi\(|\brsi\(/.test(lower)) {
        // Try to extract from ta.rsi(close, period) or rsi(close, period)
        const rsiMatch = src.match(/(?:ta\.)?rsi\s*\([^,]+,\s*(\d+)/i);
        const period = rsiMatch ? parseInt(rsiMatch[1]) : (extractParam(src, 'length', 14) || extractParam(src, 'period', 14) || 14);
        indicators.push({
          id: baseId('RSI'),
          type: 'RSI',
          name: `RSI (${period})`,
          location: 'pane',
          enabled: true,
          period: period,
          color: '#FF6D00',
        });
      }

      // MACD - extract parameters
      if (/\bta\.macd\(|\bmacd\(/.test(lower)) {
        // Try to extract from ta.macd(close, fast, slow, signal)
        const macdMatch = src.match(/(?:ta\.)?macd\s*\([^,]+,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        let fastPeriod, slowPeriod, signalPeriod;
        if (macdMatch) {
          fastPeriod = parseInt(macdMatch[1]);
          slowPeriod = parseInt(macdMatch[2]);
          signalPeriod = parseInt(macdMatch[3]);
        } else {
          fastPeriod = extractParam(src, 'fast', 12) || extractParam(src, 'fastlength', 12) || 12;
          slowPeriod = extractParam(src, 'slow', 26) || extractParam(src, 'slowlength', 26) || 26;
          signalPeriod = extractParam(src, 'signal', 9) || extractParam(src, 'signallength', 9) || 9;
        }
        indicators.push({
          id: baseId('MACD'),
          type: 'MACD',
          name: `MACD (${fastPeriod}, ${slowPeriod}, ${signalPeriod})`,
          location: 'pane',
          enabled: true,
          fastPeriod: fastPeriod,
          slowPeriod: slowPeriod,
          signalPeriod: signalPeriod,
          macdColor: '#2962FF',
          signalColor: '#FF6D00',
        });
      }

      // Bollinger Bands - extract parameters
      if (/\bta\.bb\(|\bbb\(/.test(lower) || /bollinger/i.test(src)) {
        const period = extractParam(src, 'length', 20) || extractParam(src, 'period', 20) || 20;
        const stdDev = extractParam(src, 'mult', 2) || extractParam(src, 'stddev', 2) || 2;
        indicators.push({
          id: baseId('BBANDS'),
          type: 'BBANDS',
          name: `Bollinger Bands (${period}, ${stdDev})`,
          location: 'overlay',
          enabled: true,
          period: period,
          stdDev: stdDev,
          color: '#2962FF',
        });
      }

      // SMA - extract period
      if (/\bta\.sma\(|\bsma\(/.test(lower)) {
        // Try to extract from ta.sma(close, period) or sma(close, period)
        const smaMatch = src.match(/(?:ta\.)?sma\s*\([^,]+,\s*(\d+)/i);
        const period = smaMatch ? parseInt(smaMatch[1]) : (extractParam(src, 'length', 14) || extractParam(src, 'period', 14) || 14);
        indicators.push({
          id: baseId('SMA'),
          type: 'SMA',
          name: `SMA (${period})`,
          location: 'overlay',
          enabled: true,
          period: period,
          color: '#ff6d00',
        });
      }

      // EMA - extract period
      if (/\bta\.ema\(|\bema\(/.test(lower)) {
        // Try to extract from ta.ema(close, period) or ema(close, period)
        const emaMatch = src.match(/(?:ta\.)?ema\s*\([^,]+,\s*(\d+)/i);
        const period = emaMatch ? parseInt(emaMatch[1]) : (extractParam(src, 'length', 21) || extractParam(src, 'period', 21) || 21);
        indicators.push({
          id: baseId('EMA'),
          type: 'EMA',
          name: `EMA (${period})`,
          location: 'overlay',
          enabled: true,
          period: period,
          color: '#2962FF',
        });
      }

      // Stochastic
      if (/\bstoch\(|\bstochastic/i.test(lower)) {
        const kPeriod = extractParam(src, 'k', 14) || extractParam(src, 'k_period', 14) || 14;
        const dPeriod = extractParam(src, 'd', 3) || extractParam(src, 'd_period', 3) || 3;
        indicators.push({
          id: baseId('STOCH'),
          type: 'STOCH',
          name: `Stochastic (${kPeriod}, ${dPeriod})`,
          location: 'pane',
          enabled: true,
          kPeriod: kPeriod,
          dPeriod: dPeriod,
          color: '#2962FF',
        });
      }

      // ATR
      if (/\batr\(/i.test(lower) || /\bta\.atr\(/i.test(lower)) {
        const period = extractParam(src, 'length', 14) || extractParam(src, 'period', 14) || 14;
        indicators.push({
          id: baseId('ATR'),
          type: 'ATR',
          name: `ATR (${period})`,
          location: 'pane',
          enabled: true,
          period: period,
          color: '#FF6D00',
        });
      }

      // CCI
      if (/\bcci\(/i.test(lower) || /\bta\.cci\(/i.test(lower)) {
        const period = extractParam(src, 'length', 20) || extractParam(src, 'period', 20) || 20;
        indicators.push({
          id: baseId('CCI'),
          type: 'CCI',
          name: `CCI (${period})`,
          location: 'pane',
          enabled: true,
          period: period,
          color: '#2962FF',
        });
      }

      // Williams %R
      if (/\bwilliamsr\(/i.test(lower) || /\bta\.willr\(/i.test(lower)) {
        const period = extractParam(src, 'length', 14) || extractParam(src, 'period', 14) || 14;
        indicators.push({
          id: baseId('WILLIAMS_R'),
          type: 'WILLIAMS_R',
          name: `Williams %R (${period})`,
          location: 'pane',
          enabled: true,
          period: period,
          color: '#2962FF',
        });
      }

      // ADX
      if (/\badx\(/i.test(lower) || /\bta\.adx\(/i.test(lower)) {
        const period = extractParam(src, 'length', 14) || extractParam(src, 'period', 14) || 14;
        indicators.push({
          id: baseId('ADX'),
          type: 'ADX',
          name: `ADX (${period})`,
          location: 'pane',
          enabled: true,
          period: period,
          color: '#2962FF',
        });
      }

      // Ichimoku Cloud
      if (/ichimoku/i.test(lower) || /\btenkan/i.test(lower) || /\bkijun/i.test(lower)) {
        const convPeriod = extractParam(src, 'tenkan', 9) || extractParam(src, 'conversion', 9) || 9;
        const basePeriod = extractParam(src, 'kijun', 26) || extractParam(src, 'base', 26) || 26;
        const spanBPeriod = extractParam(src, 'spanb', 52) || extractParam(src, 'span_b', 52) || 52;
        indicators.push({
          id: baseId('ICHIMOKU'),
          type: 'ICHIMOKU',
          name: `Ichimoku Cloud`,
          location: 'overlay',
          enabled: true,
          convPeriod: convPeriod,
          basePeriod: basePeriod,
          spanBPeriod: spanBPeriod,
          displacement: 26,
        });
      }

      // Donchian Channels
      if (/donchian/i.test(lower)) {
        const period = extractParam(src, 'length', 20) || extractParam(src, 'period', 20) || 20;
        indicators.push({
          id: baseId('DONCHIAN'),
          type: 'DONCHIAN',
          name: `Donchian Channels (${period})`,
          location: 'overlay',
          enabled: true,
          period: period,
        });
      }

      // Envelope
      if (/envelope/i.test(lower)) {
        const period = extractParam(src, 'length', 20) || extractParam(src, 'period', 20) || 20;
        const percent = extractParam(src, 'percent', 2.5) || extractParam(src, 'pct', 2.5) || 2.5;
        indicators.push({
          id: baseId('ENVELOPE'),
          type: 'ENVELOPE',
          name: `Envelope (${period}, ${percent}%)`,
          location: 'overlay',
          enabled: true,
          period: period,
          percent: percent,
        });
      }

      // WMA
      if (/\bta\.wma\(|\bwma\(/i.test(lower)) {
        const period = extractParam(src, 'length', 14) || extractParam(src, 'period', 14) || 14;
        indicators.push({
          id: baseId('WMA'),
          type: 'WMA',
          name: `WMA (${period})`,
          location: 'overlay',
          enabled: true,
          period: period,
          color: '#2962FF',
        });
      }

      return indicators;
    };

    const handleRun = () => {
      if (!code || code.trim().length === 0) {
        toast({
          title: "Empty Code",
          description: "Please paste your TradingView indicator code first.",
          variant: "destructive"
        });
        return;
      }

      if (isPineScript(code) && onAttachIndicatorsFromScript) {
        const inds = parsePineIndicators(code);
        if (inds.length > 0) {
          onAttachIndicatorsFromScript(inds);
          const names = inds.map(i => i.name).join(', ');
          const pineOutput = `✅ TradingView / Pine Script Detected!\n\n📊 Indicators Added to Chart:\n${inds.map((ind, idx) => `  ${idx + 1}. ${ind.name}${ind.location === 'overlay' ? ' (on chart)' : ' (separate pane)'}`).join('\n')}\n\n💡 Tip: You can adjust parameters in the Indicators panel (click the chart icon).\n\n🎨 All indicators are now visible on your chart!`;
          setOutput(pineOutput);
          toast({
            title: "✅ Indicators Added!",
            description: `Added ${inds.length} indicator${inds.length > 1 ? 's' : ''} from your TradingView code.`,
          });
          return;
        } else {
          setOutput(`⚠️ TradingView / Pine Script Detected\n\n❌ No supported indicators found in your code.\n\nSupported indicators:\n• RSI, MACD, Bollinger Bands\n• SMA, EMA, Stochastic\n• ATR, CCI\n\n💡 Tip: Make sure your code uses standard TradingView functions like ta.rsi(), ta.macd(), etc.`);
          toast({
            title: "No Indicators Found",
            description: "We couldn't find any supported indicators in your code. Check the console for details.",
            variant: "destructive"
          });
          return;
        }
      }

      // Fallback: simulation mode
      const simulationOutput = `> Executing script...\n> Market: ${selectedMarket?.symbol || 'N/A'}\n> Last Tick: ${lastTick?.quote || 'N/A'}\n> AI Prediction: ${aiPrediction?.direction} (${aiPrediction?.confidence}%)\n> Chart Data Points: ${chartData.length}\n> Simulated buy order placed for ${aiPrediction?.direction || 'RISE'} at price ${lastTick?.quote || 1.25}\n> Profit: +$${Math.random() * 10}\n> Script completed successfully.\n`;
      setOutput(simulationOutput);
      toast({
          title: "Script Executed",
          description: "🚀 Your script ran in simulation mode using AI prediction and chart data. Real execution coming soon!",
      });
    };

    const handlePaste = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          setCode(text);
          toast({
            title: "Code Pasted",
            description: "TradingView code pasted! Click 'Add to Chart' to extract indicators.",
          });
        }
      } catch (err) {
        toast({
          title: "Paste Failed",
          description: "Could not read from clipboard. Please paste manually (Ctrl+V / Cmd+V).",
          variant: "destructive"
        });
      }
    };

    const handleRemoveIndicator = (indicatorId) => {
      if (setActiveIndicators) {
        setActiveIndicators(prev => {
          const updated = prev.filter(ind => ind.id !== indicatorId);
          // Save to localStorage immediately
          try {
            const storageKey = 'xtrading_chart_settings_v1';
            const currentSaved = localStorage.getItem(storageKey);
            if (currentSaved) {
              const saved = JSON.parse(currentSaved);
              saved.activeIndicators = updated;
              localStorage.setItem(storageKey, JSON.stringify(saved));
            }
          } catch (e) {
            console.error('Error saving to localStorage:', e);
          }
          return updated;
        });
        toast({
          title: "Indicator Removed",
          description: "The indicator has been removed from the chart.",
        });
      }
    };

    const handleClearAllScriptIndicators = () => {
      if (setActiveIndicators) {
        setActiveIndicators(prev => {
          const updated = prev.filter(ind => !ind.id?.startsWith('pine-'));
          // Save to localStorage immediately
          try {
            const storageKey = 'xtrading_chart_settings_v1';
            const currentSaved = localStorage.getItem(storageKey);
            if (currentSaved) {
              const saved = JSON.parse(currentSaved);
              saved.activeIndicators = updated;
              localStorage.setItem(storageKey, JSON.stringify(saved));
            }
          } catch (e) {
            console.error('Error saving to localStorage:', e);
          }
          return updated;
        });
        toast({
          title: "All Script Indicators Removed",
          description: "All indicators added from scripts have been removed.",
        });
      }
    };

    const handleClear = () => {
        setCode('');
        setOutput('');
        toast({
            title: "Cleared",
            description: "Editor cleared. Ready to paste new TradingView code! ✨",
        });
    };


    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="w-[90vw] max-w-2xl h-[75vh] flex flex-col p-0 overflow-hidden [&>button]:hidden">
                <DialogHeader className="flex-row items-center justify-between border-b pb-3 px-4 pt-4">
                    <DialogTitle className="text-base sm:text-lg">Create Indicator</DialogTitle>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
                        <X className="h-4 w-4" />
                    </Button>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Optional Help Toggle and Examples */}
                    <div className="px-4 pt-4 pb-2 border-b flex items-center justify-between gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowHelp(!showHelp)}
                            className="text-xs text-gray-600 hover:text-gray-900"
                        >
                            <HelpCircle className="h-4 w-4 mr-1" />
                            {showHelp ? 'Hide Help' : 'Need Help?'}
                            {showHelp ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowExamples(!showExamples)}
                            className="text-xs text-gray-600 hover:text-gray-900"
                        >
                            <Sparkles className="h-4 w-4 mr-1" />
                            {showExamples ? 'Hide Examples' : 'Load Example'}
                            {showExamples ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                        </Button>
                    </div>

                    {/* Examples Section */}
                    {showExamples && (
                        <div className="p-4 bg-purple-50 border-b overflow-y-auto max-h-64">
                            <h4 className="text-sm font-semibold text-gray-900 mb-2">📚 Example Indicators</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadExample('rsi')}
                                    className="text-xs"
                                >
                                    RSI
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadExample('macd')}
                                    className="text-xs"
                                >
                                    MACD
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadExample('bollinger')}
                                    className="text-xs"
                                >
                                    Bollinger
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadExample('maCrossover')}
                                    className="text-xs"
                                >
                                    MA Crossover
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadExample('stochastic')}
                                    className="text-xs"
                                >
                                    Stochastic
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadExample('ichimoku')}
                                    className="text-xs"
                                >
                                    Ichimoku
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Help Section - Collapsible */}
                    {showHelp && (
                        <div className="p-4 bg-blue-50 border-b overflow-y-auto max-h-96">
                            <div className="space-y-3">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-1">📊 Supported Indicators</h4>
                                    <p className="text-xs text-gray-700 mb-2">
                                        We support these TradingView indicators: RSI, MACD, Bollinger Bands, SMA, EMA, WMA, Stochastic, ATR, CCI, Williams %R, ADX, Ichimoku, Donchian, Envelope
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-1">💡 Example 1: RSI Indicator</h4>
                                    <div className="bg-white p-3 rounded border border-gray-200 mb-2">
                                        <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">//@version=5
indicator("RSI Indicator", overlay=false)
length = input.int(14, title="RSI Length", minval=1)
rsi_value = ta.rsi(close, length)
plot(rsi_value, color=color.blue, linewidth=2)
hline(70, "Overbought", color=color.red, linestyle=hline.style_dashed)
hline(30, "Oversold", color=color.green, linestyle=hline.style_dashed)</pre>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-1">💡 Example 2: MACD Indicator</h4>
                                    <div className="bg-white p-3 rounded border border-gray-200 mb-2">
                                        <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">//@version=5
indicator("MACD", overlay=false)
fast = input.int(12, title="Fast Length")
slow = input.int(26, title="Slow Length")
signal = input.int(9, title="Signal Length")
[macdLine, signalLine, histLine] = ta.macd(close, fast, slow, signal)
plot(macdLine, color=color.blue, title="MACD")
plot(signalLine, color=color.orange, title="Signal")
plot(histLine, color=color.gray, style=plot.style_columns, title="Histogram")</pre>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-1">💡 Example 3: Bollinger Bands</h4>
                                    <div className="bg-white p-3 rounded border border-gray-200 mb-2">
                                        <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">//@version=5
indicator("Bollinger Bands", overlay=true)
length = input.int(20, title="Length", minval=1)
mult = input.float(2.0, title="StdDev Multiplier", minval=0.1)
basis = ta.sma(close, length)
dev = mult * ta.stdev(close, length)
upper = basis + dev
lower = basis - dev
plot(basis, color=color.blue, title="Basis")
plot(upper, color=color.red, title="Upper")
plot(lower, color=color.green, title="Lower")</pre>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-1">💡 Example 4: Moving Average Crossover</h4>
                                    <div className="bg-white p-3 rounded border border-gray-200 mb-2">
                                        <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">//@version=5
indicator("MA Crossover", overlay=true)
fast_length = input.int(9, title="Fast MA Length")
slow_length = input.int(21, title="Slow MA Length")
fast_ma = ta.ema(close, fast_length)
slow_ma = ta.ema(close, slow_length)
plot(fast_ma, color=color.blue, title="Fast MA")
plot(slow_ma, color=color.orange, title="Slow MA")
plotshape(crossover(fast_ma, slow_ma), style=shape.triangleup, 
          location=location.belowbar, color=color.green, size=size.small)
plotshape(crossunder(fast_ma, slow_ma), style=shape.triangledown, 
          location=location.abovebar, color=color.red, size=size.small)</pre>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-1">📥 How to Import from TradingView:</h4>
                                    <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
                                        <li>Go to TradingView and open any indicator</li>
                                        <li>Click on the indicator name → Settings (gear icon)</li>
                                        <li>Click "Open Source" tab</li>
                                        <li>Copy the entire code and paste it here</li>
                                        <li>Click "Add to Chart" to extract and display indicators</li>
                                    </ol>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Code Editor */}
                    <div className="flex-1 p-4 overflow-hidden flex flex-col">
                        <div className="flex-1 flex flex-col">
                            <Textarea
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="flex-1 w-full bg-white border border-gray-200 rounded-md p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono resize-none"
                                placeholder="Paste your TradingView indicator code here...

Example:
//@version=5
indicator('My RSI', overlay=false)
rsi_value = ta.rsi(close, 14)
plot(rsi_value)"
                                spellCheck={false}
                            />
                            {!code && (
                                <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                                    <strong>💡 Quick Start:</strong> Copy any TradingView indicator code and paste it here. We'll automatically detect and add supported indicators to your chart!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t p-4 bg-white flex items-center justify-between">
                        {code && (
                            <Button variant="outline" onClick={handleClear} size="sm">
                                Clear
                            </Button>
                        )}
                        <div className="flex gap-2 ml-auto">
                            <Button 
                                variant="outline" 
                                onClick={() => setIsOpen(false)}
                                size="sm"
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleRun} 
                                className="bg-blue-600 hover:bg-blue-700"
                                size="sm"
                                disabled={!code || code.trim().length === 0}
                            >
                                <Play className="h-4 w-4 mr-2" /> Add to Chart
                            </Button>
                        </div>
                    </div>

                    {/* Output */}
                    {output && (
                        <div className="border-t p-4 bg-green-50 max-h-40 overflow-y-auto">
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap">{output}</pre>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ScriptRunnerPanel;