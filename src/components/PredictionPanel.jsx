import React, { useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, Activity, Target, X, ChevronUp, ChevronDown, Zap } from 'lucide-react';
import { useTensorFlowPrediction } from '@/hooks/useTensorFlowPrediction';
import { Progress } from '@/components/ui/progress';

const PredictionPanelComponent = ({ symbol, tradeType, digitPrediction, digitConfidence, aiPrediction, mode = 'full' }) => {
    const isDigits = tradeType && ['matches_differs', 'even_odd', 'over_under'].includes(tradeType);
    const { prediction: tfPrediction, confidence: tfConfidence, isTraining: tfTraining } = useTensorFlowPrediction(symbol);

    let finalPrediction, finalConfidence, finalIsTraining = tfTraining;
    if (isDigits && digitPrediction !== undefined && digitConfidence !== undefined) {
        finalPrediction = digitPrediction;
        finalConfidence = digitConfidence;
        finalIsTraining = false;
    } else if (aiPrediction && aiPrediction.prediction !== undefined && aiPrediction.confidence !== undefined) {
        finalPrediction = aiPrediction.prediction;
        finalConfidence = aiPrediction.confidence;
        finalIsTraining = false;
    } else {
        finalPrediction = tfPrediction;
        finalConfidence = tfConfidence;
    }

    // Memoize confidence value to prevent layout shifts - only update when value changes significantly
    const confidenceValue = useMemo(() => {
        const conf = (finalConfidence || 0.65) * 100;
        // Round to nearest integer to prevent micro-updates
        return Math.round(conf).toString();
    }, [finalConfidence]); // Only update when confidence changes

    // Memoize progress value to prevent frequent updates
    const progressValue = useMemo(() => {
        return (finalConfidence || 0.65) * 100;
    }, [finalConfidence]);

    let displayText = '';
    let color = '';
    let icon = null;

    if (!finalIsTraining) {
        switch (tradeType) {
            case 'rise_fall':
                displayText = finalPrediction === 'rise' ? 'Rise' : 'Fall';
                icon = finalPrediction === 'rise' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />;
                color = finalPrediction === 'rise' ? 'text-green-600' : 'text-red-600';
                break;
            case 'higher_lower':
                displayText = finalPrediction === 'rise' ? 'Higher' : 'Lower';
                icon = finalPrediction === 'rise' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />;
                color = finalPrediction === 'rise' ? 'text-green-600' : 'text-red-600';
                break;
            case 'multipliers':
                displayText = finalPrediction === 'rise' ? 'Up' : 'Down';
                icon = finalPrediction === 'rise' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />;
                color = finalPrediction === 'rise' ? 'text-green-600' : 'text-red-600';
                break;
            case 'touch_no_touch':
                displayText = finalPrediction === 'rise' ? 'Touch' : 'No Touch';
                icon = finalPrediction === 'rise' ? <Target className="h-5 w-5" /> : <X className="h-5 w-5" />;
                color = finalPrediction === 'rise' ? 'text-green-600' : 'text-red-600';
                break;
            case 'ends_in_out':
                displayText = finalPrediction === 'rise' ? 'Ends Out' : 'Ends In';
                icon = finalPrediction === 'rise' ? <ChevronUp className="h-5 w-5" /> : <span className="text-lg">↔</span>;
                color = finalPrediction === 'rise' ? 'text-red-600' : 'text-green-600';
                break;
            case 'stays_in_goes_out':
                displayText = finalPrediction === 'rise' ? 'Goes Out' : 'Stays In';
                icon = finalPrediction === 'rise' ? <ChevronUp className="h-5 w-5" /> : <span className="text-lg">↔</span>;
                color = finalPrediction === 'rise' ? 'text-red-600' : 'text-green-600';
                break;
            case 'accumulators':
                displayText = 'Buy';
                icon = <TrendingUp className="h-5 w-5" />;
                color = 'text-green-600';
                break;
            case 'matches_differs':
                displayText = finalPrediction === 'matches' ? 'Matches' : 'Differs';
                icon = finalPrediction === 'matches' ? <X className="h-4 w-4" /> : <X className="h-4 w-4" strokeWidth={2} />;
                color = finalPrediction === 'matches' ? 'text-green-600' : 'text-red-600';
                break;
            case 'even_odd':
                displayText = finalPrediction === 'even' ? 'Even' : 'Odd';
                icon = finalPrediction === 'even' ? <span className="text-lg">●</span> : <span className="text-lg">○</span>;
                color = finalPrediction === 'even' ? 'text-green-600' : 'text-red-600';
                break;
            case 'over_under':
                displayText = finalPrediction === 'over' ? 'Over' : 'Under';
                icon = finalPrediction === 'over' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />;
                color = finalPrediction === 'over' ? 'text-green-600' : 'text-red-600';
                break;
            case 'call_put':
                displayText = finalPrediction === 'call' ? 'Call' : 'Put';
                icon = finalPrediction === 'call' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />;
                color = finalPrediction === 'call' ? 'text-green-600' : 'text-red-600';
                break;
            case 'turbos':
                displayText = finalPrediction === 'rise' ? 'Up' : 'Down';
                icon = finalPrediction === 'rise' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />;
                color = finalPrediction === 'rise' ? 'text-green-600' : 'text-red-600';
                break;
            default:
                displayText = finalPrediction === 'rise' ? 'Rise' : 'Fall';
                icon = finalPrediction === 'rise' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />;
                color = finalPrediction === 'rise' ? 'text-green-600' : 'text-red-600';
        }
    }

    if (mode === 'compact') {
        if (finalIsTraining) {
            return (
                <div className="text-center text-xs text-gray-400 py-1">
                    <Activity className="h-3 w-3 mx-auto mb-0.5 animate-pulse" />
                    Training AI...
                </div>
            );
        }
        // Ensure we always have a prediction to display
        if (!displayText || !icon) {
            displayText = displayText || 'Rise';
            icon = icon || <TrendingUp className="h-5 w-5" />;
            color = color || 'text-green-600';
        }

        return (
            <div className="space-y-1 min-h-[60px]">
                <div className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                    <Brain className="h-3 w-3 text-blue-500 flex-shrink-0" />
                    <span className="whitespace-nowrap">
                        {tradeType === 'call_put' ? 'Options Prediction' :
                            tradeType === 'turbos' ? 'Turbo Prediction' :
                                `AI Prediction (${tradeType})`}
                    </span>
                </div>
                <div className="flex items-center gap-3 min-h-[32px]">
                    <div className={`text-sm font-bold flex items-center gap-1 ${color} flex-shrink-0`}>
                        {React.cloneElement(icon, { className: icon.props.className ? icon.props.className.replace('h-5 w-5', 'h-3.5 w-3.5') : 'h-3.5 w-3.5' })}
                        <span className="whitespace-nowrap">{displayText}</span>
                    </div>
                    <div className="w-16 flex-shrink-0">
                        <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-gray-500">Confidence</span>
                            <span className="tabular-nums min-w-[32px] text-right">{confidenceValue}%</span>
                        </div>
                        <Progress value={progressValue} className="h-1" />
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-blue-400" />
                    <span className="font-semibold">
            {tradeType === 'call_put' ? 'Options AI Prediction' :
                tradeType === 'turbos' ? 'Turbo AI Prediction' :
                    `AI Prediction (${tradeType})`}
          </span>
                </div>
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                {finalIsTraining ? (
                    <div className="text-center py-8">
                        <Activity className="h-12 w-12 mx-auto mb-3 text-blue-400 animate-pulse" />
                        <p className="text-sm text-slate-400">Training model...</p>
                    </div>
                ) : (
                    <>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-4"
                        >
                            <div className="text-center">
                                <div className="text-sm text-slate-300 mb-2">
                                    {tradeType === 'call_put' ? 'Options Recommendation' :
                                        tradeType === 'turbos' ? 'Turbo Recommendation' :
                                            'Next Movement'}
                                </div>
                                <div className={`text-3xl font-bold ${color}`}>
                                    <div className="flex items-center justify-center gap-2">
                                        {React.cloneElement(icon, { className: icon.props.className ? icon.props.className.replace('h-5 w-5', 'h-8 w-8') : 'h-8 w-8' })}
                                        {displayText}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Confidence</span>
                                <span className="font-medium">{(finalConfidence * 100).toFixed(1)}%</span>
                            </div>
                            <Progress value={finalConfidence * 100} className="h-2" />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

PredictionPanelComponent.displayName = 'PredictionPanel';

const PredictionPanel = memo(PredictionPanelComponent);

export default PredictionPanel;