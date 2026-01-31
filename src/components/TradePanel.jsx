import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AutoTraderPanel from '@/components/AutoTraderPanel';
import TradeExecution from '@/components/TradeExecution';
import { ScrollArea } from '@/components/ui/scroll-area';
import TradeTypeSelector from '@/components/TradeTypeSelector';
import PredictionPanel from './PredictionPanel';

const TradePanel = ({ selectedMarket, tradeType, setTradeType, aiPrediction, onOpenTradeTypeSelector, onBarrierChange, onTradePlaced, openPositions }) => {
  const [activeTab, setActiveTab] = useState('trade');
  const symbol = selectedMarket?.symbol;

  const getDigitPrediction = () => {
    if (!tradeType || !['matches_differs', 'even_odd', 'over_under'].includes(tradeType)) return { digitPrediction: undefined, digitConfidence: undefined };
    return {
      digitPrediction: aiPrediction?.digitPrediction,
      digitConfidence: aiPrediction?.digitConfidence,
    };
  };

  const { digitPrediction, digitConfidence } = getDigitPrediction();

  return (
    <div className="w-full lg:w-[340px] bg-white border-t lg:border-l lg:border-t-0 border-gray-200 flex flex-col flex-shrink-0 h-full lg:max-h-screen relative z-10 isolate">
      <Tabs
        defaultValue="trade"
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col h-full min-h-0"
      >
        <TabsList className="grid w-full grid-cols-2 bg-gray-100 rounded-none p-0.5 h-8 shrink-0">
          <TabsTrigger
            value="trade"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=inactive]:text-gray-600 data-[state=active]:shadow-sm rounded-sm text-xs font-medium h-full flex items-center justify-center py-0.5"
          >
            Trade
          </TabsTrigger>
          <TabsTrigger
            value="autotrader"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=inactive]:text-gray-600 data-[state=active]:shadow-sm rounded-sm text-xs font-medium h-full flex items-center justify-center py-0.5"
          >
            Auto-Trade
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          {activeTab === 'trade' && (
            <TabsContent
              key="trade"
              value="trade"
              className="flex flex-col overflow-hidden m-0 flex-1 min-h-0"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-2 border-b bg-gray-50 shrink-0 min-h-[44px] flex items-center">
                <TradeTypeSelector.Button
                  selectedType={tradeType}
                  onClick={onOpenTradeTypeSelector}
                  className="w-full h-8 text-xs"
                />
              </div>

              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                  <TradeExecution
                    key={tradeType}
                    tradeType={tradeType}
                    selectedMarket={selectedMarket}
                    aiPrediction={aiPrediction}
                    onBarrierChange={onBarrierChange}
                    hidePrediction={true}
                    onTradePlaced={onTradePlaced}
                    openPositions={openPositions}
                  />
                </div>
                <div className="border-t bg-white shrink-0 p-1.5 min-h-[60px]">
                  <PredictionPanel
                    symbol={selectedMarket?.symbol}
                    tradeType={tradeType}
                    digitPrediction={digitPrediction}
                    digitConfidence={digitConfidence}
                    aiPrediction={aiPrediction ? {
                      prediction: aiPrediction.direction?.toLowerCase() || aiPrediction.prediction || 'rise',
                      confidence: typeof aiPrediction.confidence === 'number' && aiPrediction.confidence > 1
                        ? aiPrediction.confidence / 100
                        : aiPrediction.confidence || 0.65
                    } : { prediction: 'rise', confidence: 0.65 }}
                    mode="compact"
                  />
                </div>
              </div>
            </TabsContent>
          )}

          {activeTab === 'autotrader' && (
            <TabsContent
              key="autotrader"
              value="autotrader"
              className="flex flex-col overflow-hidden m-0 flex-1 min-h-0"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ScrollArea className="flex-1 min-h-0 w-full">
                <AutoTraderPanel
                  selectedMarket={selectedMarket}
                  aiPrediction={aiPrediction}
                  tradeType={tradeType}
                />
              </ScrollArea>
            </TabsContent>
          )}
        </AnimatePresence>
      </Tabs>

    </div>
  );
};

export default TradePanel;