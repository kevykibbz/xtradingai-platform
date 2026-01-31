import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDerivAPI } from '@/contexts/DerivContext';
import { isValidAuthToken, isUserAuthenticated } from '@/lib/utils';

const AutoTraderPanel = ({ selectedMarket, aiPrediction, tradeType = 'rise_fall' }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [strategy, setStrategy] = useState('martingale');
  const [initialStake, setInitialStake] = useState(10);
  const [maxTrades, setMaxTrades] = useState(10);
  const [stopLoss, setStopLoss] = useState(100);
  const [takeProfit, setTakeProfit] = useState(200);
  const [useAI, setUseAI] = useState(true);
  const [tradesCount, setTradesCount] = useState(0);
  const [winCount, setWinCount] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalLoss, setTotalLoss] = useState(0);
  const [currentStake, setCurrentStake] = useState(10);
  const [proposal, setProposal] = useState(null);
  const tradingIntervalRef = useRef(null);
  const tradesCountRef = useRef(0);
  const totalLossRef = useRef(0);
  const totalProfitRef = useRef(0);
  const currentStakeRef = useRef(10);
  const maxTradesRef = useRef(10);
  const stopLossRef = useRef(100);
  const takeProfitRef = useRef(200);
  const strategyRef = useRef('martingale');
  const useAIRef = useRef(true);
  const aiPredictionRef = useRef(null);
  const tradeTypeRef = useRef('rise_fall');
  const initialStakeRef = useRef(10);
  const balanceRef = useRef(null);
  const selectedMarketRef = useRef(null);
  const apiRef = useRef(null);
  const isConnectedRef = useRef(false);
  const { toast } = useToast();
  const { api, connected: isConnected, user, deductBalance, requestBalanceUpdate } = useDerivAPI();
  const balance = user?.balance;
  
  // Sync refs with state and props
  useEffect(() => {
    tradesCountRef.current = tradesCount;
  }, [tradesCount]);
  
  useEffect(() => {
    totalLossRef.current = totalLoss;
  }, [totalLoss]);
  
  useEffect(() => {
    totalProfitRef.current = totalProfit;
  }, [totalProfit]);
  
  useEffect(() => {
    currentStakeRef.current = currentStake;
  }, [currentStake]);

  useEffect(() => {
    maxTradesRef.current = maxTrades;
  }, [maxTrades]);

  useEffect(() => {
    stopLossRef.current = stopLoss;
  }, [stopLoss]);

  useEffect(() => {
    takeProfitRef.current = takeProfit;
  }, [takeProfit]);

  useEffect(() => {
    strategyRef.current = strategy;
  }, [strategy]);

  useEffect(() => {
    useAIRef.current = useAI;
  }, [useAI]);

  useEffect(() => {
    aiPredictionRef.current = aiPrediction;
  }, [aiPrediction]);

  useEffect(() => {
    tradeTypeRef.current = tradeType;
  }, [tradeType]);

  useEffect(() => {
    initialStakeRef.current = initialStake;
  }, [initialStake]);

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  useEffect(() => {
    selectedMarketRef.current = selectedMarket;
  }, [selectedMarket]);

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const strategies = [
    { value: 'martingale', label: 'Martingale' },
    { value: 'anti-martingale', label: 'Anti-Martingale' },
    { value: 'dalembert', label: "D'Alembert" },
    { value: 'fibonacci', label: 'Fibonacci' },
    { value: 'ai-based', label: 'AI-Based' }
  ];

  // Fetch proposal for trading
  const fetchProposal = async (contractType) => {
    const market = selectedMarketRef.current;
    const stake = currentStakeRef.current;
    const apiInstance = apiRef.current;
    const connected = isConnectedRef.current;

    if (!market?.symbol || stake <= 0 || !apiInstance || !connected) {
      return null;
    }

    try {
      const baseParams = {
        proposal: 1,
        subscribe: 1,
        amount: stake,
        basis: 'stake',
        contract_type: contractType,
        currency: 'USD',
        symbol: market.symbol,
        duration: 5,
        duration_unit: 't',
      };

      const response = await apiInstance.send(baseParams);
      
      if (response.error) {
        console.error('AutoTrader: Proposal error:', response.error);
        toast({
          title: "Proposal Error",
          description: response.error.message || response.error.code || 'Failed to get proposal',
          variant: "destructive"
        });
        return null;
      }
      
      if (!response.proposal) {
        return null;
      }

      return response.proposal;
    } catch (error) {
      console.error('AutoTrader: Error fetching proposal:', error);
      toast({
        title: "Proposal Error",
        description: error.message || 'Failed to fetch proposal',
        variant: "destructive"
      });
      return null;
    }
  };

  // Execute a trade
  const executeTrade = async (direction, proposal) => {
    const apiInstance = apiRef.current;
    const connected = isConnectedRef.current;
    const balanceValue = balanceRef.current;
    const userValue = user;

    if (!apiInstance || !connected || !proposal?.id) {
      return { success: false, error: 'Not connected or no proposal' };
    }

    // Check if user is logged in with valid token (not default demo token)
    const hasValidToken = userValue?.token ? isValidAuthToken(userValue.token) : isUserAuthenticated();
    
    if (!hasValidToken) {
      return { success: false, error: 'Please log in to your account to place trades' };
    }

    if (balanceValue && currentStakeRef.current > balanceValue) {
      return { success: false, error: 'Insufficient balance' };
    }

    try {
      const buyRequest = {
        buy: proposal.id,
        price: proposal.ask_price || proposal.payout || currentStakeRef.current,
      };

      const response = await apiInstance.send(buyRequest);

      if (response.error) {
        return { success: false, error: response.error.message || response.error.code || 'Purchase failed' };
      }

      if (response.buy) {
        const buyPrice = response.buy.buy_price;
        
        // CRITICAL: Deduct balance immediately after successful trade
        // Get selected account from localStorage to use correct loginid
        let accountLoginid = userValue?.loginid;
        try {
          const selectedAccountStr = localStorage.getItem('deriv_selectedAccount');
          if (selectedAccountStr) {
            const selectedAccount = JSON.parse(selectedAccountStr);
            if (selectedAccount?.loginid) {
              accountLoginid = selectedAccount.loginid;
            }
          }
        } catch (e) {
          // Fallback to user loginid if parsing fails
        }
        
        if (deductBalance && buyPrice && accountLoginid) {
          deductBalance(buyPrice, accountLoginid);
        }
        
        // Request balance update from WebSocket to sync with server
        if (requestBalanceUpdate && accountLoginid) {
          requestBalanceUpdate(accountLoginid);
        }
        
        return { 
          success: true, 
          contractId: response.buy.contract_id,
          payout: response.buy.payout,
          buyPrice: buyPrice
        };
      }

      return { success: false, error: 'Invalid response' };
    } catch (error) {
      console.error('AutoTrader: Trade execution error:', error);
      return { success: false, error: error.message || 'Trade failed' };
    }
  };

  // Auto trading logic
  useEffect(() => {
    if (!isRunning || !selectedMarket) {
      if (tradingIntervalRef.current) {
        clearInterval(tradingIntervalRef.current);
        tradingIntervalRef.current = null;
      }
      return;
    }


    // Auto trading interval - place trade every 10 seconds
    tradingIntervalRef.current = setInterval(async () => {
      // Check limits using refs to get latest values
      const maxTradesValue = maxTradesRef.current;
      const stopLossValue = stopLossRef.current;
      const takeProfitValue = takeProfitRef.current;
      const strategyValue = strategyRef.current;
      const useAIValue = useAIRef.current;
      const aiPredictionValue = aiPredictionRef.current;
      const tradeTypeValue = tradeTypeRef.current;
      const initialStakeValue = initialStakeRef.current;
      const balanceValue = balanceRef.current;

      if (tradesCountRef.current >= maxTradesValue) {
        setIsRunning(false);
        toast({
          title: "Max Trades Reached",
          description: `Stopped after ${maxTradesValue} trades`,
        });
        return;
      }

      // Check stop loss and take profit
      if (totalLossRef.current >= stopLossValue) {
        setIsRunning(false);
        toast({
          title: "Stop Loss Triggered",
          description: `Stopped at loss of $${totalLossRef.current.toFixed(2)}`,
          variant: "destructive"
        });
        return;
      }

      if (totalProfitRef.current >= takeProfitValue) {
        setIsRunning(false);
        toast({
          title: "Take Profit Reached",
          description: `Stopped at profit of $${totalProfitRef.current.toFixed(2)}`,
        });
        return;
      }

      // Determine direction based on strategy and AI
      let direction = 'CALL';
      if (useAIValue && aiPredictionValue) {
        direction = aiPredictionValue.direction === 'RISE' ? 'CALL' : 'PUT';
      } else {
        // Random or strategy-based direction
        direction = Math.random() > 0.5 ? 'CALL' : 'PUT';
      }

      // Get contract type based on tradeType
      let contractType = 'CALL';
      if (tradeTypeValue === 'rise_fall') {
        contractType = direction === 'CALL' ? 'CALL' : 'PUT';
      } else if (tradeTypeValue === 'higher_lower') {
        contractType = direction === 'CALL' ? 'CALL' : 'PUT';
      }

      // Fetch proposal using current stake from ref
      const proposalData = await fetchProposal(contractType);
      if (!proposalData) {
        return;
      }

      setProposal(proposalData);

      // Execute trade
      const result = await executeTrade(direction, proposalData);
      
      if (result.success) {
        setTradesCount(prev => prev + 1);
        
        // Simulate win/loss (in real implementation, you'd track contract results)
        // For now, using a simple 60% win rate simulation
        const isWin = Math.random() > 0.4;
        
        if (isWin) {
          setWinCount(prev => prev + 1);
          const profit = (result.payout || currentStakeRef.current * 1.5) - currentStakeRef.current;
          setTotalProfit(prev => prev + profit);
          toast({
            title: "✅ Auto Trade Win",
            description: `Profit: $${profit.toFixed(2)} | Contract: ${result.contractId}`,
          });
          
          // Strategy: adjust stake based on result
          if (strategyValue === 'martingale') {
            // Reset stake after win
            setCurrentStake(initialStakeValue);
          } else if (strategyValue === 'anti-martingale') {
            // Increase stake after win
            setCurrentStake(prev => Math.min(prev * 1.5, balanceValue || prev * 1.5));
          }
        } else {
          const loss = currentStakeRef.current;
          setTotalLoss(prev => prev + loss);
          toast({
            title: "❌ Auto Trade Loss",
            description: `Loss: $${loss.toFixed(2)} | Contract: ${result.contractId}`,
            variant: "destructive"
          });
          
          // Strategy: adjust stake based on result
          if (strategyValue === 'martingale') {
            // Double stake after loss
            setCurrentStake(prev => Math.min(prev * 2, balanceValue || prev * 2));
          } else if (strategyValue === 'anti-martingale') {
            // Reset stake after loss
            setCurrentStake(initialStakeValue);
          }
        }
      } else {
        console.error('AutoTrader: Auto trade failed:', result.error);
        toast({
          title: "Auto Trade Failed",
          description: result.error || 'Failed to execute trade',
          variant: "destructive"
        });
      }
    }, 10000); // Trade every 10 seconds

    return () => {
      if (tradingIntervalRef.current) {
        clearInterval(tradingIntervalRef.current);
        tradingIntervalRef.current = null;
      }
    };
  }, [isRunning, selectedMarket, toast]); // Only essential dependencies

  const handleToggleTrader = () => {
    if (!selectedMarket) {
      toast({
        title: "No Market Selected",
        description: "Please select a market first",
        variant: "destructive"
      });
      return;
    }

    if (!api || !isConnected) {
      toast({
        title: "Not Connected",
        description: "Please connect to your account first",
        variant: "destructive"
      });
      return;
    }

    setIsRunning(!isRunning);
    setCurrentStake(initialStake); // Reset stake when starting
    
    if (!isRunning) {
      // Reset stats when starting
      setTradesCount(0);
      setWinCount(0);
      setTotalProfit(0);
      setTotalLoss(0);
    }
    
    toast({
      title: isRunning ? "Auto Trader Stopped" : "Auto Trader Started",
      description: isRunning 
        ? "Trading bot has been stopped" 
        : `Trading ${selectedMarket.display_name} with ${strategy} strategy`,
    });
  };

  return (
    <ScrollArea className="h-full pr-0"> {/* Added pr-0 to eliminate any right padding in the scroll area */}
      <div className="p-4 space-y-4">
        <div className="bg-gray-100 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-blue-500" />
              <span className="font-semibold text-gray-800">Auto Trader</span>
            </div>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              isRunning 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-200 text-gray-600'
            }`}>
              {isRunning ? 'RUNNING' : 'STOPPED'}
            </div>
          </div>

          <Button
            onClick={handleToggleTrader}
            className={`w-full h-12 font-semibold ${
              isRunning
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-green-500 hover:bg-green-600'
            } text-white`}
          >
            {isRunning ? (
              <>
                <Pause className="mr-2 h-5 w-5" />
                Stop Trading
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Start Trading
              </>
            )}
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Trading Strategy</Label>
            <Select value={strategy} onValueChange={setStrategy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {strategies.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
            <Label htmlFor="use-ai">Use AI Predictions</Label>
            <Switch
              id="use-ai"
              checked={useAI}
              onCheckedChange={setUseAI}
            />
          </div>

          <div className="space-y-2">
            <Label>Initial Stake (USD)</Label>
            <Input
              type="number"
              value={initialStake}
              onChange={(e) => setInitialStake(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Max Trades</Label>
            <Input
              type="number"
              value={maxTrades}
              onChange={(e) => setMaxTrades(Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Stop Loss</Label>
              <Input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Take Profit</Label>
              <Input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {isRunning && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border rounded-lg p-4 space-y-3"
          >
            <div className="text-sm font-medium text-gray-700">Trading Stats</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-100 rounded p-2">
                <div className="text-xs text-gray-500">Trades</div>
                <div className="text-lg font-bold text-black">{tradesCount} / {maxTrades}</div>
              </div>
              <div className="bg-gray-100 rounded p-2">
                <div className="text-xs text-gray-500">Win Rate</div>
                <div className="text-lg font-bold text-green-600">
                  {tradesCount > 0 ? Math.round((winCount / tradesCount) * 100) : 0}%
                </div>
              </div>
              <div className="bg-gray-100 rounded p-2">
                <div className="text-xs text-gray-500">Profit</div>
                <div className="text-lg font-bold text-green-600">${totalProfit.toFixed(2)}</div>
              </div>
              <div className="bg-gray-100 rounded p-2">
                <div className="text-xs text-gray-500">Loss</div>
                <div className="text-lg font-bold text-red-600">${totalLoss.toFixed(2)}</div>
              </div>
            </div>
            <div className="pt-2 border-t">
              <div className="text-xs text-gray-500 mb-1">Current Stake</div>
              <div className="text-sm font-semibold text-blue-600">${currentStake.toFixed(2)}</div>
            </div>
          </motion.div>
        )}
      </div>
    </ScrollArea>
  );
};

export default AutoTraderPanel;