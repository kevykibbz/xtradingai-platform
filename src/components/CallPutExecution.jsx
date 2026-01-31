import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Info, Minus, Plus, Calendar as CalendarIcon, ChevronUp, ChevronDown, DollarSign, Loader2, ChevronLeft, ChevronRight, ChevronRightIcon } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from './ui/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ensureUserAccountAuthenticated } from '@/utils/tradeExecutionUtils';
import { isAPIToken, getUserOAuthToken } from '@/lib/utils';
import PredictionPanel from './PredictionPanel';
import { useDerivAPI } from '@/contexts/DerivContext';
import { StyledTradeButton } from './TradeExecution';

// Helper function to check if user is logged in (has token in localStorage or user state)
const isUserLoggedIn = () => {
  try {
    const saved = localStorage.getItem('deriv_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      return !!parsed?.token;
    }
  } catch {
    // Ignore parse errors
  }
  return false;
};

// Helper function to get selected account from localStorage
const getSelectedAccountFromStorage = () => {
  try {
    const saved = localStorage.getItem('deriv_selectedAccount');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.loginid) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('[CallPutExecution] Error getting selectedAccount from localStorage:', e);
  }
  return null;
};

const CallPutExecution = ({ selectedMarket, tradeType = 'call_put', aiPrediction, onBarrierChange, hidePrediction = false, onTradePlaced, hideActionButtons = false, onProposalsSync }) => {
    const [stake, setStake] = useState(10);
    const [payout, setPayout] = useState(10);
    const [stakeOrPayout, setStakeOrPayout] = useState('payout'); // Default to payout
    const [durationValue, setDurationValue] = useState(1);
    // Set default end date to tomorrow
    const getTomorrowDate = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 0);
        return tomorrow;
    };
    const [endDate, setEndDate] = useState(getTomorrowDate());
    const [durationOrEndtime, setDurationOrEndtime] = useState('duration');
    const [durationUnit, setDurationUnit] = useState('d'); // Default to days
    const [strikePrice, setStrikePrice] = useState(0.01); // Initialize to non-zero value
    const [strikePriceError, setStrikePriceError] = useState(null);
    const [callProposal, setCallProposal] = useState(null);
    const [putProposal, setPutProposal] = useState(null);
    const [currentPrice, setCurrentPrice] = useState(0);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const lastTradeTimeRef = useRef(0); // Track last trade attempt time for cooldown
    const { toast } = useToast();
    const { api, lastTick, connected: isConnected, user, deductBalance, requestBalanceUpdate, login } = useDerivAPI();
    // CRITICAL: Use selected account balance from localStorage (most up-to-date for selected account)
    // This ensures we use the balance for the selected account, not the first account
    const selectedAccount = getSelectedAccountFromStorage();
    const balance = selectedAccount?.balance ?? user?.balance ?? 0;
    
    // Check if user is logged in and has non-zero balance
    // Use useMemo to make it reactive to user and balance changes
    const canTrade = useMemo(() => {
        const hasToken = isUserLoggedIn();
        if (!user && !hasToken) return false;
        const selectedAccount = getSelectedAccountFromStorage();
        const userBalance = selectedAccount?.balance ?? user?.balance ?? 0;
        return userBalance > 0;
    }, [user, user?.balance]);

    // Fetch current market price
    useEffect(() => {
        if (lastTick && lastTick.symbol === selectedMarket?.symbol) {
            const price = lastTick.quote || 0;
            setCurrentPrice(price);
            // Set strike price to current price by default if it's zero or invalid
            if (!strikePrice || strikePrice <= 0 || isNaN(strikePrice)) {
                setStrikePrice(price > 0 ? price : 0.01);
            }
        }
    }, [lastTick, selectedMarket]);
    
    // Report strike price to chart
    useEffect(() => {
        if (!onBarrierChange || !selectedMarket?.symbol || strikePrice <= 0) {
            onBarrierChange?.([]);
            return;
        }
        onBarrierChange?.([{
            price: strikePrice,
            label: `Strike ${strikePrice.toFixed(2)}`,
            color: '#60A5FA', // Light blue color
            lineStyle: 2, // dashed
        }]);
    }, [strikePrice, selectedMarket?.symbol, onBarrierChange]);

    const fetchProposal = async (contractType, extra = {}) => {
        const amount = stakeOrPayout === 'payout' ? payout : stake;
        if (!selectedMarket?.symbol || amount <= 0 || !api) return null;
        
        // Validate strike price is greater than zero
        if (!strikePrice || strikePrice <= 0 || isNaN(strikePrice)) {
            return null;
        }
        
        // Build proposal request according to Deriv API documentation
        // Format barrier as string, ensuring it matches the regex: ^(?=.{1,20}$)[+-]?[0-9]+\.?[0-9]*$
        // For Call/Put, barrier is the absolute strike price (not an offset)
        const barrierStr = strikePrice.toString();
        
        const baseParams = {
            proposal: 1, // Must be 1
            amount: amount,
            basis: stakeOrPayout, // 'payout' or 'stake'
            contract_type: contractType,
            currency: 'USD', // Should match account currency
            symbol: selectedMarket.symbol,
            barrier: barrierStr,
            ...extra,
        };
        // Either date_expiry or duration is required
        if (durationOrEndtime === 'duration') {
            baseParams.duration = durationValue;
            baseParams.duration_unit = durationUnit;
        } else {
            baseParams.date_expiry = Math.floor(endDate.getTime() / 1000);
            // Don't include duration when using date_expiry
        }
        try {
            const response = await api.send(baseParams);
            
            // Handle error response
            if (response.error) {
                const errorCode = response.error.code;
                const errorMessage = response.error.message || '';
                
                // Check for strike price validation errors
                if (errorCode === 'ContractBuyValidationError' && errorMessage.includes('strike') || errorMessage.includes('barrier')) {
                    setStrikePriceError('Strike price is out of acceptable range.');
                } else {
                    setStrikePriceError(null);
                }
                
                // Check for rate limit errors
                const isRateLimit = errorCode === 'RateLimit' || errorMessage.includes('rate limit') || errorMessage.includes('RateLimit');
                if (!isRateLimit) {
                }
                return null;
            }
            
            setStrikePriceError(null);
            
            // Validate response structure
            if (response.msg_type && response.msg_type !== 'proposal') {
            }
            
            // Handle subscription if present
            if (response.subscription) {
            }
            
            // Return proposal data
            if (response.proposal) {
                return response.proposal;
            }
            
            return null;
        } catch (error) {
            return null;
        }
    };

    useEffect(() => {
        // Only fetch proposals if strike price is valid (greater than 0)
        if (!strikePrice || strikePrice <= 0 || isNaN(strikePrice)) {
            setCallProposal(null);
            setPutProposal(null);
            return;
        }
        
        setIsLoading(true);
        const fetchProposals = async () => {
            const [callRes, putRes] = await Promise.all([
                fetchProposal('VANILLALONGCALL'),
                fetchProposal('VANILLALONGPUT'),
            ]);
            setCallProposal(callRes);
            setPutProposal(putRes);
            setIsLoading(false);
        };
        
        // Debounce to prevent rate limiting
        const timeoutId = setTimeout(fetchProposals, 800);
        return () => {
            clearTimeout(timeoutId);
            setIsLoading(false);
        };
    }, [stakeOrPayout, stake, payout, durationValue, durationUnit, endDate, durationOrEndtime, strikePrice, selectedMarket?.symbol, api, isConnected]);

    const handleStakeChange = (amount) => {
        setStake(prev => Math.max(1, prev + amount));
    };

    const handlePayoutChange = (amount) => {
        setPayout(prev => Math.max(1, prev + amount));
    };

    const handleDurationChange = (amount) => {
        const minValue = durationUnit === 't' ? 1 : (durationUnit === 'm' ? 1 : (durationUnit === 'h' ? 1 : 1));
        setDurationValue(prev => Math.max(minValue, prev + amount));
    };

    const handleStrikePriceChange = (e) => {
        const value = parseFloat(e.target.value);
        // Ensure strike price is always greater than 0
        setStrikePrice(value > 0 ? value : (currentPrice > 0 ? currentPrice : 0.01));
        setStrikePriceError(null);
    };

    // Calculate expiry date from duration
    const calculateExpiry = React.useMemo(() => {
        if (durationOrEndtime === 'endtime' && endDate) {
            return endDate;
        }
        if (durationOrEndtime === 'duration' && durationUnit === 'd') {
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + durationValue);
            expiry.setHours(23, 59, 59, 0);
            return expiry;
        }
        return null;
    }, [durationOrEndtime, durationUnit, durationValue, endDate]);

    const handlePurchase = async (contractType, proposal) => {
        // Prevent duplicate requests - critical for real-time trading
        if (isPurchasing) {
            return;
        }

        // Cooldown mechanism: prevent rapid successive trades (1.5 seconds minimum between trades)
        const now = Date.now();
        const timeSinceLastTrade = now - lastTradeTimeRef.current;
        const COOLDOWN_MS = 1500; // 1.5 seconds cooldown to prevent rate limiting
        
        if (timeSinceLastTrade < COOLDOWN_MS) {
            const remainingTime = ((COOLDOWN_MS - timeSinceLastTrade) / 1000).toFixed(1);
            toast({
                title: 'Please Wait',
                description: `Please wait ${remainingTime} seconds before placing another trade to avoid rate limits.`,
                variant: 'destructive',
                duration: 2000,
            });
            return;
        }

        if (!proposal || !proposal.id) {
            toast({
                title: 'Error',
                description: 'Proposal not available. Please try again.',
                variant: 'destructive',
            });
            return;
        }

        if (!api || !isConnected) {
            toast({
                title: 'Not Connected',
                description: 'Please connect to your account first',
                variant: 'destructive'
            });
            return;
        }

        // Check if user is logged in and has non-zero balance
        if (!canTrade) {
            toast({
                title: 'Login Required',
                description: 'Please log in with an account that has a non-zero balance to place trades',
                variant: 'destructive'
            });
            return;
        }

        // CRITICAL: Verify account match before placing trade
        // The Deriv API uses the account that the WebSocket is authenticated with
        // If user.loginid doesn't match selectedAccount.loginid, the API will check the wrong account's balance
        if (selectedAccount && selectedAccount.loginid && user?.loginid && user.loginid !== selectedAccount.loginid) {
            console.error('[CallPutExecution] CRITICAL: Account mismatch detected!', {
                selectedAccountLoginid: selectedAccount.loginid,
                selectedAccountBalance: selectedAccount.balance,
                authenticatedLoginid: user.loginid,
                authenticatedBalance: user.balance
            });
            
            toast({
                title: 'Account Not Ready',
                description: `The selected account (${selectedAccount.loginid}) does not match the authenticated account (${user.loginid}). Please wait for account switch to complete or refresh the page.`,
                variant: 'destructive',
                duration: 5000,
            });
            
            return;
        }

        setIsPurchasing(true);
        try {
            // Build buy request according to Deriv API documentation
            const buyRequest = {
                buy: proposal.id,
                price: proposal.ask_price || proposal.payout || stake,
            };

            // CRITICAL: Ensure we're using user's OAuth token, not API token
            const canTrade = await ensureUserAccountAuthenticated({ user, login, toast });
            if (!canTrade) {
                setIsPurchasing(false);
                return; // Error already shown by ensureUserAccountAuthenticated
            }
            
            // CRITICAL: Final verification - check that user.token is NOT an API token
            const userOAuthToken = getUserOAuthToken();
            if (user?.token && isAPIToken(user.token) && userOAuthToken) {
                console.error('[CallPutExecution] CRITICAL: User state still shows API token! Blocking trade to protect API owner account.');
                setIsPurchasing(false);
                toast({
                    title: 'Account Error',
                    description: 'Please refresh the page and log in again. Cannot place trades with API owner account.',
                    variant: 'destructive'
                });
                return;
            }
            
            // CRITICAL: Verify localStorage also has user OAuth token, not API token
            try {
                const stored = localStorage.getItem('deriv_user');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed?.token && isAPIToken(parsed.token) && userOAuthToken) {
                        console.error('[CallPutExecution] CRITICAL: localStorage still has API token! Blocking trade.');
                        setIsPurchasing(false);
                        toast({
                            title: 'Account Not Ready',
                            description: 'Please wait for your account to be authenticated. Trades cannot be placed with API owner account.',
                            variant: 'destructive'
                        });
                        return;
                    }
                }
            } catch (e) {
                // Ignore errors
            }

            // CRITICAL: Log account info before placing trade
            console.log('[CallPutExecution] Placing trade with:', {
                selectedAccountLoginid: selectedAccount?.loginid,
                authenticatedLoginid: user?.loginid,
                balance: balance,
                token: user?.token ? `${user.token.substring(0, 20)}...` : 'no token'
            });

            const response = await api.send(buyRequest);


            // Handle error response
            if (response.error) {
                const errorCode = response.error.code;
                const errorMessage = response.error.message || 'Purchase failed';
                
                // Provide specific error messages for common errors
                let userMessage = errorMessage;
                if (errorCode === 'InvalidSellContractProposal') {
                    userMessage = 'Proposal expired. Please try again - the system will fetch a fresh proposal.';
                } else if (errorCode === 'RateLimit') {
                    userMessage = 'Too many requests. Please wait a moment and try again.';
                } else if (errorCode === 'InsufficientBalance') {
                    // Show the actual account balance from selected account for better error message
                    const selectedAccount = getSelectedAccountFromStorage();
                    const actualBalance = selectedAccount?.balance ?? user?.balance ?? 0;
                    const requiredAmount = proposal?.ask_price || stake;
                    
                    // CRITICAL: Check if there's an account mismatch
                    const accountMismatch = selectedAccount?.loginid && user?.loginid && selectedAccount.loginid !== user.loginid;
                    
                    if (accountMismatch) {
                        userMessage = `Account mismatch detected! Selected account (${selectedAccount.loginid}) has ${actualBalance.toFixed(2)} USD, but the API checked account (${user.loginid}) which may have 0.00 USD. Please wait for account switch to complete or refresh the page.`;
                    } else {
                        userMessage = `Insufficient balance. Your account (${selectedAccount?.loginid || user?.loginid || 'current'}) has ${actualBalance.toFixed(2)} USD, but ${requiredAmount.toFixed(2)} USD is required.`;
                    }
                } else if (errorCode === 'MarketClosed') {
                    userMessage = 'Market is currently closed. Please try again later.';
                }
                
                throw new Error(userMessage);
            }

            // Handle successful purchase
            if (response.buy) {
                const contractId = response.buy.contract_id;
                const buyPrice = response.buy.buy_price;
                const payout = response.buy.payout;
                
                // CRITICAL: Deduct balance immediately after successful trade
                // Use selectedAccount loginid if available, otherwise use user loginid
                const selectedAccount = getSelectedAccountFromStorage();
                const accountLoginid = selectedAccount?.loginid || user?.loginid;
                if (deductBalance && buyPrice && accountLoginid) {
                    deductBalance(buyPrice, accountLoginid);
                }
                
                // Request balance update from WebSocket to sync with server
                if (requestBalanceUpdate && accountLoginid) {
                    requestBalanceUpdate(accountLoginid);
                }
                
                toast({
                    title: `✅ Purchased ${contractType} Option`,
                    description: `Contract ID: ${contractId}${payout ? ` | Payout: $${payout.toFixed(2)}` : ''}`,
                });

                // Add position to open positions
                if (onTradePlaced) {
                    onTradePlaced({
                        contract_id: contractId,
                        buy_price: buyPrice,
                        payout: payout,
                        contract_type: contractType === 'Call' ? 'CALL' : 'PUT',
                        trade_type: tradeType,
                        symbol: selectedMarket.symbol,
                        display_name: selectedMarket.name || selectedMarket.symbol,
                        duration: durationValue,
                        duration_unit: 'd',
                        stake: stake,
                        start_time: Date.now() / 1000,
                        profit: 0,
                        sell_price: buyPrice,
                    });
                }

                // Optional: Handle subscription if response includes it
                if (response.subscription) {
                }
            } else {
                throw new Error('Invalid response: missing buy data');
            }
        } catch (error) {
            
            // Handle WebSocket connection errors specifically
            let errorMessage = error.message || 'An unexpected error occurred';
            if (error.message?.includes('WebSocket not connected') || error.message?.includes('not connected')) {
                errorMessage = 'Connection lost. The app will reconnect automatically. Please try again in a moment.';
            }
            
            toast({
                title: 'Purchase Failed',
                description: errorMessage,
                variant: 'destructive',
                duration: 5000,
            });
        } finally {
            setIsPurchasing(false);
            lastTradeTimeRef.current = Date.now(); // Update last trade time after completion
        }
    };

    const getPayoutPct = (proposal) => {
        if (!proposal || !proposal.payout) return '—';
        const stakeAmount = stakeOrPayout === 'payout' ? proposal.ask_price : stake;
        if (!stakeAmount || stakeAmount === 0) return '—';
        return ((proposal.payout / stakeAmount * 100) - 100).toFixed(2);
    };

    const getPayoutAmount = (proposal) => {
        if (!proposal || !proposal.payout) return '—';
        return proposal.payout.toFixed(2);
    };

    // Sync proposals and button handlers to parent component for mobile footer buttons
    useEffect(() => {
        if (onProposalsSync) {
            const handleCallClick = () => {
                if (!canTrade) {
                    toast({
                        title: 'Login Required',
                        description: 'Please log in with an account that has a non-zero balance to place trades',
                        variant: 'destructive'
                    });
                    return;
                }
                if (!callProposal) {
                    toast({
                        title: 'Proposal Not Available',
                        description: 'Please wait for the proposal to load or check your connection.',
                        variant: 'destructive'
                    });
                    return;
                }
                if (!api || !isConnected) {
                    toast({
                        title: 'Not Connected',
                        description: 'Please wait for connection to be established.',
                        variant: 'destructive'
                    });
                    return;
                }
                handlePurchase('Call', callProposal);
            };

            const handlePutClick = () => {
                if (!canTrade) {
                    toast({
                        title: 'Login Required',
                        description: 'Please log in with an account that has a non-zero balance to place trades',
                        variant: 'destructive'
                    });
                    return;
                }
                if (!putProposal) {
                    toast({
                        title: 'Proposal Not Available',
                        description: 'Please wait for the proposal to load or check your connection.',
                        variant: 'destructive'
                    });
                    return;
                }
                if (!api || !isConnected) {
                    toast({
                        title: 'Not Connected',
                        description: 'Please wait for connection to be established.',
                        variant: 'destructive'
                    });
                    return;
                }
                handlePurchase('Put', putProposal);
            };

            onProposalsSync({
                positive: {
                    label: 'Buy Call',
                    proposal: callProposal,
                    onClick: handleCallClick,
                    disabled: !api || !isConnected || !canTrade || isPurchasing,
                    isLoading: isPurchasing,
                    color: 'bg-teal-500 hover:bg-teal-600',
                    icon: ChevronUp
                },
                negative: {
                    label: 'Buy Put',
                    proposal: putProposal,
                    onClick: handlePutClick,
                    disabled: !api || !isConnected || !canTrade || isPurchasing,
                    isLoading: isPurchasing,
                    color: 'bg-red-500 hover:bg-red-600',
                    icon: ChevronDown
                }
            });
        }
    }, [callProposal, putProposal, isPurchasing, canTrade, api, isConnected, onProposalsSync, handlePurchase, toast]);

    return (
        <div className="p-2 space-y-1.5">
            {!isConnected && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
                    <p className="text-xs text-yellow-800">
                        ⚠️ You need to connect your account to trade
                    </p>
                </div>
            )}

            <Tabs value={durationOrEndtime} onValueChange={setDurationOrEndtime}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="duration">Duration</TabsTrigger>
                    <TabsTrigger value="endtime">End Time</TabsTrigger>
                </TabsList>
                <TabsContent value="duration">
                    <div className="space-y-2">
                        {/* Duration Type Selector */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-between" disabled={isLoading}>
                                    {durationUnit === 't' && 'Ticks'}
                                    {durationUnit === 'm' && 'Minutes'}
                                    {durationUnit === 'h' && 'Hours'}
                                    {durationUnit === 'd' && 'Days'}
                                    <ChevronRightIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-0">
                                <div className="p-1">
                                    <div
                                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                        onClick={() => { setDurationUnit('t'); }}
                                    >
                                        Ticks
                                    </div>
                                    <div
                                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                        onClick={() => { setDurationUnit('m'); }}
                                    >
                                        Minutes
                                    </div>
                                    <div
                                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                        onClick={() => { setDurationUnit('h'); }}
                                    >
                                        Hours
                                    </div>
                                    <div
                                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                        onClick={() => { setDurationUnit('d'); }}
                                    >
                                        Days
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Duration Input */}
                        {durationUnit === 't' ? (
                            <div className="space-y-2">
                                <Slider
                                    value={[durationValue]}
                                    onValueChange={(value) => setDurationValue(value[0])}
                                    min={1}
                                    max={10}
                                    step={1}
                                    disabled={isLoading}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>1</span>
                                    <span>10</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleDurationChange(-1)}
                                    disabled={isLoading}
                                    className="h-8 w-8"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Input
                                    type="number"
                                    value={durationValue}
                                    onChange={e => {
                                        const minValue = 1;
                                        setDurationValue(Math.max(minValue, parseInt(e.target.value) || minValue));
                                    }}
                                    className="flex-1 text-center"
                                    min={1}
                                    disabled={isLoading}
                                />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleDurationChange(1)}
                                    disabled={isLoading}
                                    className="h-8 w-8"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        <p className="text-xs text-gray-500">
                            {durationUnit === 't' && 'Range: 1 - 10 ticks'}
                            {durationUnit === 'm' && 'Range: 1 - 1,440 minutes'}
                            {durationUnit === 'h' && 'Range: 1 - 24 hours'}
                            {durationUnit === 'd' && 'Range: 1 - 365 days'}
                        </p>
                        {durationUnit === 'd' && calculateExpiry && (
                            <div className="text-xs text-gray-600">
                                Expiry: {format(calculateExpiry, "dd MMM yyyy, HH:mm:ss")} GMT +0
                            </div>
                        )}
                    </div>
                </TabsContent>
                <TabsContent value="endtime" className="mt-1.5">
                    <div className="space-y-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start" disabled={isLoading}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {endDate ? format(endDate, "PPP p") : 'Pick expiry time'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={endDate}
                                    onSelect={setEndDate}
                                    initialFocus
                                    disabled={(date) => date < new Date()}
                                />
                            </PopoverContent>
                        </Popover>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                    const newDate = new Date(endDate || getTomorrowDate());
                                    newDate.setDate(newDate.getDate() - 1);
                                    setEndDate(newDate);
                                }}
                                disabled={isLoading}
                                className="h-8 w-8"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex-1 text-center text-sm">
                                {endDate ? format(endDate, "dd MMM yyyy") : 'No date selected'}
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                    const newDate = new Date(endDate || getTomorrowDate());
                                    newDate.setDate(newDate.getDate() + 1);
                                    setEndDate(newDate);
                                }}
                                disabled={isLoading}
                                className="h-8 w-8"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            <div className="space-y-1">
                <Label>Strike Price</Label>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setStrikePrice(currentPrice > 0 ? currentPrice : 0.01)}
                        disabled={isLoading}
                    >
                        Current
                    </Button>
                    <Input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        value={strikePrice}
                        onChange={handleStrikePriceChange}
                        className={cn("flex-1", strikePriceError && "border-red-500")}
                        placeholder="Enter strike price"
                        disabled={isLoading}
                    />
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                        Current: ${currentPrice.toFixed(4)}
                    </span>
                </div>
                {strikePriceError && (
                    <p className="text-xs text-red-500 mt-1">{strikePriceError}</p>
                )}
            </div>

            <Tabs value={stakeOrPayout} onValueChange={setStakeOrPayout}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="stake">Stake</TabsTrigger>
                    <TabsTrigger value="payout">Payout</TabsTrigger>
                </TabsList>
                <TabsContent value="stake" className="mt-1.5">
                    <div>
                        <div className="flex justify-between items-center mb-0.5">
                            <Label className="text-xs">Stake (USD)</Label>
                            {balance && (<span className="text-xs text-gray-500">Balance: ${balance}</span>)}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Button onClick={() => handleStakeChange(-1)} disabled={isLoading}><Minus /></Button>
                            <Input type="number" value={stake} onChange={e => setStake(Math.max(1, parseFloat(e.target.value) || 1))} className="flex-1 text-center" disabled={isLoading} />
                            <Button onClick={() => handleStakeChange(1)} disabled={isLoading}><Plus /></Button>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="payout" className="mt-1.5">
                    <div>
                        <div className="flex justify-between items-center mb-0.5">
                            <Label className="text-xs">Payout (USD)</Label>
                            {balance && (<span className="text-xs text-gray-500">Balance: ${balance}</span>)}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Button onClick={() => handlePayoutChange(-1)} disabled={isLoading}><Minus /></Button>
                            <Input type="number" value={payout} onChange={e => setPayout(Math.max(1, parseFloat(e.target.value) || 1))} className="flex-1 text-center" disabled={isLoading} />
                            <Button onClick={() => handlePayoutChange(1)} disabled={isLoading}><Plus /></Button>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {!hideActionButtons && (
                <div className="border-t border-gray-200 pt-4 flex gap-2">
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-gray-600">
                                Stake {stake.toFixed(2)} USD <ChevronUp className="h-3 w-3 text-teal-500 inline-block ml-1" />
                            </span>
                            <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full p-0 hover:bg-gray-100 flex-shrink-0">
                                <Info className="h-2.5 w-2.5 text-gray-400" />
                            </Button>
                        </div>
                        <StyledTradeButton
                            label="Buy Call"
                            proposal={callProposal}
                            icon={ChevronUp}
                            color="bg-teal-500 hover:bg-teal-600"
                            onClick={() => {
                                if (!canTrade) {
                                    toast({
                                        title: 'Login Required',
                                        description: 'Please log in with an account that has a non-zero balance to place trades',
                                        variant: 'destructive'
                                    });
                                    return;
                                }
                                handlePurchase('Call', callProposal);
                            }}
                            disabled={!callProposal || !api || !isConnected || !canTrade || isPurchasing}
                            isLoading={isPurchasing}
                            getPayoutPct={getPayoutPct}
                            getPayoutAmount={getPayoutAmount}
                        />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-gray-600">
                                Stake {stake.toFixed(2)} USD <ChevronDown className="h-3 w-3 text-red-500 inline-block ml-1" />
                            </span>
                            <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full p-0 hover:bg-gray-100 flex-shrink-0">
                                <Info className="h-2.5 w-2.5 text-gray-400" />
                            </Button>
                        </div>
                        <StyledTradeButton
                            label="Buy Put"
                            proposal={putProposal}
                            icon={ChevronDown}
                            color="bg-red-500 hover:bg-red-600"
                            onClick={() => {
                                if (!canTrade) {
                                    toast({
                                        title: 'Login Required',
                                        description: 'Please log in with an account that has a non-zero balance to place trades',
                                        variant: 'destructive'
                                    });
                                    return;
                                }
                                handlePurchase('Put', putProposal);
                            }}
                            disabled={!putProposal || !api || !isConnected || !canTrade || isPurchasing}
                            isLoading={isPurchasing}
                            getPayoutPct={getPayoutPct}
                            getPayoutAmount={getPayoutAmount}
                        />
                    </div>
                </div>
            )}

            {!hidePrediction && (
                <div className="mt-4 border-t pt-2">
                    <PredictionPanel
                        symbol={selectedMarket?.symbol}
                        tradeType={tradeType}
                        aiPrediction={aiPrediction ? {
                            prediction: aiPrediction.direction?.toLowerCase() === 'rise' ? 'call' : aiPrediction.prediction || 'call',
                            confidence: typeof aiPrediction.confidence === 'number' && aiPrediction.confidence > 1 
                                ? aiPrediction.confidence / 100 
                                : aiPrediction.confidence || 0.65
                        } : { prediction: 'call', confidence: 0.65 }}
                        mode="compact"
                    />
                </div>
            )}
        </div>
    );
};

export default CallPutExecution;