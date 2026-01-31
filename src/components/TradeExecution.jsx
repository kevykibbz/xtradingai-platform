import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Info, Minus, Plus, Calendar as CalendarIcon, ChevronUp, ChevronDown, Target, X, Loader2, BarChart3, ChevronLeft, ChevronRight, ArrowRight, TrendingUp, TrendingDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from './ui/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { cn, isValidAuthToken, isUserAuthenticated, isAPIToken, getUserOAuthToken } from '@/lib/utils';
import PredictionPanel from './PredictionPanel';
import { useDerivAPI } from '@/contexts/DerivContext';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setTradeType as setTradeTypeRedux } from '@/store/slices/tradeTypeSlice';
import { useTradeTypeSync } from '@/hooks/useTradeTypeSync';
import CallPutExecution from './CallPutExecution';
import TurbosExecution from './TurbosExecution';
import { getActionButtonLabels } from './MobileTradeTypeCarousel';

// Helper function to format barrier value for API (max 2 decimal places)
// The Deriv API requires barrier offsets to have no more than 2 decimal places
const formatBarrierValue = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  // Round to 2 decimal places and format
  const rounded = Math.round(value * 100) / 100;
  // Convert to string and remove trailing zeros
  const str = rounded.toString();
  if (!str.includes('.')) return str;
  return str.replace(/\.?0+$/, '') || '0';
};

// Shared styled trade button component for all trade types
export const StyledTradeButton = React.memo(({ label, proposal, icon: Icon, color, onClick, disabled, isLoading: buttonLoading, getPayoutPct, getPayoutAmount }) => {
  // Memoize payout values to prevent layout shifts from frequent updates
  const payoutAmount = useMemo(() => {
    if (!getPayoutAmount || !proposal) return '—';
    const amount = getPayoutAmount(proposal);
    // Round to 2 decimal places to prevent micro-updates
    if (amount === '—') return amount;
    const num = parseFloat(amount);
    return isNaN(num) ? '—' : num.toFixed(2);
  }, [proposal?.payout, getPayoutAmount]);

  const payoutPct = useMemo(() => {
    if (!getPayoutPct || !proposal) return '—';
    const pct = getPayoutPct(proposal);
    // Round to 1 decimal place to prevent micro-updates
    if (pct === '—') return pct;
    const num = parseFloat(pct);
    return isNaN(num) ? '—' : num.toFixed(1);
  }, [proposal?.payout, getPayoutPct]);

  // Determine if button should appear active (has proposal) or waiting (no proposal but not disabled)
  const hasProposal = !!proposal;
  const isActuallyDisabled = disabled || buttonLoading;
  const isWaitingForProposal = !hasProposal && !isActuallyDisabled;

  return (
    <div className="min-h-[60px]">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs text-gray-600">
          Payout <span className="font-bold text-gray-900 tabular-nums">{payoutAmount} USD</span>
        </span>
        <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full p-0 hover:bg-gray-100 flex-shrink-0">
          <Info className="h-2.5 w-2.5 text-gray-400" />
        </Button>
      </div>
      <button
        className={`w-full ${color} text-white h-10 text-sm font-medium relative flex items-center justify-between px-3 transition-all duration-150 ${
          isActuallyDisabled 
            ? 'opacity-50 cursor-not-allowed' 
            : isWaitingForProposal 
              ? 'opacity-75 hover:opacity-90 cursor-pointer' 
              : 'opacity-100 hover:opacity-90 cursor-pointer'
        }`}
        onClick={onClick}
        disabled={isActuallyDisabled}
        style={{
          clipPath: 'polygon(0 0, calc(100% - 40px) 0, 100% 50%, calc(100% - 40px) 100%, 0 100%)'
        }}
      >
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {buttonLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : typeof Icon === 'function' ? (
            Icon()
          ) : (
            <Icon className="h-4 w-4" />
          )}
          <span className="font-semibold text-xs whitespace-nowrap">{label}</span>
        </div>
        <div className={`flex items-center px-2 py-1 rounded flex-shrink-0 ${
          hasProposal ? 'bg-white/20' : 'bg-white/10'
        }`} style={{ marginRight: '-8px', minWidth: '40px' }}>
          <span className="text-xs font-bold tabular-nums">{payoutPct}%</span>
        </div>
      </button>
    </div>
  );
});

// Helper function to check if user is logged in with valid token (not default demo token)
const isUserLoggedIn = () => {
  try {
    return isUserAuthenticated();
  } catch {
    // Ignore parse errors
    return false;
  }
};

// Import shared trade execution utilities
import { 
  getSelectedAccountFromStorage, 
  validateTradePreconditions, 
  formatTradeErrorMessage,
  saveWalletInfo,
  handleSuccessfulTrade,
  ensureUserAccountAuthenticated
} from '@/utils/tradeExecutionUtils';

// Helper function to log token and wallet information when trade button is clicked
const logTradeButtonClick = (user, balance, direction = '', proposalId = '') => {
  const selectedAccount = getSelectedAccountFromStorage();
  const storedUser = (() => {
    try {
      const stored = localStorage.getItem('deriv_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();
  
  console.log('🚀 [TRADE BUTTON CLICKED] Token and Wallet Information:', {
    'Token (from user state)': user?.token ? `${user.token.substring(0, 30)}...` : 'No token in user state',
    'Token (from localStorage)': storedUser?.token ? `${storedUser.token.substring(0, 30)}...` : 'No token in localStorage',
    'Token (full from user)': user?.token || 'No token',
    'Token (full from localStorage)': storedUser?.token || 'No token',
    'Wallet/Account Info': {
      'Selected Account (loginid)': selectedAccount?.loginid || user?.loginid || 'No loginid',
      'Selected Account (balance)': selectedAccount?.balance ?? user?.balance ?? balance ?? 0,
      'Selected Account (currency)': selectedAccount?.currency || user?.currency || 'USD',
      'User State (loginid)': user?.loginid || 'No loginid',
      'User State (balance)': user?.balance || 0,
      'User State (currency)': user?.currency || 'USD',
    },
    'Account Match': selectedAccount?.loginid === user?.loginid ? '✅ Match' : '❌ Mismatch',
    'Direction': direction || 'N/A',
    'Proposal ID': proposalId || 'No proposal'
  });
};

const RiseFallExecution = ({ selectedMarket, tradeType = 'rise_fall', aiPrediction, hidePrediction = false, onTradePlaced, openPositions, onBarrierChange, hideActionButtons = false, onProposalsSync }) => {
  // Clear barriers for trade types that don't use them
  useEffect(() => {
    if (onBarrierChange) {
      onBarrierChange([]);
    }
  }, [onBarrierChange]);
  const [stake, setStake] = useState(10);
  const [payout, setPayout] = useState(10);
  const [stakeOrPayout, setStakeOrPayout] = useState('stake'); // 'stake' or 'payout'
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
  const [durationUnit, setDurationUnit] = useState('t'); // 't' for ticks, 's' for seconds, 'm' for minutes, 'h' for hours, 'd' for days
  const [allowEquals, setAllowEquals] = useState(false);
  const [callProposal, setCallProposal] = useState(null);
  const [putProposal, setPutProposal] = useState(null);
  
  // Sync trade type with Redux and trigger proposal fetching on change
  const reduxTradeType = useTradeTypeSync(tradeType, (newType) => {
    // Reset proposals when trade type changes via Redux
    setCallProposal(null);
    setPutProposal(null);
    setIsLoading(true); // Set loading to true immediately to keep buttons enabled during fetch
    prevTradeTypeRef.current = null; // Reset to force fetch effect to detect the change
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const lastTradeTimeRef = useRef(0); // Track last trade attempt time for cooldown
  const { toast } = useToast();
  const { api, connected: isConnected, user, deductBalance, requestBalanceUpdate, login, updateUser } = useDerivAPI();
  // CRITICAL: Use selected account balance from localStorage (most up-to-date for selected account)
  // This ensures we use the balance for the selected account, not the first account
  const selectedAccount = getSelectedAccountFromStorage();
  const balance = selectedAccount?.balance ?? user?.balance ?? 0;
  
  const prevTradeTypeRef = useRef(null);
  const isMountedRef = useRef(false);
  const buttonDisableTimeoutRef = useRef(null); // Track timeout for button re-enable after trade

  // Reset proposals when component mounts or tradeType changes
  useEffect(() => {
    // Reset proposals when component mounts or tradeType changes to ensure fresh fetch
    setCallProposal(null);
    setPutProposal(null);
    setIsLoading(true); // Set loading to true immediately to keep buttons enabled during fetch
    // CRITICAL: Reset isPurchasing when trade type changes to re-enable buttons
    setIsPurchasing(false);
    // Clear any pending button disable timeout
    if (buttonDisableTimeoutRef.current) {
      clearTimeout(buttonDisableTimeoutRef.current);
      buttonDisableTimeoutRef.current = null;
    }
    // Reset prevTradeTypeRef to force fetch effect to detect the change
    prevTradeTypeRef.current = null;
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      // Cleanup timeout on unmount
      if (buttonDisableTimeoutRef.current) {
        clearTimeout(buttonDisableTimeoutRef.current);
      }
    };
  }, [tradeType]); // Reset when tradeType changes

  const fetchProposal = useCallback(async (contractType) => {
    const amount = stakeOrPayout === 'payout' ? payout : stake;
    if (!selectedMarket?.symbol || amount <= 0 || !api || !isConnected) {
      return null;
    }

    // Build proposal request according to Deriv API documentation
    // proposal: Must be 1
    // amount: Proposed contract payout or stake
    // basis: 'payout' or 'stake'
    // contract_type: The proposed contract type
    // currency: Account holder's currency
    // symbol: The short symbol name
    // duration/duration_unit OR date_expiry: Either duration or date_expiry is required
    // subscribe: Optional, 1 to stream prices
    const baseParams = {
      proposal: 1,
      subscribe: 1, // Optional: 1 to initiate realtime stream of prices
      amount: amount,
      basis: stakeOrPayout, // 'payout' or 'stake'
      contract_type: contractType,
      currency: 'USD', // Should match account currency
      symbol: selectedMarket.symbol,
    };

    // Either date_expiry or duration is required
    if (durationOrEndtime === 'duration') {
      baseParams.duration = durationValue;
      baseParams.duration_unit = durationUnit; // 's', 'm', 'h', 'd', 't'
    } else if (endDate) {
      baseParams.date_expiry = Math.floor(endDate.getTime() / 1000);
      // Don't include duration when using date_expiry
    }


    try {
      const response = await api.send(baseParams);
      
      // Handle error response
      if (response.error) {
        const errorMsg = response.error.message || response.error.code || 'Failed to get proposal';
        toast({
          title: 'Proposal Error',
          description: errorMsg,
          variant: 'destructive'
        });
        return null;
      }
      
      // Validate response structure according to API documentation
      // Response should have: proposal, subscription (optional), echo_req, msg_type, req_id (optional)
      if (response.msg_type !== 'proposal') {
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
      // Don't log expected errors (WebSocket not connected, AlreadySubscribed, WrongResponse)
      const errorMessage = error?.message || error?.toString() || '';
      const errorCode = error?.code;
      const isExpectedError = 
        errorMessage.includes('WebSocket not connected') || 
        errorCode === 'AlreadySubscribed' ||
        errorCode === 'WrongResponse' ||
        errorMessage.includes('WrongResponse');
      
      if (!isExpectedError) {
        toast({
          description: errorMessage || 'Failed to fetch proposal',
          variant: 'destructive'
        });
      }
      return null;
    }
  }, [selectedMarket, stake, payout, stakeOrPayout, api, isConnected, durationOrEndtime, durationValue, durationUnit, endDate, toast]);

  // Function to refresh proposals - can be called after successful trades
  const refreshProposals = useCallback(async (showLoading = false) => {
    if (!selectedMarket?.symbol || !api || !isConnected) return;
    
    if (showLoading) {
      setIsLoading(true);
    }
    
    try {
      const callType = allowEquals ? 'CALLE' : 'CALL';
      const putType = allowEquals ? 'PUTE' : 'PUT';
      
      // Fetch both proposals, but handle partial failures gracefully
      // CRITICAL: Use Promise.allSettled to ensure we don't lose proposals if one fails
      const results = await Promise.allSettled([
        fetchProposal(callType),
        fetchProposal(putType),
      ]);
      
      // Update proposals only if they succeeded and component is still mounted
      // CRITICAL: Only update if we got a valid proposal - keep existing proposals if fetch fails
      if (isMountedRef.current) {
        if (results[0].status === 'fulfilled' && results[0].value) {
          setCallProposal(results[0].value);
        }
        // Don't clear callProposal if fetch failed - keep existing one
        if (results[1].status === 'fulfilled' && results[1].value) {
          setPutProposal(results[1].value);
        }
        // Don't clear putProposal if fetch failed - keep existing one
      }
      
      // If both failed, log error
      if (results[0].status === 'rejected' && results[1].status === 'rejected') {
        const errorMessage = results[0].reason?.message || results[1].reason?.message || '';
        const errorCode = results[0].reason?.code || results[1].reason?.code;
        const isExpectedError = 
          errorMessage.includes('WebSocket not connected') || 
          errorMessage.includes('AlreadySubscribed') ||
          errorMessage.includes('WrongResponse') ||
          errorCode === 'RateLimit' ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('RateLimit');
        if (!isExpectedError) {
        } else {
        }
      }
    } catch (error) {
      // Don't log expected errors (WebSocket not connected, AlreadySubscribed, WrongResponse, RateLimit)
      const errorMessage = error?.message || error?.toString() || '';
      const errorCode = error?.code;
      const isExpectedError = 
        errorMessage.includes('WebSocket not connected') || 
        errorCode === 'AlreadySubscribed' ||
        errorCode === 'WrongResponse' ||
        errorCode === 'RateLimit' ||
        errorMessage.includes('WrongResponse') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('RateLimit');
      if (!isExpectedError) {
      } else {
      }
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [fetchProposal, allowEquals, selectedMarket?.symbol, api, isConnected]);

  useEffect(() => {
    // Use Redux trade type if available, otherwise use prop tradeType
    const effectiveTradeType = reduxTradeType || tradeType;
    const tradeTypeChanged = prevTradeTypeRef.current !== null && prevTradeTypeRef.current !== effectiveTradeType;
    const isInitialMount = prevTradeTypeRef.current === undefined || prevTradeTypeRef.current === null;
    prevTradeTypeRef.current = effectiveTradeType;
    
    const fetchProposals = async () => {
      if (!selectedMarket?.symbol || !api || !isConnected) {
        return;
      }
      
      setIsLoading(true);
      try {
        const callType = allowEquals ? 'CALLE' : 'CALL';
        const putType = allowEquals ? 'PUTE' : 'PUT';
        
        const [callRes, putRes] = await Promise.all([
          fetchProposal(callType),
          fetchProposal(putType),
        ]);
        
        // CRITICAL: Only update proposals if we got valid ones - preserve existing proposals if fetch fails
        // This prevents buttons from being disabled during refresh
        // Only update if component is still mounted
        if (isMountedRef.current) {
          // Only update if we got a valid proposal - keep existing one if fetch returned null
          if (callRes) {
            setCallProposal(callRes);
          }
          if (putRes) {
            setPutProposal(putRes);
          }
          // Don't clear proposals if fetch failed - keep existing ones
        }
      } catch (error) {
        // Don't log expected errors (WebSocket not connected, AlreadySubscribed, WrongResponse, RateLimit)
        const errorMessage = error?.message || error?.toString() || '';
        const errorCode = error?.code;
        const isExpectedError = 
          errorMessage.includes('WebSocket not connected') || 
          errorCode === 'AlreadySubscribed' ||
          errorCode === 'WrongResponse' ||
          errorCode === 'RateLimit' ||
          errorMessage.includes('WrongResponse') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('RateLimit');
        if (!isExpectedError) {
          console.error('[RiseFallExecution] Error fetching proposals:', error);
        }
        // CRITICAL: Don't clear proposals on error - keep existing ones to prevent button disabling
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    // Fetch immediately on mount or trade type change, debounce only for parameter changes
    if (isInitialMount || tradeTypeChanged) {
      fetchProposals();
    } else {
      // Debounce proposal fetching to prevent rate limit errors - wait 500ms after last change
      const timeoutId = setTimeout(fetchProposals, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [fetchProposal, allowEquals, stakeOrPayout, stake, payout, selectedMarket?.symbol, api, isConnected, tradeType, reduxTradeType, durationValue, durationUnit, durationOrEndtime, endDate]);

  // Monitor proposals and auto-refresh if they become null (e.g., after closing positions)
  // CRITICAL: Only refresh if BOTH proposals are null AND we're not already loading
  // This prevents unnecessary refreshes that could cause buttons to flicker
  useEffect(() => {
    if (!api || !isConnected || !selectedMarket?.symbol || isLoading) return;
    
    // Only refresh if BOTH proposals are null (not just one)
    // This prevents disabling buttons when one proposal is temporarily null during refresh
    if (!callProposal && !putProposal) {
      const timeoutId = setTimeout(() => {
        // Double-check conditions before refreshing
        if (!callProposal && !putProposal && api && isConnected && !isLoading) {
          refreshProposals(false);
        }
      }, 1000); // Increased delay to prevent rapid refreshes
      
      return () => clearTimeout(timeoutId);
    }
  }, [callProposal, putProposal, api, isConnected, selectedMarket?.symbol, isLoading, refreshProposals]);

  const handleStakeChange = (amount) => setStake(prev => Math.max(1, prev + amount));
  const handlePayoutChange = (amount) => setPayout(prev => Math.max(1, prev + amount));
  const handleDurationChange = (amount) => {
    const minValue = durationUnit === 't' ? 1 : (durationUnit === 'm' ? 2 : 1);
    setDurationValue(prev => Math.max(minValue, prev + amount));
  };

  const handlePurchase = async (direction, proposal) => {
    // Log token and wallet information when trade button is clicked
    logTradeButtonClick(user, balance, direction, proposal?.id);
    
    // Validate trade preconditions using shared utility
    const validation = validateTradePreconditions({
      isPurchasing,
      lastTradeTime: lastTradeTimeRef.current,
      api,
      isConnected,
      user,
      proposal,
      stake,
      toast,
    });

    if (!validation.isValid) {
      return; // Error already shown by validateTradePreconditions
    }

    const { selectedAccount, currentAccountBalance, walletLoginid, walletAmount, walletToken } = validation;

    // CRITICAL: Get balance from selected account in user.accounts array, not user.balance
    // user.balance is from authorize response (primary account), not the selected account
    let actualSelectedBalance = currentAccountBalance;
    if (selectedAccount?.loginid && user?.accounts) {
      const accountInList = user.accounts.find(acc => acc.loginid === selectedAccount.loginid);
      if (accountInList && accountInList.balance !== undefined && accountInList.balance !== null) {
        const accBalance = parseFloat(accountInList.balance);
        if (!isNaN(accBalance)) {
          actualSelectedBalance = accBalance;
          console.log('[TradeExecution] Using balance from accounts array for selected account:', {
            loginid: selectedAccount.loginid,
            balance: actualSelectedBalance
          });
        }
      }
    }
    
    // CRITICAL: Verify the selected account has sufficient balance BEFORE placing trade
    // The API will check the primary account's balance, but we need to ensure selected account has balance
    // Get buyPrice from proposal (will be set later, but we need it for validation)
    const estimatedBuyPrice = proposal?.ask_price || proposal?.payout || stake;
    
    // CRITICAL: Check if primary account (user.balance) is 0 but selected account has balance
    // This indicates the API will check the wrong account
    if (user?.balance === 0 && actualSelectedBalance >= estimatedBuyPrice && selectedAccount?.loginid !== user?.loginid) {
      console.error('[TradeExecution] CRITICAL: Primary account has 0 balance but selected account has balance:', {
        primaryAccount: user?.loginid,
        primaryBalance: user?.balance,
        selectedAccount: selectedAccount?.loginid,
        selectedBalance: actualSelectedBalance,
        required: estimatedBuyPrice
      });
      
      toast({
        title: '⚠️ Account Switch Required',
        description: `The WebSocket is using account ${user?.loginid || 'unknown'} (balance: 0.00 USD), but you selected account ${selectedAccount?.loginid || 'unknown'} (balance: ${actualSelectedBalance.toFixed(2)} USD). Please refresh the page to complete the account switch, then try again.`,
        variant: 'destructive',
        duration: 8000,
      });
      
      setIsPurchasing(false);
      return;
    }
    
    if (actualSelectedBalance < estimatedBuyPrice) {
      console.error('[TradeExecution] Selected account has insufficient balance:', {
        loginid: selectedAccount?.loginid,
        balance: actualSelectedBalance,
        required: estimatedBuyPrice
      });
      
      toast({
        title: 'Insufficient Balance',
        description: `Selected account (${selectedAccount?.loginid || 'unknown'}) has ${actualSelectedBalance.toFixed(2)} USD, but ${estimatedBuyPrice.toFixed(2)} USD is required.`,
        variant: 'destructive',
        duration: 5000,
      });
      
      setIsPurchasing(false);
      return;
    }
    
    console.log('[TradeExecution] User:', user, user?.loginid, selectedAccount?.balance, currentAccountBalance, 'Actual selected balance:', actualSelectedBalance);

    setIsPurchasing(true);

    // Save wallet information using shared utility
    saveWalletInfo({ loginid: walletLoginid, amount: walletAmount, token: walletToken });

    try {
      // Always fetch a fresh proposal for each trade to avoid InvalidContractProposal
      // Each proposal ID can only be used once, so we need a new one for each trade
      const contractType = direction === 'Rise' ? (allowEquals ? 'CALLE' : 'CALL') : (allowEquals ? 'PUTE' : 'PUT');
      let currentProposal = proposal;
      
      // Disable trade button while fetching fresh proposal
      setIsLoading(true);
      
      // Fetch fresh proposal before purchase to ensure unique proposal ID
      // CRITICAL: Use only current token from user state, not localStorage
      try {
        const freshProposal = await fetchProposal(contractType);
        if (freshProposal && freshProposal.id) {
          currentProposal = freshProposal;
        } else {
        }
      } catch (fetchError) {
        // Continue with existing proposal if fetch fails
      } finally {
        // Re-enable button after short delay
        setTimeout(() => {
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        }, 300);
      }
      
      // Validate proposal before sending
      if (!currentProposal.id) {
        throw new Error('Invalid proposal: missing proposal ID');
      }
      
      const buyPrice = currentProposal.ask_price || currentProposal.payout;
      if (!buyPrice || buyPrice <= 0) {
        throw new Error('Invalid proposal: missing or invalid price');
      }

      // CRITICAL: Verify account match before placing trade
      // The Deriv API uses the account from authorize response for balance checks, not the selected account
      // Even if user.loginid matches selectedAccount.loginid, the WebSocket might still use the primary account
      // We need to ensure the selected account's balance is available and sufficient
      if (selectedAccount && selectedAccount.loginid && user?.loginid && user.loginid !== selectedAccount.loginid) {
        console.warn('[TradeExecution] Account mismatch detected - attempting to fix:', {
          selectedAccountLoginid: selectedAccount.loginid,
          selectedAccountBalance: selectedAccount.balance,
          authenticatedLoginid: user.loginid,
          authenticatedBalance: user.balance
        });
        
        // CRITICAL: Immediately update user state with selected account loginid
        // This ensures the WebSocket context uses the correct account
        if (updateUser) {
          updateUser({
            ...user,
            loginid: selectedAccount.loginid, // CRITICAL: Set selected loginid immediately
            balance: selectedAccount.balance || user.balance,
            currency: selectedAccount.currency || user.currency
          });
        }
        
        // Update localStorage with selected loginid to ensure it's preserved
        try {
          const currentStored = localStorage.getItem('deriv_user');
          let storedData = {};
          if (currentStored) {
            try {
              storedData = JSON.parse(currentStored);
            } catch (e) {
              // Ignore parse errors
            }
          }
          localStorage.setItem('deriv_user', JSON.stringify({
            ...storedData,
            token: user.token,
            loginid: selectedAccount.loginid, // CRITICAL: Set selected loginid
            currency: selectedAccount.currency || storedData.currency || 'USD'
          }));
          
          // Re-authenticate to apply the selected account to WebSocket
          // The login function will now use the loginid from localStorage
          if (user?.token && login) {
            console.log('[TradeExecution] Re-authenticating WebSocket with selected account loginid...');
            // Wait for re-authentication to complete
            await login(user.token);
            
            // Wait for state to sync and verify account is correct
            // Poll up to 3 times (1.5 seconds total) to check if account is now synchronized
            let retries = 0;
            let accountSynced = false;
            while (retries < 3 && !accountSynced) {
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Re-check user state after sync
              // Note: We can't directly check user.loginid here as it's from props,
              // but the updateUser call should have updated it. Check localStorage instead.
              const storedUser = localStorage.getItem('deriv_user');
              if (storedUser) {
                try {
                  const parsed = JSON.parse(storedUser);
                  if (parsed.loginid === selectedAccount.loginid) {
                    accountSynced = true;
                    console.log('[TradeExecution] Account synchronized successfully:', parsed.loginid);
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
              retries++;
            }
            
            if (!accountSynced) {
              console.warn('[TradeExecution] Account sync verification failed, but proceeding with account parameter');
            }
            
            console.log('[TradeExecution] Re-authentication completed, proceeding with trade');
            // Continue with trade - we'll use account parameter in buy request
          } else {
            console.warn('[TradeExecution] No token or login function available for re-authentication');
          }
        } catch (e) {
          console.error('[TradeExecution] Error synchronizing account:', e);
          toast({
            title: 'Account Not Ready',
            description: `Failed to synchronize account. Please wait a moment and try again.`,
            variant: 'destructive',
            duration: 5000,
          });
          setIsPurchasing(false);
          return;
        }
      }
      
      // CRITICAL: The Deriv API WebSocket uses the account from authorize response for balance checks
      // The authorize response returns the primary account (e.g., CR9984077), not the selected account (e.g., VRTC14440048)
      // Even if user.loginid matches selectedAccount.loginid, the API still checks the primary account's balance
      // We need to verify the selected account has sufficient balance from accounts array or liveBalances
      const finalSelectedAccount = getSelectedAccountFromStorage();
      
      // Get balance from multiple sources, prioritizing accounts array
      let selectedAccountBalance = finalSelectedAccount?.balance ?? 0;
      
      // Try to get balance from user.accounts array (most reliable)
      if (finalSelectedAccount?.loginid && user?.accounts) {
        const accountInList = user.accounts.find(acc => acc.loginid === finalSelectedAccount.loginid);
        if (accountInList && accountInList.balance !== undefined && accountInList.balance !== null) {
          const accBalance = parseFloat(accountInList.balance);
          if (!isNaN(accBalance) && accBalance > 0) {
            selectedAccountBalance = accBalance;
            console.log('[TradeExecution] Using balance from accounts array:', {
              loginid: finalSelectedAccount.loginid,
              balance: selectedAccountBalance
            });
          }
        }
      }
      
      // Fallback to liveBalances
      if (selectedAccountBalance <= 0 && finalSelectedAccount?.loginid && user?.liveBalances?.[finalSelectedAccount.loginid]) {
        selectedAccountBalance = user.liveBalances[finalSelectedAccount.loginid].balance || 0;
      }
      
      // Last fallback to user.balance (but this is from primary account, not selected)
      if (selectedAccountBalance <= 0) {
        selectedAccountBalance = user?.balance ?? 0;
      }
      
      // Check if selected account has sufficient balance
      if (finalSelectedAccount && finalSelectedAccount.loginid && selectedAccountBalance < buyPrice) {
        console.error('[TradeExecution] Selected account has insufficient balance:', {
          selected: finalSelectedAccount.loginid,
          balance: selectedAccountBalance,
          required: buyPrice
        });
        
        toast({
          title: 'Insufficient Balance',
          description: `Selected account (${finalSelectedAccount.loginid}) has ${selectedAccountBalance.toFixed(2)} USD, but ${buyPrice.toFixed(2)} USD is required.`,
          variant: 'destructive',
          duration: 5000,
        });
        
        setIsPurchasing(false);
        return;
      }
      
      // If accounts don't match, warn but allow trade if selected account has balance
      if (finalSelectedAccount && finalSelectedAccount.loginid && user?.loginid && user.loginid !== finalSelectedAccount.loginid) {
        console.warn('[TradeExecution] Account mismatch - API will check different account, but selected account has balance:', {
          selected: finalSelectedAccount.loginid,
          selectedBalance: selectedAccountBalance,
          authenticated: user.loginid,
          authenticatedBalance: user.balance
        });
        
        // Don't block the trade - the API will check the balance and return an error if insufficient
        // But we've already checked that the selected account has sufficient balance
      }
      
      // CRITICAL: The Deriv API WebSocket uses the account from authorize response for balance checks
      // The authorize response returns the primary account (CR9984077), not the selected account (VRTC14440048)
      // We need to ensure the WebSocket knows about the selected account's balance before placing the trade
      // Request balance for the selected account to update the WebSocket context
      if (selectedAccount?.loginid && api && isConnected) {
        try {
          console.log('[TradeExecution] Requesting balance for selected account before trade:', selectedAccount.loginid);
          // Request balance for the selected account - this should update the WebSocket context
          // Note: The balance response will come via WebSocket message, not as a direct response
          await api.send({ balance: 1, account: selectedAccount.loginid });
          
          // Wait for balance update to be processed by WebSocket
          // The balance update will be handled by DerivContext's balance message handler
          await new Promise(resolve => setTimeout(resolve, 800));
          
          // Check if the selected account's balance is available in user.liveBalances
          const selectedAccountBalance = user?.liveBalances?.[selectedAccount.loginid]?.balance;
          if (selectedAccountBalance !== undefined && selectedAccountBalance !== null) {
            const balanceNum = parseFloat(selectedAccountBalance);
            console.log('[TradeExecution] Selected account balance from liveBalances:', {
              loginid: selectedAccount.loginid,
              balance: balanceNum,
              required: buyPrice
            });
            
            if (balanceNum < buyPrice) {
              console.warn('[TradeExecution] Selected account balance is insufficient:', {
                balance: balanceNum,
                required: buyPrice
              });
              // Still proceed - the API will check the balance anyway
            }
          } else {
            console.warn('[TradeExecution] Selected account balance not found in liveBalances, using stored balance');
          }
        } catch (balanceError) {
          console.warn('[TradeExecution] Error requesting balance for selected account:', balanceError);
          // Continue anyway - the trade might still work
        }
      }
      
      // CRITICAL: Build buy request with explicit account parameter
      // This ensures the trade is placed on the user's selected account, not API owner account
      const buyRequest = {
        buy: currentProposal.id,
        price: buyPrice,
      };
      
      // CRITICAL: Add account parameter if we have a selected account
      // This explicitly tells the API which account to use for the trade
      if (selectedAccount?.loginid && user?.loginid && selectedAccount.loginid === user.loginid) {
        // Only add account parameter if it matches authenticated account
        // This prevents accidentally using wrong account
        buyRequest.account = selectedAccount.loginid;
        console.log('[TradeExecution] Adding account parameter to buy request:', selectedAccount.loginid);
      }
      
      // CRITICAL: Ensure we're using user's OAuth token, not API token
      // This prevents trades from being placed on API owner's account
      const canTrade = await ensureUserAccountAuthenticated({ user, login, toast });
      if (!canTrade) {
        return; // Error already shown by ensureUserAccountAuthenticated
      }
      
      // CRITICAL: Final verification - check that user.token is NOT an API token
      // This is a safety check to prevent trades on API owner accounts
      const userOAuthToken = getUserOAuthToken();
      if (user?.token && isAPIToken(user.token) && userOAuthToken) {
        console.error('[TradeExecution] CRITICAL: User state still shows API token! Blocking trade to protect API owner account.');
        toast({
          title: 'Account Error',
          description: 'Please refresh the page and log in again. Cannot place trades with API owner account.',
          variant: 'destructive'
        });
        return;
      }
      
      // CRITICAL: Verify localStorage also has user OAuth token, not API token
      // This ensures WebSocket is authenticated with user's account
      try {
        const stored = localStorage.getItem('deriv_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.token && isAPIToken(parsed.token) && userOAuthToken) {
            console.error('[TradeExecution] CRITICAL: localStorage still has API token! WebSocket might be authenticated with API owner account. Blocking trade.');
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
      
      // CRITICAL: Verify selected account matches authenticated account
      // This ensures we're trading on the correct account
      if (selectedAccount?.loginid && user?.loginid && selectedAccount.loginid !== user.loginid) {
        console.error('[TradeExecution] CRITICAL: Selected account does not match authenticated account!', {
          selected: selectedAccount.loginid,
          authenticated: user.loginid
        });
        toast({
          title: 'Account Mismatch',
          description: `Selected account (${selectedAccount.loginid}) does not match authenticated account (${user.loginid}). Please wait for account switch to complete.`,
          variant: 'destructive'
        });
        return;
      }
      
      // CRITICAL: Log selected account info before placing trade
      // Use actual selected balance from accounts array, not user.balance
      const balanceToUse = actualSelectedBalance || currentAccountBalance;
      console.log('[TradeExecution] Placing trade with:', {
        selectedAccountLoginid: selectedAccount?.loginid,
        authenticatedLoginid: user?.loginid,
        balance: balanceToUse,
        userBalance: user?.balance, // This is from authorize response (primary account)
        selectedAccountBalance: selectedAccount?.balance,
        balanceFromAccountsArray: user?.accounts?.find(acc => acc.loginid === selectedAccount?.loginid)?.balance,
        token: user?.token ? (isAPIToken(user.token) ? 'API TOKEN (BLOCKED)' : `${user.token.substring(0, 20)}...`) : 'no token',
        isAPIToken: user?.token ? isAPIToken(user.token) : false
      });

      const response = await api.send(buyRequest);

      // CRITICAL: Log the full response for debugging
      console.log('[TradeExecution] API Response:', {
        hasError: !!response.error,
        errorCode: response.error?.code,
        errorMessage: response.error?.message,
        hasBuy: !!response.buy,
        buyContractId: response.buy?.contract_id,
        selectedAccount: selectedAccount?.loginid,
        selectedBalance: actualSelectedBalance || currentAccountBalance,
        authenticatedAccount: user?.loginid,
        authenticatedBalance: user?.balance
      });

      // Check for API errors
      if (response.error) {
        const errorCode = response.error.code;
        const errorMessage = response.error.message || 'Purchase failed';
        
        // CRITICAL: Log full error details for debugging
        console.error('[TradeExecution] API Error Details:', {
          code: errorCode,
          message: errorMessage,
          fullError: response.error,
          selectedAccount: selectedAccount?.loginid,
          selectedBalance: actualSelectedBalance || currentAccountBalance,
          authenticatedAccount: user?.loginid,
          authenticatedBalance: user?.balance,
          accountsArray: user?.accounts?.map(acc => ({ loginid: acc.loginid, balance: acc.balance }))
        });
        
        // Handle InvalidContractProposal and InvalidSellContractProposal - fetch fresh proposal and retry
        if (errorCode === 'InvalidContractProposal' || errorCode === 'InvalidSellContractProposal') {
          
          try {
            const freshProposal = await fetchProposal(contractType);
            if (freshProposal && freshProposal.id) {
              // Retry purchase with fresh proposal
              const retryResponse = await api.send({
                buy: freshProposal.id,
                price: freshProposal.ask_price || freshProposal.payout,
              });
              
              if (retryResponse.error) {
                const retryError = new Error(retryResponse.error.message || 'Purchase failed after refreshing proposal');
                retryError.code = retryResponse.error.code;
                retryError.apiError = retryResponse.error;
                throw retryError;
              }
              
              if (retryResponse.buy) {
                const contractId = retryResponse.buy.contract_id;
                const buyPrice = retryResponse.buy.buy_price;
                const payout = retryResponse.buy.payout;
                
                // CRITICAL: Deduct balance immediately after successful trade
                // Use selectedAccount loginid if available, otherwise use user loginid
                const accountLoginid = selectedAccount?.loginid || user?.loginid;
                // Validate buyPrice is a valid number before deducting
                if (deductBalance && buyPrice && typeof buyPrice === 'number' && !isNaN(buyPrice) && buyPrice > 0 && accountLoginid) {
                  deductBalance(buyPrice, accountLoginid);
                } else if (deductBalance && (!buyPrice || isNaN(buyPrice) || buyPrice <= 0)) {
                  console.error('[TradeExecution] Cannot deduct balance: buyPrice is invalid', { buyPrice, contractId: response.buy?.contract_id });
                }
                
                // Request balance update from WebSocket to sync with server
                if (requestBalanceUpdate && accountLoginid) {
                  requestBalanceUpdate(accountLoginid);
                }
                
                toast({
                  title: `✅ ${direction} Contract Purchased`,
                  description: `Contract ID: ${contractId}${payout ? ` | Payout: $${payout.toFixed(2)}` : ''}`,
                });
                
                // Call onTradePlaced callback if provided - CRITICAL for open positions display
                if (onTradePlaced) {
                  try {
                    onTradePlaced({
                      contract_id: contractId,
                      buy_price: buyPrice,
                      payout: payout,
                      contract_type: direction === 'Rise' ? 'CALL' : 'PUT',
                      trade_type: tradeType,
                      symbol: selectedMarket.symbol,
                      display_name: selectedMarket.name || selectedMarket.symbol,
                      duration: durationValue,
                      duration_unit: durationUnit,
                      stake: stake,
                      start_time: Date.now() / 1000,
                      profit: 0,
                      sell_price: buyPrice,
                    });
                  } catch (error) {
                    console.error('[TRADE EXECUTION] Error calling onTradePlaced:', error);
                  }
                } else {
                }
                // Refresh proposals after successful trade
                setTimeout(() => refreshProposals(false), 100);
                return; // Success, exit early
              }
            } else {
              throw new Error('Failed to fetch fresh proposal. Please try again.');
            }
          } catch (retryError) {
            throw new Error(retryError.message || 'Failed to refresh proposal and retry purchase');
          }
        }
        
        // Provide more specific error messages for other errors
        let userMessage = errorMessage;
        if (errorCode === 'InvalidContract') {
          userMessage = 'Invalid contract parameters. Please check your trade settings.';
        } else if (errorCode === 'InsufficientBalance') {
          // Show the actual account balance from selected account for better error message
          const selectedAccount = getSelectedAccountFromStorage();
          // CRITICAL: Get balance from multiple sources, prioritizing accounts array
          let selectedAccountBalance = selectedAccount?.balance ?? 0;
          
          // Try accounts array first (most reliable - comes from authorize response)
          if (selectedAccount?.loginid && user?.accounts) {
            const accountInList = user.accounts.find(acc => acc.loginid === selectedAccount.loginid);
            if (accountInList?.balance !== undefined && accountInList.balance !== null) {
              const accBalance = parseFloat(accountInList.balance);
              if (!isNaN(accBalance) && accBalance > 0) {
                selectedAccountBalance = accBalance;
              }
            }
          }
          
          // Fallback to liveBalances
          if (selectedAccountBalance <= 0 && selectedAccount?.loginid && user?.liveBalances?.[selectedAccount.loginid]) {
            selectedAccountBalance = user.liveBalances[selectedAccount.loginid].balance || 0;
          }
          
          // Last fallback (but this is from primary account, not selected)
          if (selectedAccountBalance <= 0) {
            selectedAccountBalance = user?.balance ?? 0;
          }
          
          const requiredAmount = proposal?.ask_price || stake;
          
          // CRITICAL: Check if there's an account mismatch
          // The API uses the account from authorize response for balance checks, not the selected account
          const accountMismatch = selectedAccount?.loginid && user?.loginid && selectedAccount.loginid !== user.loginid;
          
          // Check if the API error message contains balance information
          const apiErrorMessage = response.error?.message || '';
          const apiBalanceMatch = apiErrorMessage.match(/balance[:\s]+([\d.]+)/i);
          const apiBalance = apiBalanceMatch ? parseFloat(apiBalanceMatch[1]) : null;
          
          // CRITICAL: The API always checks the primary account from authorize response, not the selected account
          // If the API shows 0.00 balance but our selected account has balance, it's an account mismatch
          const apiCheckedWrongAccount = apiBalance !== null && apiBalance === 0 && selectedAccountBalance >= requiredAmount;
          
          // CRITICAL: Also check if user.balance is 0 but selected account has balance
          // This indicates the API is checking the wrong account
          const primaryAccountHasZero = user?.balance === 0 && selectedAccountBalance >= requiredAmount;
          
          if (accountMismatch || apiCheckedWrongAccount || primaryAccountHasZero) {
            userMessage = `⚠️ Account Mismatch Detected! The Deriv API checked account ${user?.loginid || 'unknown'} (balance: ${apiBalance !== null ? apiBalance.toFixed(2) : (user?.balance || 0).toFixed(2)} USD), but you selected account ${selectedAccount?.loginid || 'unknown'} (balance: ${selectedAccountBalance.toFixed(2)} USD). The WebSocket is still using the primary account from the authorize response. Please refresh the page to complete the account switch, then try again.`;
          } else {
            userMessage = `Insufficient balance. Your account (${selectedAccount?.loginid || user?.loginid || 'current'}) has ${selectedAccountBalance.toFixed(2)} USD, but ${requiredAmount.toFixed(2)} USD is required.`;
          }
        } else if (errorCode === 'MarketClosed') {
          userMessage = 'Market is currently closed. Please try again later.';
        } else if (errorCode === 'RateLimit') {
          userMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (errorCode === 'InvalidContractProposal') {
          userMessage = 'Proposal expired. Please try again - a fresh proposal will be fetched automatically.';
        }
        
        // Preserve API error details in the error object
        const apiError = new Error(userMessage);
        apiError.code = errorCode;
        apiError.apiError = response.error;
        throw apiError;
      }

      // Validate successful response
      if (!response.buy) {
        throw new Error('Invalid response: missing buy data');
      }

      if (!response.buy.contract_id) {
        throw new Error('Invalid response: missing contract ID');
      }

      // Handle successful trade using shared utility
      handleSuccessfulTrade({
        response,
        deductBalance,
        requestBalanceUpdate,
        user,
        toast,
        onTradePlaced,
        tradeData: {
          direction,
          contract_type: direction === 'Rise' ? 'CALL' : 'PUT',
          trade_type: tradeType,
          symbol: selectedMarket.symbol,
          display_name: selectedMarket.name || selectedMarket.symbol,
          duration: durationValue,
          duration_unit: durationUnit,
          stake: stake,
          start_time: Date.now() / 1000,
          profit: 0,
        }
      });
        
      // Refresh proposals after successful trade to update buttons with fresh proposal IDs
      setTimeout(() => refreshProposals(false), 100);
      
      // CRITICAL: Keep buttons disabled for 15 seconds after successful trade
      // This prevents accidental duplicate trades and allows time for the contract to settle
      // Clear any existing timeout first
      if (buttonDisableTimeoutRef.current) {
        clearTimeout(buttonDisableTimeoutRef.current);
      }
      buttonDisableTimeoutRef.current = setTimeout(() => {
        setIsPurchasing(false);
        buttonDisableTimeoutRef.current = null;
        console.log('[TradeExecution] Buttons re-enabled after 15 seconds');
      }, 15000); // 15 seconds
      
      // Don't set isPurchasing to false immediately - let the timeout handle it
      lastTradeTimeRef.current = Date.now(); // Update last trade time after completion
    } catch (error) {
      // Enhanced error logging for debugging
      
      // Provide user-friendly error message
      const errorMessage = error.message || 'An unexpected error occurred. Please try again.';
      
      toast({
        title: 'Purchase Failed',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000,
      });
      
      // On error, re-enable buttons immediately (no 15-second wait)
      // Clear any pending timeout
      if (buttonDisableTimeoutRef.current) {
        clearTimeout(buttonDisableTimeoutRef.current);
        buttonDisableTimeoutRef.current = null;
      }
      setIsPurchasing(false);
      lastTradeTimeRef.current = Date.now(); // Update last trade time after completion
    }
  };

  const getPayoutPct = (proposal) => {
    if (!proposal || !proposal.payout) return '—';
    return ((proposal.payout / stake * 100) - 100).toFixed(2);
  };

  const getPayoutAmount = (proposal) => {
    if (!proposal || !proposal.payout) return '—';
    return proposal.payout.toFixed(2);
  };

  // Check if user is logged in (for onClick validation)
  // Match desktop logic: allow if user exists OR localStorage has deriv_user
  // Note: Balance check is done in onClick handler, not in disabled prop
  const canTrade = useMemo(() => {
    // Check if user exists OR localStorage has deriv_user (same as desktop buttons)
    const hasValidToken = user?.token ? isValidAuthToken(user.token) : isUserAuthenticated();
    return hasValidToken;
  }, [user]);

  // Use refs to store latest function references to prevent infinite loops
  const handlePurchaseRef = useRef(handlePurchase);
  const toastRef = useRef(toast);
  
  // Update refs when functions change
  useEffect(() => {
    handlePurchaseRef.current = handlePurchase;
    toastRef.current = toast;
  }, [handlePurchase, toast]);

  const actionButtons = (
    <div className="border-t border-gray-200 pt-4 flex gap-2">
      <div className="flex-1">
        <StyledTradeButton
          label="Rise"
          proposal={callProposal}
          icon={TrendingUp}
          color="bg-green-500 hover:bg-green-600"
          onClick={() => {
            // CRITICAL: Use selected account balance, not primary account balance
            const selectedAccount = getSelectedAccountFromStorage();
            let accountBalance = 0;
            
            // Priority 1: Selected account balance from localStorage
            if (selectedAccount?.balance !== undefined && selectedAccount.balance !== null) {
              accountBalance = parseFloat(selectedAccount.balance) || 0;
            }
            
            // Priority 2: Selected account balance from liveBalances
            if (accountBalance <= 0 && selectedAccount?.loginid && user?.liveBalances?.[selectedAccount.loginid]) {
              accountBalance = user.liveBalances[selectedAccount.loginid].balance || 0;
            }
            
            // Priority 3: Selected account from accounts array
            if (accountBalance <= 0 && selectedAccount?.loginid && user?.accounts) {
              const accountInList = user.accounts.find(acc => acc.loginid === selectedAccount.loginid);
              if (accountInList?.balance !== undefined && accountInList.balance !== null) {
                accountBalance = parseFloat(accountInList.balance) || 0;
              }
            }
            
            // Priority 4: Fallback to user.balance (primary account)
            if (accountBalance <= 0 && user?.balance) {
              accountBalance = user.balance;
            }
            
            const hasValidAuth = accountBalance > 0 || 
                                 (user?.token && isValidAuthToken(user.token)) || 
                                 isUserAuthenticated();
            
            if (!hasValidAuth) {
              toast({
                title: 'Login Required',
                description: 'Please log in to place trades',
                variant: 'destructive'
              });
              return;
            }
            
            if (accountBalance <= 0) {
              toast({
                title: 'Insufficient Balance',
                description: `Selected account (${selectedAccount?.loginid || user?.loginid || 'current'}) has ${accountBalance.toFixed(2)} USD. Please ensure your account has a balance greater than 0.`,
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
            handlePurchase('Rise', callProposal);
          }}
          disabled={!api || !isConnected || isPurchasing}
          isLoading={isPurchasing || isLoading}
          getPayoutPct={getPayoutPct}
          getPayoutAmount={getPayoutAmount}
        />
      </div>
      <div className="flex-1">
        <StyledTradeButton
          label="Fall"
          proposal={putProposal}
          icon={TrendingDown}
          color="bg-red-500 hover:bg-red-600"
          onClick={() => {
            // CRITICAL: Use selected account balance, not primary account balance
            const selectedAccount = getSelectedAccountFromStorage();
            let accountBalance = 0;
            
            // Priority 1: Selected account balance from localStorage
            if (selectedAccount?.balance !== undefined && selectedAccount.balance !== null) {
              accountBalance = parseFloat(selectedAccount.balance) || 0;
            }
            
            // Priority 2: Selected account balance from liveBalances
            if (accountBalance <= 0 && selectedAccount?.loginid && user?.liveBalances?.[selectedAccount.loginid]) {
              accountBalance = user.liveBalances[selectedAccount.loginid].balance || 0;
            }
            
            // Priority 3: Selected account from accounts array
            if (accountBalance <= 0 && selectedAccount?.loginid && user?.accounts) {
              const accountInList = user.accounts.find(acc => acc.loginid === selectedAccount.loginid);
              if (accountInList?.balance !== undefined && accountInList.balance !== null) {
                accountBalance = parseFloat(accountInList.balance) || 0;
              }
            }
            
            // Priority 4: Fallback to user.balance (primary account)
            if (accountBalance <= 0 && user?.balance) {
              accountBalance = user.balance;
            }
            
            const hasValidAuth = accountBalance > 0 || 
                                 (user?.token && isValidAuthToken(user.token)) || 
                                 isUserAuthenticated();
            
            if (!hasValidAuth) {
              toast({
                title: 'Login Required',
                description: 'Please log in to place trades',
                variant: 'destructive'
              });
              return;
            }
            
            if (accountBalance <= 0) {
              toast({
                title: 'Insufficient Balance',
                description: `Selected account (${selectedAccount?.loginid || user?.loginid || 'current'}) has ${accountBalance.toFixed(2)} USD. Please ensure your account has a balance greater than 0.`,
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
          handlePurchase('Fall', putProposal);
        }}
        disabled={!api || !isConnected || isPurchasing}
        isLoading={isPurchasing || isLoading}
        getPayoutPct={getPayoutPct}
        getPayoutAmount={getPayoutAmount}
      />
    </div>
  </div>
);

  // Sync proposals and button handlers to parent component for mobile footer buttons
  useEffect(() => {
    if (onProposalsSync) {
      const handleRiseClick = () => {
        if (!callProposal) {
          toastRef.current({
            title: 'Proposal Not Available',
            description: 'Please wait for the proposal to load or check your connection.',
            variant: 'destructive'
          });
          return;
        }
        if (!api || !isConnected) {
          toastRef.current({
            title: 'Not Connected',
            description: 'Please wait for connection to be established.',
            variant: 'destructive'
          });
          return;
        }
        handlePurchaseRef.current('Rise', callProposal);
      };

      const handleFallClick = () => {
        if (!putProposal) {
          toastRef.current({
            title: 'Proposal Not Available',
            description: 'Please wait for the proposal to load or check your connection.',
            variant: 'destructive'
          });
          return;
        }
        if (!api || !isConnected) {
          toastRef.current({
            title: 'Not Connected',
            description: 'Please wait for connection to be established.',
            variant: 'destructive'
          });
          return;
        }
        handlePurchaseRef.current('Fall', putProposal);
      };

      onProposalsSync({
        positive: {
          label: 'Rise',
          proposal: callProposal,
          onClick: handleRiseClick,
          disabled: !api || !isConnected || isPurchasing,
          isLoading: isPurchasing || isLoading,
          color: 'bg-green-500 hover:bg-green-600',
          icon: TrendingUp
        },
        negative: {
          label: 'Fall',
          proposal: putProposal,
          onClick: handleFallClick,
          disabled: !api || !isConnected || isPurchasing,
          isLoading: isPurchasing || isLoading,
          color: 'bg-red-500 hover:bg-red-600',
          icon: TrendingDown
        }
      });
    }
  }, [callProposal, putProposal, isPurchasing, isLoading, api, isConnected, onProposalsSync]);

  return (
    <div className="p-2 space-y-1.5">
      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
          <p className="text-xs text-yellow-800">
            ⚠️ You need to connect your account to trade
          </p>
        </div>
      )}

      <Tabs value={durationOrEndtime} onValueChange={(value) => {
        setDurationOrEndtime(value);
        // When switching to endtime, ensure default is tomorrow if not set
        if (value === 'endtime' && (!endDate || endDate <= new Date())) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(23, 59, 59, 0);
          setEndDate(tomorrow);
        }
      }}>
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
                  <span>{durationUnit === 't' ? 'Ticks' : durationUnit === 'm' ? 'Minutes' : durationUnit === 'h' ? 'Hours' : 'Days'}</span>
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="space-y-1">
                  {[
                    { value: 't', label: 'Ticks' },
                    { value: 'm', label: 'Minutes' },
                    { value: 'h', label: 'Hours' },
                    { value: 'd', label: 'Days' }
                  ].map((unit) => (
                    <Button
                      key={unit.value}
                      variant={durationUnit === unit.value ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => {
                        setDurationUnit(unit.value);
                        const minValue = unit.value === 't' ? 1 : 1;
                        if (durationValue < minValue) setDurationValue(minValue);
                      }}
                    >
                      {unit.label}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Duration Input - Show slider for ticks, input for others */}
            {durationUnit === 't' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{durationValue} {durationValue === 1 ? 'Tick' : 'Ticks'}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDurationChange(1)}
                    disabled={isLoading}
                    className="h-6 w-6"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                </div>
                {/* Slider with stop points */}
                <div className="relative">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={Math.min(Math.max(durationValue, 1), 10)}
                    onChange={(e) => setDurationValue(Math.max(1, parseInt(e.target.value)))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    disabled={isLoading}
                  />
                  {/* Stop points - ticks from 1 to 10 */}
                  <div className="flex justify-between mt-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((point) => (
                      <div
                        key={point}
                        className={cn(
                          "w-1 h-1 rounded-full",
                          point <= durationValue ? "bg-gray-700" : "bg-gray-300"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDurationChange(-1)}
                  disabled={isLoading}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={durationValue}
                  onChange={e => {
                    const minValue = 1;
                    setDurationValue(Math.max(minValue, parseInt(e.target.value) || minValue));
                  }}
                  className="w-24 text-center"
                  min={1}
                  disabled={isLoading}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDurationChange(1)}
                  disabled={isLoading}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <div className="text-xs text-gray-500 ml-auto">
                  {durationUnit === 'm' && `Range: 1 - 1,440 minutes`}
                  {durationUnit === 'h' && `Range: 1 - 24 hours`}
                  {durationUnit === 'd' && `Range: 1 - 365 days`}
                </div>
              </div>
            )}
            {durationUnit === 'd' && endDate && (
              <div className="text-xs text-gray-600">
                Expiry: {format(endDate, "dd MMM yyyy, HH:mm:ss")} GMT +0
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
            {endDate && (
              <div className="text-xs text-gray-600">
                Expiry: {format(endDate, "dd MMM yyyy, HH:mm:ss")} GMT +0
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const newDate = new Date(endDate);
                  newDate.setDate(newDate.getDate() - 1);
                  if (newDate >= new Date()) {
                    setEndDate(newDate);
                  }
                }}
                disabled={isLoading || !endDate}
                className="h-8 w-8"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const newDate = new Date(endDate);
                  newDate.setDate(newDate.getDate() + 1);
                  setEndDate(newDate);
                }}
                disabled={isLoading || !endDate}
                className="h-8 w-8"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Tabs value={stakeOrPayout} onValueChange={setStakeOrPayout}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stake">Stake</TabsTrigger>
          <TabsTrigger value="payout">Payout</TabsTrigger>
        </TabsList>
        <TabsContent value="stake" className="mt-1.5">
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <Label className="text-xs">Stake (USD)</Label>
              {balance && (
                <span className="text-xs text-gray-500">Balance: ${Number(balance).toFixed(2)}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleStakeChange(-1)}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                value={stake}
                onChange={e => setStake(Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-20 text-center h-8 text-sm"
                min={1}
                step="0.01"
                disabled={isLoading}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleStakeChange(1)}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="payout" className="mt-1.5">
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <Label className="text-xs">Payout (USD)</Label>
              {balance && (
                <span className="text-xs text-gray-500">Balance: ${Number(balance).toFixed(2)}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePayoutChange(-1)}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                value={payout}
                onChange={e => setPayout(Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-20 text-center h-8 text-sm"
                min={1}
                step="0.01"
                disabled={isLoading}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePayoutChange(1)}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="allow-equals"
          checked={allowEquals}
          onCheckedChange={setAllowEquals}
          disabled={isLoading}
        />
        <label htmlFor="allow-equals" className="text-sm font-medium">
          Allow equals
        </label>
        <Info className="h-3.5 w-3.5 text-gray-400" />
      </div>

      {!hideActionButtons && actionButtons}

      {!hidePrediction && (
        <PredictionPanel
          symbol={selectedMarket?.symbol}
          tradeType={tradeType}
          aiPrediction={aiPrediction ? {
            prediction: aiPrediction.direction?.toLowerCase() || aiPrediction.prediction || 'rise',
            confidence: typeof aiPrediction.confidence === 'number' && aiPrediction.confidence > 1 
              ? aiPrediction.confidence / 100 
              : aiPrediction.confidence || 0.65
          } : { prediction: 'rise', confidence: 0.65 }}
          mode="compact"
        />
      )}
    </div>
  );
};

const HigherLowerExecution = ({ selectedMarket, tradeType = 'higher_lower', aiPrediction, onBarrierChange, hidePrediction = false, onTradePlaced, openPositions, hideActionButtons = false, onProposalsSync }) => {
  // Subscribe to Redux trade type changes
  const reduxTradeType = useAppSelector(state => state.tradeType.currentTradeType);
  const dispatch = useAppDispatch();
  
  // Update Redux when trade type changes
  useEffect(() => {
    if (tradeType && tradeType !== reduxTradeType) {
      dispatch(setTradeTypeRedux(tradeType));
    }
  }, [tradeType, reduxTradeType, dispatch]);
  const [stake, setStake] = useState(10);
  const [payout, setPayout] = useState(10);
  const [stakeOrPayout, setStakeOrPayout] = useState('stake'); // 'stake' or 'payout'
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
  const [durationUnit, setDurationUnit] = useState('d'); // Default to days for Higher/Lower
  const [barrier, setBarrier] = useState(0.01);
  const [barrierError, setBarrierError] = useState(null);
  const [allowEquals, setAllowEquals] = useState(false);
  const [callProposal, setCallProposal] = useState(null);
  const [putProposal, setPutProposal] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const lastTradeTimeRef = useRef(0); // Track last trade attempt time for cooldown
  const rateLimitCooldownRef = useRef(0); // Track when rate limit was hit
  const rateLimitRetryCountRef = useRef(0); // Track consecutive rate limit errors
  const rateLimitToastShownRef = useRef(false); // Track if we've shown rate limit toast
  const { toast } = useToast();
  const { api, connected: isConnected, user, lastTick, login, tickData, subscribeTick } = useDerivAPI();
  // CRITICAL: Use selected account balance from localStorage (most up-to-date for selected account)
  // This ensures we use the balance for the selected account, not the first account
  const selectedAccount = getSelectedAccountFromStorage();
  const balance = selectedAccount?.balance ?? user?.balance ?? 0;
  // Get currency from selected account or user, default to USD
  const currency = selectedAccount?.currency || user?.currency || 'USD';
  // Get current tick from tickData (more reliable than lastTick prop which might be stale)
  const currentTick = selectedMarket?.symbol ? (tickData?.[selectedMarket.symbol] || lastTick) : lastTick;
  const prevTradeTypeRef = useRef(null);
  const prevSymbolRef = useRef(null); // Track previous symbol to detect market changes
  const isMountedRef = useRef(false);
  // Track subscription IDs to manage subscriptions properly
  const subscriptionIdsRef = useRef(new Map()); // contractType -> subscription_id
  
  // Clear proposals and subscriptions when market symbol changes
  useEffect(() => {
    const currentSymbol = selectedMarket?.symbol;
    const symbolChanged = prevSymbolRef.current !== null && prevSymbolRef.current !== currentSymbol;
    prevSymbolRef.current = currentSymbol;
    
    // Only clear proposals if symbol actually changed (not on mount or other re-renders)
    if (symbolChanged) {
      console.log('[HigherLowerExecution] Market symbol changed, clearing proposals:', {
        from: prevSymbolRef.current,
        to: currentSymbol
      });
      setCallProposal(null);
      setPutProposal(null);
      // Reset retry tracking when symbol changes
      tickRetryCountRef.current = 0;
      warningShownForRetryCycleRef.current = false;
      waitingForTickDataRef.current = false;
      lastTickQuoteRef.current = null;
      hasFetchedWithTickDataRef.current = false;
    }
  }, [selectedMarket?.symbol]);
  
  // Clear proposals and subscriptions immediately when tradeType changes to ensure fresh fetch
  useEffect(() => {
    // Unsubscribe from all existing subscriptions when trade type changes
    if (api && isConnected && subscriptionIdsRef.current.size > 0) {
      subscriptionIdsRef.current.forEach((subscriptionId, contractType) => {
        if (subscriptionId) {
          try {
            api.send({ forget: subscriptionId }).catch(() => {});
          } catch (e) {
            // Ignore errors
          }
        }
      });
      subscriptionIdsRef.current.clear();
    }
    
    setCallProposal(null);
    setPutProposal(null);
    setIsLoading(true); // Set loading to true immediately to keep buttons enabled during fetch
    // Reset prevTradeTypeRef to force fetch effect to detect the change
    prevTradeTypeRef.current = null;
    isMountedRef.current = true;
    // Reset retry tracking when trade type changes
    tickRetryCountRef.current = 0;
    warningShownForRetryCycleRef.current = false;
    waitingForTickDataRef.current = false;
    lastTickQuoteRef.current = null;
    hasFetchedWithTickDataRef.current = false;
    // Reset rate limit tracking when trade type changes
    rateLimitCooldownRef.current = 0;
    rateLimitRetryCountRef.current = 0;
    rateLimitToastShownRef.current = false;
    return () => {
      isMountedRef.current = false;
      // Cleanup subscriptions on unmount
      if (api && isConnected && subscriptionIdsRef.current.size > 0) {
        subscriptionIdsRef.current.forEach((subscriptionId) => {
          if (subscriptionId) {
            try {
              api.send({ forget: subscriptionId }).catch(() => {});
            } catch (e) {
              // Ignore errors
            }
          }
        });
        subscriptionIdsRef.current.clear();
      }
    };
  }, [tradeType, api, isConnected]);
  
  // Report barrier to chart
  useEffect(() => {
    if (!onBarrierChange || !selectedMarket?.symbol) {
      onBarrierChange?.([]);
      return;
    }
    
    // Always show barrier if we have a value (even 0.001)
    if (barrier !== undefined && barrier !== null) {
      // Calculate barrier price from current tick if available
      const tick = currentTick || (selectedMarket?.symbol ? tickData?.[selectedMarket.symbol] : null);
      let barrierPrice = null;
      if (tick && tick.symbol === selectedMarket.symbol && tick.quote) {
        barrierPrice = tick.quote + barrier;
      }
      
      // Always report barrier, even if price not available yet (will be calculated in TradingChart)
      onBarrierChange?.([{
        price: barrierPrice,
        barrierOffset: barrier, // Always include offset for calculation
        label: `≡ +${barrier}`,
        color: '#60A5FA', // Light blue color
        lineStyle: 2, // dashed
      }]);
    } else {
      onBarrierChange?.([]);
    }
  }, [barrier, selectedMarket?.symbol, currentTick, tickData, onBarrierChange]);

  const fetchProposal = useCallback(async (contractType) => {
    const amount = stakeOrPayout === 'payout' ? payout : stake;
    
    // Validate prerequisites with detailed logging
    if (!selectedMarket?.symbol) {
      console.warn('[HigherLowerExecution] fetchProposal: No market symbol', { contractType });
      return null;
    }
    
    if (amount <= 0) {
      console.warn('[HigherLowerExecution] fetchProposal: Invalid amount', { contractType, amount, stakeOrPayout });
      return null;
    }
    
    if (!api) {
      console.warn('[HigherLowerExecution] fetchProposal: API not available', { contractType });
      return null;
    }
    
    if (!isConnected) {
      console.warn('[HigherLowerExecution] fetchProposal: Not connected', { contractType });
      return null;
    }
    
    // CRITICAL FIX: Check if user is authorized before sending proposal request
    // For authenticated endpoints like proposals, we need to ensure authorization is complete
    if (!user || !user.loginid) {
      console.warn('[HigherLowerExecution] fetchProposal: User not authorized', { 
        contractType,
        hasUser: !!user,
        hasLoginId: !!user?.loginid
      });
      // Don't show error toast as authorization may still be in progress
      return null;
    }

    // Calculate duration in hours to determine if we need absolute barrier
    let durationInHours = 0;
    if (durationOrEndtime === 'duration') {
      // Convert duration to hours based on unit
      const durationMultipliers = {
        's': 1 / 3600,  // seconds to hours
        'm': 1 / 60,    // minutes to hours
        'h': 1,         // hours
        'd': 24,        // days to hours
        't': 0          // ticks - cannot determine hours, assume < 24h
      };
      durationInHours = durationValue * (durationMultipliers[durationUnit] || 0);
    } else if (endDate) {
      // Calculate hours until expiry
      const now = Date.now();
      const expiry = endDate.getTime();
      durationInHours = (expiry - now) / (1000 * 60 * 60); // milliseconds to hours
    }

    // For contracts >= 24 hours, use absolute barrier (no +/- prefix)
    // For contracts < 24 hours, use relative barrier (with +/- prefix)
    // Note: Synthetic indices (R_*) support both relative and absolute barriers
    const needsAbsoluteBarrier = durationInHours >= 24;
    let formattedBarrier;
    
    // Get current tick data (used for absolute barrier calculation and error logging)
    const tick = currentTick || (selectedMarket?.symbol ? tickData?.[selectedMarket.symbol] : null);
    
    console.log('[HigherLowerExecution] Barrier calculation:', {
      contractType,
      durationInHours,
      needsAbsoluteBarrier,
      durationValue,
      durationUnit,
      durationOrEndtime,
      barrier,
      hasLastTick: !!lastTick,
      lastTickSymbol: lastTick?.symbol,
      lastTickQuote: lastTick?.quote,
      selectedMarketSymbol: selectedMarket?.symbol,
      hasTick: !!tick,
      tickQuote: tick?.quote
    });
    
    if (needsAbsoluteBarrier) {
      // Calculate absolute barrier price: current price + barrier offset
      // CRITICAL: For contracts >= 24h, we MUST have current price to calculate absolute barrier
      
      if (tick && tick.symbol === selectedMarket.symbol && tick.quote) {
        const absoluteBarrierPrice = tick.quote + barrier;
        formattedBarrier = formatBarrierValue(absoluteBarrierPrice);
        console.log('[HigherLowerExecution] Using absolute barrier:', {
          contractType,
          currentPrice: tick.quote,
          barrierOffset: barrier,
          absoluteBarrier: absoluteBarrierPrice,
          formattedBarrier
        });
      } else {
        // Cannot calculate absolute barrier - use relative barrier as fallback
        // This allows proposals to be fetched even when tick data isn't available yet
        // The API will handle the conversion or return an error if relative barriers aren't supported
        console.warn('[HigherLowerExecution] No tick data available for absolute barrier, using relative barrier as fallback', {
          contractType,
          durationInHours,
          barrier,
          hasTickData: !!tickData,
          tickDataKeys: tickData ? Object.keys(tickData) : [],
          currentTick: currentTick ? 'exists' : 'not available',
          lastTick: lastTick ? 'exists' : 'not available',
          selectedMarketSymbol: selectedMarket?.symbol
        });
        // Use relative barrier as fallback - API may accept it or we'll retry when tick data arrives
        formattedBarrier = barrier >= 0 ? `+${formatBarrierValue(barrier)}` : `${formatBarrierValue(barrier)}`;
        console.log('[HigherLowerExecution] Using relative barrier fallback:', {
          contractType,
          formattedBarrier
        });
      }
    } else {
      // Relative barrier for contracts < 24 hours
      formattedBarrier = barrier >= 0 ? `+${formatBarrierValue(barrier)}` : `${formatBarrierValue(barrier)}`;
      console.log('[HigherLowerExecution] Using relative barrier:', {
        contractType,
        durationInHours,
        formattedBarrier
      });
    }

    const baseParams = {
      proposal: 1,
      subscribe: 1,
      amount: amount,
      basis: stakeOrPayout,
      contract_type: contractType,
      currency: currency, // Use account-holder's currency (required by API)
      symbol: selectedMarket.symbol,
      // Barrier format: string matching ^(?=.{1,20}$)[+-]?[0-9]+\.?[0-9]*$
      // For contracts >= 24 hours: absolute barrier (no +/- prefix)
      // For contracts < 24 hours: relative barrier (with +/- prefix)
      barrier: formattedBarrier,
    };

    if (durationOrEndtime === 'duration') {
      baseParams.duration = durationValue;
      baseParams.duration_unit = durationUnit;
    } else if (endDate) {
      baseParams.date_expiry = Math.floor(endDate.getTime() / 1000);
      baseParams.duration = null;
    }

    try {
      const response = await api.send(baseParams);
      if (response.error) {
        const errorCode = response.error.code;
        const errorMsg = response.error.message || 'Failed to get proposal';
        
        // Log detailed error information for debugging
        console.warn(`[HigherLowerExecution] Proposal fetch error for ${contractType}:`, {
          errorCode,
          errorMsg,
          symbol: selectedMarket?.symbol,
          barrier: formattedBarrier,
          durationValue,
          durationUnit,
          amount,
          stakeOrPayout,
          needsAbsoluteBarrier: durationInHours >= 24,
          currentPrice: tick?.quote || 'N/A'
        });
        
        // Handle AlreadySubscribed error by unsubscribing and retrying without subscribe
        if (errorCode === 'AlreadySubscribed') {
          // First, try to get proposal without subscribing (one-time fetch)
          const existingSubscriptionId = subscriptionIdsRef.current.get(contractType);
          if (existingSubscriptionId) {
            try {
              // Unsubscribe from existing subscription
              await api.send({ forget: existingSubscriptionId });
              subscriptionIdsRef.current.delete(contractType);
            } catch (e) {
              // Ignore unsubscribe errors
            }
          }
          
          // Try fetching proposal without subscribe flag (one-time fetch)
          const paramsWithoutSubscribe = { ...baseParams };
          delete paramsWithoutSubscribe.subscribe;
          
          try {
            const retryResponse = await api.send(paramsWithoutSubscribe);
            if (retryResponse.proposal && !retryResponse.error) {
              setBarrierError(null);
              console.log(`[HigherLowerExecution] Successfully fetched ${contractType} proposal after unsubscribing`);
              return retryResponse.proposal;
            }
          } catch (retryError) {
            // If one-time fetch fails, try resubscribing after a short delay
            await new Promise(resolve => setTimeout(resolve, 100));
            try {
              const resubscribeResponse = await api.send(baseParams);
              if (resubscribeResponse.proposal && !resubscribeResponse.error) {
                // Store subscription ID if provided
                if (resubscribeResponse.subscription?.id) {
                  subscriptionIdsRef.current.set(contractType, resubscribeResponse.subscription.id);
                }
                setBarrierError(null);
                console.log(`[HigherLowerExecution] Successfully fetched ${contractType} proposal after resubscribing`);
                return resubscribeResponse.proposal;
              }
            } catch (e) {
              // Ignore resubscribe errors
            }
          }
          
          // If all retries fail, return null but don't show error
          setBarrierError(null);
          console.warn(`[HigherLowerExecution] Failed to fetch ${contractType} proposal after handling AlreadySubscribed`);
          return null;
        }
        
        // Check if it's a barrier range error
        if (errorMsg.includes('Barrier is out of acceptable range') || errorMsg.includes('barrier') || errorCode === 'InvalidBarrier') {
          setBarrierError('Barrier is out of acceptable range.');
          console.error(`[HigherLowerExecution] Invalid barrier for ${contractType}:`, {
            barrier: formattedBarrier,
            errorMsg,
            currentPrice: tick?.quote || 'N/A',
            barrierOffset: barrier
          });
        } else {
          setBarrierError(null);
        }
        
        // Handle rate limit errors
        const isRateLimit = errorCode === 'RateLimit' || errorMsg.includes('rate limit') || errorMsg.includes('RateLimit');
        if (isRateLimit) {
          const now = Date.now();
          rateLimitCooldownRef.current = now;
          rateLimitRetryCountRef.current += 1;
          
          // Show toast only once per rate limit period (every 30 seconds)
          const timeSinceLastToast = now - (rateLimitCooldownRef.current - 30000);
          if (!rateLimitToastShownRef.current || timeSinceLastToast > 30000) {
            rateLimitToastShownRef.current = true;
            toast({
              title: 'Rate Limit Error',
              description: `API rate limit exceeded. ${errorMsg}. Please wait a moment.`,
              variant: 'destructive',
              duration: 5000
            });
            // Reset toast flag after 30 seconds
            setTimeout(() => {
              rateLimitToastShownRef.current = false;
            }, 30000);
          }
          
          console.warn('[HigherLowerExecution] Rate limit hit for', contractType, {
            retryCount: rateLimitRetryCountRef.current,
            cooldownUntil: new Date(rateLimitCooldownRef.current + 5000).toISOString(),
            backendError: errorMsg
          });
          return null;
        }
        
        // Don't show toast for AlreadySubscribed errors
        const isAlreadySubscribed = errorCode === 'AlreadySubscribed' || errorMsg.includes('already subscribed');
        if (!isAlreadySubscribed && !errorMsg.includes('Barrier is out of acceptable range')) {
          const tradeTypeChanged = prevTradeTypeRef.current !== tradeType;
          if (tradeTypeChanged) {
            // Surface backend error message directly to user
            toast({
              title: `Proposal Error (${contractType})`,
              description: `Backend error: ${errorMsg}`,
              variant: 'destructive',
              duration: 6000
            });
          }
        }
        return null;
      } else {
        // Clear barrier error on success
        setBarrierError(null);
        // Store subscription ID if provided
        if (response.subscription?.id) {
          subscriptionIdsRef.current.set(contractType, response.subscription.id);
        }
      }
      return response.proposal || null;
    } catch (error) {
      // Always log ALL errors with console.error for debugging
      const errorMessage = error?.message || error?.toString() || '';
      const errorCode = error?.code;
      const isExpectedError = 
        errorMessage.includes('WebSocket not connected') || 
        errorCode === 'AlreadySubscribed' ||
        errorCode === 'RateLimit' ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('RateLimit');
      
      // For AlreadySubscribed errors, don't log as error - it's expected behavior
      // Only log unexpected errors
      if (!isExpectedError) {
        console.error('[HigherLowerExecution] fetchProposal error:', {
          contractType,
          error: errorMessage,
          errorCode,
          symbol: selectedMarket?.symbol,
          amount,
          barrier,
          isExpectedError,
          fullError: error
        });
        
        // Only show toast for unexpected errors or when trade type changed
        const tradeTypeChanged = prevTradeTypeRef.current !== tradeType;
        if (tradeTypeChanged) {
          toast({
            title: 'Proposal Fetch Error',
            description: `Failed to fetch ${contractType} proposal: ${errorMessage}`,
            variant: 'destructive',
            duration: 5000
          });
        }
      } else if (errorCode === 'RateLimit') {
        const now = Date.now();
        rateLimitCooldownRef.current = now;
        rateLimitRetryCountRef.current += 1;
        
        // Show toast only once per rate limit period (every 30 seconds)
        const timeSinceLastToast = now - (rateLimitCooldownRef.current - 30000);
        if (!rateLimitToastShownRef.current || timeSinceLastToast > 30000) {
          rateLimitToastShownRef.current = true;
          toast({
            title: 'Rate Limit',
            description: 'Too many requests. Please wait a moment before trying again.',
            variant: 'destructive',
            duration: 5000
          });
          // Reset toast flag after 30 seconds
          setTimeout(() => {
            rateLimitToastShownRef.current = false;
          }, 30000);
        }
        
        console.warn('[HigherLowerExecution] Rate limit hit for', contractType, {
          retryCount: rateLimitRetryCountRef.current,
          cooldownUntil: new Date(rateLimitCooldownRef.current + 5000).toISOString()
        });
      } else if (errorCode === 'AlreadySubscribed') {
        // Silently handle AlreadySubscribed - don't log as error
        // The proposal might still be available from a previous subscription
      }
      return null;
    }
  }, [selectedMarket, stake, payout, stakeOrPayout, api, isConnected, user, barrier, durationOrEndtime, durationValue, durationUnit, endDate, toast, tradeType, currency, lastTick, tickData, currentTick]);

  // Function to refresh proposals - can be called after successful trades
  const refreshProposals = useCallback(async (showLoading = false) => {
    if (!selectedMarket?.symbol || !api || !isConnected) return;
    
    if (showLoading) {
      setIsLoading(true);
    }
    
    // Check if we're in rate limit cooldown period (5 seconds)
    const now = Date.now();
    const timeSinceRateLimit = now - rateLimitCooldownRef.current;
    const RATE_LIMIT_COOLDOWN_MS = 5000; // 5 seconds cooldown after rate limit
    
    if (rateLimitCooldownRef.current > 0 && timeSinceRateLimit < RATE_LIMIT_COOLDOWN_MS) {
      const remainingCooldown = ((RATE_LIMIT_COOLDOWN_MS - timeSinceRateLimit) / 1000).toFixed(1);
      console.log(`[HigherLowerExecution] Waiting for rate limit cooldown: ${remainingCooldown}s remaining`);
      // Don't fetch proposals during cooldown - return early
      if (showLoading && isMountedRef.current) {
        setIsLoading(false);
      }
      return;
    }
    
    // Reset rate limit tracking if cooldown has passed
    if (timeSinceRateLimit >= RATE_LIMIT_COOLDOWN_MS) {
      rateLimitRetryCountRef.current = 0;
      rateLimitCooldownRef.current = 0;
    }
    
    // Trigger re-fetch by updating state
    if (isMountedRef.current) {
      setIsLoading(false);
    }
  }, [api, isConnected, selectedMarket]);

  // Subscribe to tick data when market is selected (needed for >= 24h contracts that require absolute barriers)
  useEffect(() => {
    if (selectedMarket?.symbol && subscribeTick && isConnected) {
      subscribeTick(selectedMarket.symbol);
    }
  }, [selectedMarket?.symbol, subscribeTick, isConnected]);

  useEffect(() => {
    // Use Redux trade type if available, otherwise use prop tradeType
    const effectiveTradeType = reduxTradeType || tradeType;
    const tradeTypeChanged = prevTradeTypeRef.current !== null && prevTradeTypeRef.current !== effectiveTradeType;
    const isInitialMount = prevTradeTypeRef.current === undefined || prevTradeTypeRef.current === null;
    prevTradeTypeRef.current = effectiveTradeType;
    
    const fetchProposals = async () => {
      // Check prerequisites and provide helpful error messages
      if (!selectedMarket?.symbol) {
        console.warn('[HigherLowerExecution] Cannot fetch proposals: No market selected');
        // DON'T clear proposals - they might still be valid for previous market
        return;
      }
      
      if (!api) {
        console.warn('[HigherLowerExecution] Cannot fetch proposals: API not available');
        toast({
          title: 'Connection Error',
          description: 'API is not available. Please refresh the page or check your connection.',
          variant: 'destructive',
          duration: 5000
        });
        // DON'T clear proposals - they might recover on reconnect
        return;
      }
      
      if (!isConnected) {
        console.warn('[HigherLowerExecution] Cannot fetch proposals: WebSocket not connected');
        toast({
          title: 'Connection Error',
          description: 'WebSocket is not connected. The app will reconnect automatically. Please wait...',
          variant: 'destructive',
          duration: 5000
        });
        // DON'T clear proposals - they might recover on reconnect
        return;
      }
      
      // Check if we're in rate limit cooldown period (5 seconds)
      const now = Date.now();
      const timeSinceRateLimit = now - rateLimitCooldownRef.current;
      const RATE_LIMIT_COOLDOWN_MS = 5000; // 5 seconds cooldown after rate limit
      
      if (rateLimitCooldownRef.current > 0 && timeSinceRateLimit < RATE_LIMIT_COOLDOWN_MS) {
        const remainingCooldown = ((RATE_LIMIT_COOLDOWN_MS - timeSinceRateLimit) / 1000).toFixed(1);
        console.log(`[HigherLowerExecution] Waiting for rate limit cooldown: ${remainingCooldown}s remaining`);
        // Don't fetch proposals during cooldown - return early
        if (isMountedRef.current) {
          setIsLoading(false);
        }
        return;
      }
      
      // Reset rate limit tracking if cooldown has passed
      if (timeSinceRateLimit >= RATE_LIMIT_COOLDOWN_MS) {
        rateLimitRetryCountRef.current = 0;
        rateLimitCooldownRef.current = 0;
      }
      
      setIsLoading(true);
      try {
        const callType = allowEquals ? 'CALLE' : 'CALL';
        const putType = allowEquals ? 'PUTE' : 'PUT';
        
        console.log('[HigherLowerExecution] Fetching proposals:', {
          symbol: selectedMarket.symbol,
          callType,
          putType,
          stake,
          payout,
          stakeOrPayout,
          barrier,
          durationValue,
          durationUnit,
          currency // Log currency being used
        });
        
        // Add a small delay between CALL and PUT requests to reduce rate limit issues
        const callRes = await fetchProposal(callType);
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between requests
        const putRes = await fetchProposal(putType);
        
        console.log('[HigherLowerExecution] Proposal fetch results:', {
          callProposal: callRes ? {
            received: true,
            id: callRes.id,
            payout: callRes.payout,
            askPrice: callRes.ask_price
          } : 'null',
          putProposal: putRes ? {
            received: true,
            id: putRes.id,
            payout: putRes.payout,
            askPrice: putRes.ask_price
          } : 'null',
          symbol: selectedMarket?.symbol,
          barrier: barrier,
          durationValue,
          durationUnit
        });
        
        if (isMountedRef.current) {
          setCallProposal(callRes);
          setPutProposal(putRes);
          
          // Calculate if we need absolute barrier (for >= 24h contracts)
          let durationInHours = 0;
          if (durationOrEndtime === 'duration') {
            const durationMultipliers = {
              's': 1 / 3600,
              'm': 1 / 60,
              'h': 1,
              'd': 24,
              't': 0
            };
            durationInHours = durationValue * (durationMultipliers[durationUnit] || 0);
          } else if (endDate) {
            const now = Date.now();
            const expiry = endDate.getTime();
            durationInHours = (expiry - now) / (1000 * 60 * 60);
          }
          
          const needsAbsoluteBarrier = durationInHours >= 24;
          const hasTickData = currentTick || (selectedMarket?.symbol ? tickData?.[selectedMarket.symbol] : null);
          
          // For >= 24h contracts, if we don't have tick data yet, we're still waiting
          // Don't show warning if we're waiting for tick data and haven't exhausted retries
          const isWaitingForTickData = needsAbsoluteBarrier && !hasTickData && tickRetryCountRef.current < MAX_TICK_RETRIES;
          waitingForTickDataRef.current = isWaitingForTickData;
          
          // Show warning if proposals are null AND we're not waiting for tick data
          // Reset warning flag when proposals are successfully fetched
          // IMPORTANT: Check both fetch results AND current state to avoid stale warnings
          const hasCallInState = !!callProposal;
          const hasPutInState = !!putProposal;
          const hasCallFromFetch = !!callRes;
          const hasPutFromFetch = !!putRes;
          
          if (hasCallFromFetch && hasPutFromFetch) {
            warningShownForRetryCycleRef.current = false;
            console.log('[HigherLowerExecution] Both proposals successfully fetched');
          } else if ((!hasCallFromFetch || !hasPutFromFetch) && !isWaitingForTickData && !warningShownForRetryCycleRef.current) {
            // Only show warning for proposals that are missing in BOTH fetch and state
            const missingProposals = [];
            if (!hasCallFromFetch && !hasCallInState) {
              missingProposals.push('Higher (CALL)');
            }
            if (!hasPutFromFetch && !hasPutInState) {
              missingProposals.push('Lower (PUT)');
            }
            
            // Only show warning if we actually have missing proposals (not available in state or fetch)
            if (missingProposals.length > 0) {
              warningShownForRetryCycleRef.current = true;
              
              // Log detailed information about missing proposals
              console.warn('[HigherLowerExecution] Missing proposals:', {
                missing: missingProposals,
                callProposalFromFetch: hasCallFromFetch ? 'available' : 'missing',
                putProposalFromFetch: hasPutFromFetch ? 'available' : 'missing',
                callProposalInState: hasCallInState ? 'available' : 'missing',
                putProposalInState: hasPutInState ? 'available' : 'missing',
                symbol: selectedMarket?.symbol,
                barrier,
                durationValue,
                durationUnit,
                hasTickData: !!hasTickData,
                needsAbsoluteBarrier,
                isConnected,
                hasApi: !!api
              });
              
              // Show more specific error message based on connection state
              let errorDescription = `Could not fetch proposals for: ${missingProposals.join(', ')}.`;
              if (!isConnected) {
                errorDescription += ' WebSocket is not connected. Reconnecting...';
              } else if (!api) {
                errorDescription += ' API is not initialized. Please refresh the page.';
              } else {
                errorDescription += ' Please check your connection and ensure you are authorized.';
              }
              
              toast({
                title: 'Proposal Fetch Warning',
                description: errorDescription,
                variant: 'destructive',
                duration: 5000
              });
            } else {
              // Proposals are available in state even if fetch failed - don't show warning
              console.log('[HigherLowerExecution] Proposals available in state, skipping warning');
            }
          }
        }
      } catch (error) {
        // Always log ALL errors with console.error for debugging
        const errorMessage = error?.message || error?.toString() || '';
        const errorCode = error?.code;
        const isExpectedError = 
          errorMessage.includes('WebSocket not connected') || 
          errorCode === 'AlreadySubscribed' ||
          errorCode === 'WrongResponse' ||
          errorCode === 'RateLimit' ||
          errorMessage.includes('WrongResponse') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('RateLimit');
        
        // Always log errors with console.error
        console.error('[HigherLowerExecution] Error fetching proposals:', {
          error: errorMessage,
          errorCode,
          isExpectedError,
          symbol: selectedMarket?.symbol,
          callType: allowEquals ? 'CALLE' : 'CALL',
          putType: allowEquals ? 'PUTE' : 'PUT',
          stake,
          payout,
          barrier,
          fullError: error
        });
        
        // Show toast notifications (conditional based on error type)
        if (!isExpectedError) {
          toast({
            title: 'Proposal Fetch Error',
            description: `Failed to fetch proposals: ${errorMessage}. Please try again.`,
            variant: 'destructive',
            duration: 5000
          });
        } else if (errorCode === 'RateLimit') {
          // Show rate limit error with helpful message
          toast({
            title: 'Rate Limit',
            description: 'Too many requests. Please wait a moment before trying again.',
            variant: 'destructive',
            duration: 3000
          });
        }
        
        // Only clear proposals on genuine errors (not rate limit or connection issues that might recover)
        // This prevents clearing valid proposals when there's a temporary network issue
        if (!isExpectedError && isMountedRef.current) {
          setCallProposal(null);
          setPutProposal(null);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    // Always fetch on mount or trade type change
    // Debounce to 800ms to prevent rate limit errors when duration changes
    if (isInitialMount || tradeTypeChanged) {
      fetchProposals();
    } else {
      const timeoutId = setTimeout(fetchProposals, 800);
      return () => clearTimeout(timeoutId);
    }
  }, [fetchProposal, allowEquals, stakeOrPayout, stake, payout, selectedMarket?.symbol, api, isConnected, tradeType, reduxTradeType, durationValue, durationUnit, durationOrEndtime, endDate, currentTick, tickData]);

  // Track retry attempts to prevent infinite loops
  const retryCountRef = useRef(0);
  const lastRetryTimeRef = useRef(0);
  const MAX_RETRIES = 3;
  const RETRY_COOLDOWN_MS = 2000; // 2 seconds between retries
  
  // Monitor proposals and auto-refresh if they become null (e.g., after closing positions)
  useEffect(() => {
    if (!api || !isConnected || !selectedMarket?.symbol) return;
    
    // If one or both proposals are null but we should have them, refresh with retry limit
    if ((!callProposal || !putProposal) && !isLoading) {
      const now = Date.now();
      const timeSinceLastRetry = now - lastRetryTimeRef.current;
      
      // Only retry if we haven't exceeded max retries and cooldown has passed
      if (retryCountRef.current < MAX_RETRIES && timeSinceLastRetry >= RETRY_COOLDOWN_MS) {
        const timeoutId = setTimeout(() => {
          if ((!callProposal || !putProposal) && api && isConnected) {
            retryCountRef.current += 1;
            lastRetryTimeRef.current = Date.now();
            refreshProposals(false);
          }
        }, 1000); // Increased delay to 1 second
        
        return () => clearTimeout(timeoutId);
      } else if (retryCountRef.current >= MAX_RETRIES) {
        // Reset retry count after a longer cooldown
        const resetTimeoutId = setTimeout(() => {
          retryCountRef.current = 0;
        }, 10000); // Reset after 10 seconds
        
        return () => clearTimeout(resetTimeoutId);
      }
    } else if (callProposal && putProposal) {
      // Reset retry count when both proposals are available
      retryCountRef.current = 0;
    }
  }, [callProposal, putProposal, api, isConnected, selectedMarket?.symbol, isLoading, refreshProposals]);

  // Clear warning flag when proposals become available (e.g., via subscriptions or retries)
  // This ensures warnings are cleared if proposals arrive after the initial fetch
  useEffect(() => {
    if (callProposal && putProposal) {
      // Both proposals are available, clear any warning flags
      if (warningShownForRetryCycleRef.current) {
        console.log('[HigherLowerExecution] Both proposals now available, clearing warning flag');
        warningShownForRetryCycleRef.current = false;
      }
    }
  }, [callProposal, putProposal]);

  // Track tick retry attempts separately
  const tickRetryCountRef = useRef(0);
  const lastTickRetryTimeRef = useRef(0);
  const waitingForTickDataRef = useRef(false); // Track if we're waiting for tick data for >= 24h contracts
  const warningShownForRetryCycleRef = useRef(false); // Track if warning was shown for current retry cycle
  const lastTickQuoteRef = useRef(null); // Track the last tick quote we used to fetch proposals
  const hasFetchedWithTickDataRef = useRef(false); // Track if we've successfully fetched proposals with tick data
  const MAX_TICK_RETRIES = 2;
  const TICK_RETRY_COOLDOWN_MS = 3000; // 3 seconds between tick retries
  
  // Retry fetching proposals when tick data becomes available (for >= 24h contracts that need absolute barrier)
  useEffect(() => {
    if (!api || !isConnected || !selectedMarket?.symbol || isLoading) return;
    
    // Check if we need absolute barrier (duration >= 24h)
    let durationInHours = 0;
    if (durationOrEndtime === 'duration') {
      const durationMultipliers = {
        's': 1 / 3600,
        'm': 1 / 60,
        'h': 1,
        'd': 24,
        't': 0
      };
      durationInHours = durationValue * (durationMultipliers[durationUnit] || 0);
    } else if (endDate) {
      const now = Date.now();
      const expiry = endDate.getTime();
      durationInHours = (expiry - now) / (1000 * 60 * 60);
    }
    
    const needsAbsoluteBarrier = durationInHours >= 24;
    const tick = currentTick || (selectedMarket?.symbol ? tickData?.[selectedMarket.symbol] : null);
    const hasTickData = tick && tick.quote;
    const currentTickQuote = hasTickData ? tick.quote : null;
    
    // If we need absolute barrier but don't have tick data yet, mark as waiting
    if (needsAbsoluteBarrier && !hasTickData && (!callProposal || !putProposal)) {
      waitingForTickDataRef.current = true;
      hasFetchedWithTickDataRef.current = false;
      return;
    }
    
    // If we have both proposals, reset tracking and exit early
    if (callProposal && putProposal) {
      // Reset tick retry count when both proposals are available
      tickRetryCountRef.current = 0;
      waitingForTickDataRef.current = false;
      warningShownForRetryCycleRef.current = false;
      // Mark that we've successfully fetched with tick data
      if (currentTickQuote) {
        lastTickQuoteRef.current = currentTickQuote;
        hasFetchedWithTickDataRef.current = true;
      }
      return;
    }
    
    // If we don't need absolute barrier, reset and exit
    if (!needsAbsoluteBarrier) {
      waitingForTickDataRef.current = false;
      return;
    }
    
    // Only retry if:
    // 1. We need absolute barrier
    // 2. We have tick data
    // 3. Proposals are missing
    // 4. We haven't already fetched with tick data (or tick data just became available)
    // 5. We haven't exceeded retry limits
    if (needsAbsoluteBarrier && hasTickData && (!callProposal || !putProposal)) {
      // Check if tick data just became available (transition from no data to data)
      const tickDataJustBecameAvailable = lastTickQuoteRef.current === null && currentTickQuote !== null;
      
      // Only retry if:
      // - Tick data just became available (first time we have tick data), OR
      // - We haven't fetched with tick data yet (initial fetch)
      // Do NOT retry on subsequent price updates - let the main proposal fetching effect handle parameter changes
      const shouldRetry = tickDataJustBecameAvailable || !hasFetchedWithTickDataRef.current;
      
      if (!shouldRetry) {
        // We've already fetched with tick data, so don't retry on every price update
        // The main proposal fetching effect will handle refetching when parameters change
        return;
      }
      
      const now = Date.now();
      const timeSinceLastTickRetry = now - lastTickRetryTimeRef.current;
      
      // Only retry if we haven't exceeded max retries and cooldown has passed
      if (tickRetryCountRef.current < MAX_TICK_RETRIES && timeSinceLastTickRetry >= TICK_RETRY_COOLDOWN_MS) {
        console.log('[HigherLowerExecution] Tick data now available, retrying proposal fetch for >= 24h contract');
        waitingForTickDataRef.current = false; // No longer waiting
        lastTickQuoteRef.current = currentTickQuote; // Update before fetching to prevent duplicate retries
        const timeoutId = setTimeout(() => {
          if (api && isConnected && !isLoading) {
            tickRetryCountRef.current += 1;
            lastTickRetryTimeRef.current = Date.now();
            refreshProposals(false);
          }
        }, 1000); // Increased delay to 1 second
        
        return () => clearTimeout(timeoutId);
      } else if (tickRetryCountRef.current >= MAX_TICK_RETRIES) {
        // Retries exhausted - no longer waiting
        waitingForTickDataRef.current = false;
        
        // Show warning now that retries are exhausted (only if BOTH proposals are missing and not already shown)
        const bothMissing = !callProposal && !putProposal;
        if (bothMissing && !warningShownForRetryCycleRef.current) {
          const missingProposals = [];
          if (!callProposal) missingProposals.push('Higher');
          if (!putProposal) missingProposals.push('Lower');
          
          warningShownForRetryCycleRef.current = true;
          toast({
            title: 'Proposal Fetch Warning',
            description: `Could not fetch proposals for: ${missingProposals.join(', ')}. Please check your connection and try again.`,
            variant: 'destructive',
            duration: 5000
          });
        }
        
        // Reset tick retry count after a longer cooldown
        const resetTimeoutId = setTimeout(() => {
          tickRetryCountRef.current = 0;
          warningShownForRetryCycleRef.current = false; // Reset warning flag when retry count resets
          hasFetchedWithTickDataRef.current = false; // Reset fetch flag to allow retry after cooldown
        }, 15000); // Reset after 15 seconds
        
        return () => clearTimeout(resetTimeoutId);
      }
    }
  }, [currentTick, tickData, callProposal, putProposal, api, isConnected, selectedMarket?.symbol, isLoading, durationOrEndtime, durationValue, durationUnit, endDate, refreshProposals]);

  const handleStakeChange = (amount) => setStake(prev => Math.max(1, prev + amount));
  const handlePayoutChange = (amount) => setPayout(prev => Math.max(1, prev + amount));
  const handleDurationChange = (amount) => {
    const minValue = durationUnit === 't' ? 1 : (durationUnit === 'm' ? 1 : (durationUnit === 'h' ? 1 : 1));
    setDurationValue(prev => Math.max(minValue, prev + amount));
  };
  const handleBarrierChange = (e) => {
    const value = parseFloat(e.target.value) || 0;
    setBarrier(value);
    // Validate barrier - will be validated against API response
    setBarrierError(null);
  };

  // Calculate expiry date from duration
  const calculateExpiry = useMemo(() => {
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

  const handlePurchase = async (direction, proposal) => {
    // Log token and wallet information when trade button is clicked
    logTradeButtonClick(user, balance, direction, proposal?.id);
    
    // Prevent duplicate requests - critical for real-time trading
    if (isPurchasing) {
      return;
    }

    // Cooldown mechanism: prevent accidental double-clicks (300ms minimum between trades)
    const now = Date.now();
    const timeSinceLastTrade = now - lastTradeTimeRef.current;
    const COOLDOWN_MS = 300; // 0.3 seconds cooldown to prevent accidental double-clicks only
    
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

    if (!proposal?.id) {
      toast({
        title: 'No Proposal',
        description: 'Please wait for proposal to load',
        variant: 'destructive'
      });
      return;
    }

    // Check balance - use ask_price if available, otherwise use stake
    const requiredAmount = proposal?.ask_price || stake;
    if (currentAccountBalance && requiredAmount > currentAccountBalance) {
      toast({
        title: 'Insufficient Balance',
        description: `You need ${requiredAmount.toFixed(2)} USD but have ${currentAccountBalance.toFixed(2)} USD`,
        variant: 'destructive'
      });
      return;
    }

    // CRITICAL: Extract wallet information and save to localStorage
    const walletLoginid = selectedAccount?.loginid || user?.loginid || '';
    const walletAmount = currentAccountBalance || user?.balance || balance || 0;
    const walletToken = user?.token || '';
    
    // Save wallet information to localStorage
    try {
      const walletData = {
        loginid: walletLoginid,
        amount: walletAmount,
        token: walletToken,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('deriv_wallet_trade', JSON.stringify(walletData));
      
      // Console log wallet information
      console.log('[TradeExecution] Wallet Information:', {
        loginid: walletLoginid,
        amount: walletAmount,
        token: walletToken ? `${walletToken.substring(0, 20)}...` : 'No token',
        timestamp: walletData.timestamp
      });
    } catch (e) {
      console.error('[TradeExecution] Error saving wallet data to localStorage:', e);
    }

    // CRITICAL: Verify account match before placing trade
    // The Deriv API uses the account that the WebSocket is authenticated with
    // If user.loginid doesn't match selectedAccount.loginid, the API will check the wrong account's balance
    if (selectedAccount && selectedAccount.loginid && user?.loginid && user.loginid !== selectedAccount.loginid) {
      console.error('[TradeExecution] CRITICAL: Account mismatch detected!', {
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
      // buy: proposal ID from price proposal, or 1 if using parameters
      // price: Maximum price at which to purchase the contract
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

      // CRITICAL: Log account info before placing trade
      console.log('[TradeExecution] Placing trade with:', {
        selectedAccountLoginid: selectedAccount?.loginid,
        authenticatedLoginid: user?.loginid,
        balance: currentAccountBalance,
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
          // CRITICAL: Get balance from multiple sources, prioritizing accounts array
          let selectedAccountBalance = selectedAccount?.balance ?? 0;
          
          // Try accounts array first (most reliable - comes from authorize response)
          if (selectedAccount?.loginid && user?.accounts) {
            const accountInList = user.accounts.find(acc => acc.loginid === selectedAccount.loginid);
            if (accountInList?.balance !== undefined && accountInList.balance !== null) {
              const accBalance = parseFloat(accountInList.balance);
              if (!isNaN(accBalance) && accBalance > 0) {
                selectedAccountBalance = accBalance;
              }
            }
          }
          
          // Fallback to liveBalances
          if (selectedAccountBalance <= 0 && selectedAccount?.loginid && user?.liveBalances?.[selectedAccount.loginid]) {
            selectedAccountBalance = user.liveBalances[selectedAccount.loginid].balance || 0;
          }
          
          // Last fallback (but this is from primary account, not selected)
          if (selectedAccountBalance <= 0) {
            selectedAccountBalance = user?.balance ?? 0;
          }
          
          const requiredAmount = proposal?.ask_price || stake;
          
          // CRITICAL: Check if there's an account mismatch
          // The API uses the account from authorize response for balance checks, not the selected account
          const accountMismatch = selectedAccount?.loginid && user?.loginid && selectedAccount.loginid !== user.loginid;
          
          // Check if the API error message contains balance information
          const apiErrorMessage = response.error?.message || '';
          const apiBalanceMatch = apiErrorMessage.match(/balance[:\s]+([\d.]+)/i);
          const apiBalance = apiBalanceMatch ? parseFloat(apiBalanceMatch[1]) : null;
          
          // CRITICAL: The API always checks the primary account from authorize response, not the selected account
          // If the API shows 0.00 balance but our selected account has balance, it's an account mismatch
          const apiCheckedWrongAccount = apiBalance !== null && apiBalance === 0 && selectedAccountBalance >= requiredAmount;
          
          // CRITICAL: Also check if user.balance is 0 but selected account has balance
          // This indicates the API is checking the wrong account
          const primaryAccountHasZero = user?.balance === 0 && selectedAccountBalance >= requiredAmount;
          
          if (accountMismatch || apiCheckedWrongAccount || primaryAccountHasZero) {
            userMessage = `⚠️ Account Mismatch Detected! The Deriv API checked account ${user?.loginid || 'unknown'} (balance: ${apiBalance !== null ? apiBalance.toFixed(2) : (user?.balance || 0).toFixed(2)} USD), but you selected account ${selectedAccount?.loginid || 'unknown'} (balance: ${selectedAccountBalance.toFixed(2)} USD). The WebSocket is still using the primary account from the authorize response. Please refresh the page to complete the account switch, then try again.`;
          } else {
            userMessage = `Insufficient balance. Your account (${selectedAccount?.loginid || user?.loginid || 'current'}) has ${selectedAccountBalance.toFixed(2)} USD, but ${requiredAmount.toFixed(2)} USD is required.`;
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
        const accountLoginid = selectedAccount?.loginid || user?.loginid;
        if (deductBalance && buyPrice && accountLoginid) {
          deductBalance(buyPrice, accountLoginid);
        }
        
        // Request balance update from WebSocket to sync with server
        if (requestBalanceUpdate && accountLoginid) {
          requestBalanceUpdate(accountLoginid);
        }
        
        toast({
          title: `✅ ${direction} Contract Purchased`,
          description: `Contract ID: ${contractId}${payout ? ` | Payout: $${payout.toFixed(2)}` : ''}`,
        });

        // Add position to open positions
        if (onTradePlaced) {
          onTradePlaced({
            contract_id: contractId,
            buy_price: buyPrice,
            payout: payout,
            stake: stake,
            contract_type: direction === 'Stays In' ? 'RANGE' : 'UPORDOWN',
            trade_type: tradeType,
            symbol: selectedMarket.symbol,
            display_name: selectedMarket.name || selectedMarket.symbol,
            duration: durationValue,
            duration_unit: durationUnit,
            start_time: Date.now() / 1000,
            profit: 0,
            sell_price: buyPrice,
          });
        }

        // Optional: Handle subscription if response includes it
        if (response.subscription) {
        }
        
        // Refresh proposals after successful trade to update buttons with fresh proposal IDs
        if (typeof refreshProposals === 'function') {
          setTimeout(() => refreshProposals(false), 100);
        }
      } else {
        throw new Error('Invalid response: missing buy data');
      }
    } catch (error) {
      // Enhanced error logging for debugging
      
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

  // Check if user is logged in (for onClick validation)
  // Match desktop logic: allow if user exists OR localStorage has deriv_user
  // Note: Balance check is done in onClick handler, not in disabled prop
  const canTrade = useMemo(() => {
    // Check if user exists OR localStorage has deriv_user (same as desktop buttons)
    const hasValidToken = user?.token ? isValidAuthToken(user.token) : isUserAuthenticated();
    return hasValidToken;
  }, [user]);

  const getPayoutAmount = (proposal) => {
    if (!proposal || !proposal.payout) return '—';
    return proposal.payout.toFixed(2);
  };

  // Use refs to store latest function references to prevent infinite loops
  const handlePurchaseRef = useRef(handlePurchase);
  const toastRef = useRef(toast);
  
  // Update refs when functions change
  useEffect(() => {
    handlePurchaseRef.current = handlePurchase;
    toastRef.current = toast;
  }, [handlePurchase, toast]);

  // Sync proposals and button handlers to parent component for mobile footer buttons
  useEffect(() => {
    if (onProposalsSync) {
      const handleHigherClick = () => {
        if (!callProposal) {
          toastRef.current({
            title: 'Proposal Not Available',
            description: 'Please wait for the proposal to load or check your connection.',
            variant: 'destructive'
          });
          return;
        }
        if (!api || !isConnected) {
          toastRef.current({
            title: 'Not Connected',
            description: 'Please wait for connection to be established.',
            variant: 'destructive'
          });
          return;
        }
        handlePurchaseRef.current('Higher', callProposal);
      };

      const handleLowerClick = () => {
        if (!putProposal) {
          toastRef.current({
            title: 'Proposal Not Available',
            description: 'Please wait for the proposal to load or check your connection.',
            variant: 'destructive'
          });
          return;
        }
        if (!api || !isConnected) {
          toastRef.current({
            title: 'Not Connected',
            description: 'Please wait for connection to be established.',
            variant: 'destructive'
          });
          return;
        }
        handlePurchaseRef.current('Lower', putProposal);
      };

      onProposalsSync({
        positive: {
          label: 'Higher',
          proposal: callProposal,
          onClick: handleHigherClick,
          disabled: !api || !isConnected || !canTrade || isPurchasing,
          isLoading: isPurchasing || isLoading,
          color: 'bg-green-500 hover:bg-green-600',
          icon: ChevronUp
        },
        negative: {
          label: 'Lower',
          proposal: putProposal,
          onClick: handleLowerClick,
          disabled: !api || !isConnected || !canTrade || isPurchasing,
          isLoading: isPurchasing || isLoading,
          color: 'bg-red-500 hover:bg-red-600',
          icon: ChevronDown
        }
      });
    }
  }, [callProposal, putProposal, isPurchasing, isLoading, canTrade, api, isConnected, onProposalsSync]);

  const actionButtons = (
    <div className="border-t border-gray-200 pt-4 flex gap-2">
      <div className="flex-1">
        <StyledTradeButton
          label="Higher"
          proposal={callProposal}
          icon={ChevronUp}
          color="bg-green-500 hover:bg-green-600"
          onClick={() => {
            // CRITICAL: Use selected account balance, not primary account balance
            const selectedAccount = getSelectedAccountFromStorage();
            let accountBalance = 0;
            
            // Priority 1: Selected account balance from localStorage
            if (selectedAccount?.balance !== undefined && selectedAccount.balance !== null) {
              accountBalance = parseFloat(selectedAccount.balance) || 0;
            }
            
            // Priority 2: Selected account balance from liveBalances
            if (accountBalance <= 0 && selectedAccount?.loginid && user?.liveBalances?.[selectedAccount.loginid]) {
              accountBalance = user.liveBalances[selectedAccount.loginid].balance || 0;
            }
            
            // Priority 3: Selected account from accounts array
            if (accountBalance <= 0 && selectedAccount?.loginid && user?.accounts) {
              const accountInList = user.accounts.find(acc => acc.loginid === selectedAccount.loginid);
              if (accountInList?.balance !== undefined && accountInList.balance !== null) {
                accountBalance = parseFloat(accountInList.balance) || 0;
              }
            }
            
            // Priority 4: Fallback to user.balance (primary account)
            if (accountBalance <= 0 && user?.balance) {
              accountBalance = user.balance;
            }
            
            const hasValidAuth = accountBalance > 0 || 
                                 (user?.token && isValidAuthToken(user.token)) || 
                                 isUserAuthenticated();
            
            if (!hasValidAuth) {
              toast({
                title: 'Login Required',
                description: 'Please log in to place trades',
                variant: 'destructive'
              });
              return;
            }
            
            if (accountBalance <= 0) {
              toast({
                title: 'Insufficient Balance',
                description: `Selected account (${selectedAccount?.loginid || user?.loginid || 'current'}) has ${accountBalance.toFixed(2)} USD. Please ensure your account has a balance greater than 0.`,
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
            handlePurchase('Higher', callProposal);
          }}
          disabled={!api || !isConnected || !user || !user.loginid || !callProposal || isPurchasing}
          isLoading={isPurchasing || isLoading}
          getPayoutPct={getPayoutPct}
          getPayoutAmount={getPayoutAmount}
        />
      </div>
      <div className="flex-1">
        <StyledTradeButton
          label="Lower"
          proposal={putProposal}
          icon={ChevronDown}
          color="bg-red-500 hover:bg-red-600"
          onClick={() => {
            // CRITICAL: Use selected account balance, not primary account balance
            const selectedAccount = getSelectedAccountFromStorage();
            let accountBalance = 0;
            
            // Priority 1: Selected account balance from localStorage
            if (selectedAccount?.balance !== undefined && selectedAccount.balance !== null) {
              accountBalance = parseFloat(selectedAccount.balance) || 0;
            }
            
            // Priority 2: Selected account balance from liveBalances
            if (accountBalance <= 0 && selectedAccount?.loginid && user?.liveBalances?.[selectedAccount.loginid]) {
              accountBalance = user.liveBalances[selectedAccount.loginid].balance || 0;
            }
            
            // Priority 3: Selected account from accounts array
            if (accountBalance <= 0 && selectedAccount?.loginid && user?.accounts) {
              const accountInList = user.accounts.find(acc => acc.loginid === selectedAccount.loginid);
              if (accountInList?.balance !== undefined && accountInList.balance !== null) {
                accountBalance = parseFloat(accountInList.balance) || 0;
              }
            }
            
            // Priority 4: Fallback to user.balance (primary account)
            if (accountBalance <= 0 && user?.balance) {
              accountBalance = user.balance;
            }
            
            const hasValidAuth = accountBalance > 0 || 
                                 (user?.token && isValidAuthToken(user.token)) || 
                                 isUserAuthenticated();
            
            if (!hasValidAuth) {
              toast({
                title: 'Login Required',
                description: 'Please log in to place trades',
                variant: 'destructive'
              });
              return;
            }
            
            if (accountBalance <= 0) {
              toast({
                title: 'Insufficient Balance',
                description: `Selected account (${selectedAccount?.loginid || user?.loginid || 'current'}) has ${accountBalance.toFixed(2)} USD. Please ensure your account has a balance greater than 0.`,
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
            handlePurchase('Lower', putProposal);
          }}
          disabled={!api || !isConnected || !user || !user.loginid || !putProposal || isPurchasing}
          isLoading={isPurchasing || isLoading}
          getPayoutPct={getPayoutPct}
          getPayoutAmount={getPayoutAmount}
        />
      </div>
    </div>
  );

  return (
    <div className="p-2 space-y-1.5">
      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
          <p className="text-xs text-yellow-800">
            ⚠️ You need to connect your account to trade
          </p>
        </div>
      )}

      <Tabs value={durationOrEndtime} onValueChange={(value) => {
        setDurationOrEndtime(value);
        // When switching to endtime, ensure default is tomorrow if not set
        if (value === 'endtime' && (!endDate || endDate <= new Date())) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(23, 59, 59, 0);
          setEndDate(tomorrow);
        }
      }}>
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
                  <span>{durationUnit === 't' ? 'Ticks' : durationUnit === 'm' ? 'Minutes' : durationUnit === 'h' ? 'Hours' : 'Days'}</span>
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="space-y-1">
                  {[
                    { value: 't', label: 'Ticks' },
                    { value: 'm', label: 'Minutes' },
                    { value: 'h', label: 'Hours' },
                    { value: 'd', label: 'Days' }
                  ].map((unit) => (
                    <Button
                      key={unit.value}
                      variant={durationUnit === unit.value ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => {
                        setDurationUnit(unit.value);
                        const minValue = unit.value === 't' ? 1 : 1;
                        if (durationValue < minValue) setDurationValue(minValue);
                      }}
                    >
                      {unit.label}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Duration Input - Show slider for ticks, input for others */}
            {durationUnit === 't' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{durationValue} {durationValue === 1 ? 'Tick' : 'Ticks'}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDurationChange(1)}
                    disabled={isLoading}
                    className="h-6 w-6"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                </div>
                {/* Slider with stop points */}
                <div className="relative">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={Math.min(Math.max(durationValue, 1), 10)}
                    onChange={(e) => setDurationValue(Math.max(1, parseInt(e.target.value)))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    disabled={isLoading}
                  />
                  {/* Stop points - ticks from 1 to 10 */}
                  <div className="flex justify-between mt-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((point) => (
                      <div
                        key={point}
                        className={cn(
                          "w-1 h-1 rounded-full",
                          point <= durationValue ? "bg-gray-700" : "bg-gray-300"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
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
                      // Minimums: 1 tick, 2 minutes, 15 seconds, 1 for hours/days
                      const minValue = durationUnit === 't' ? 1 : (durationUnit === 'm' ? 2 : 1);
                      const maxValue = durationUnit === 'm' ? 1440 : durationUnit === 'h' ? 24 : 365;
                      const val = Math.max(minValue, Math.min(maxValue, parseInt(e.target.value) || minValue));
                      setDurationValue(val);
                    }}
                    className="flex-1 text-center"
                    min={durationUnit === 't' ? 1 : (durationUnit === 'm' ? 2 : 1)}
                    max={durationUnit === 'm' ? 1440 : durationUnit === 'h' ? 24 : 365}
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
                <p className="text-xs text-gray-500">
                  {durationUnit === 't' && 'Range: 5 - 10 ticks'}
                  {durationUnit === 'm' && 'Range: 2 - 1,440 minutes'}
                  {durationUnit === 'h' && 'Range: 1 - 24 hours'}
                  {durationUnit === 'd' && 'Range: 1 - 365 days'}
                </p>
                {durationUnit === 'd' && calculateExpiry && (
                  <p className="text-xs text-gray-600">
                    Expiry: {format(calculateExpiry, "dd MMM yyyy, HH:mm:ss")} GMT +0
                  </p>
                )}
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
            {endDate && (
              <div className="text-xs text-gray-600">
                Expiry: {format(endDate, "dd MMM yyyy, HH:mm:ss")} GMT +0
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const newDate = new Date(endDate);
                  newDate.setDate(newDate.getDate() - 1);
                  if (newDate >= new Date()) {
                    setEndDate(newDate);
                  }
                }}
                disabled={isLoading || !endDate}
                className="h-8 w-8"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const newDate = new Date(endDate);
                  newDate.setDate(newDate.getDate() + 1);
                  setEndDate(newDate);
                }}
                disabled={isLoading || !endDate}
                className="h-8 w-8"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="space-y-1">
        <Label>Barrier</Label>
        <div className="relative">
          <Input
            type="number"
            step="0.01"
            value={barrier}
            onChange={handleBarrierChange}
            className={cn(
              "w-full",
              barrierError && "border-red-500 focus-visible:ring-red-500"
            )}
            disabled={isLoading}
          />
          {barrierError && (
            <div className="absolute -left-2 top-full mt-1 bg-red-500 text-white text-xs px-2 py-1 rounded shadow-lg z-10 whitespace-nowrap">
              <div className="absolute -top-1 left-4 w-2 h-2 bg-red-500 transform rotate-45"></div>
              {barrierError}
            </div>
          )}
        </div>
        {barrierError && (
          <p className="text-xs text-red-500 mt-1">{barrierError}</p>
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
              {balance && (
                <span className="text-xs text-gray-500">Balance: ${Number(balance).toFixed(2)}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleStakeChange(-1)}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                value={stake}
                onChange={e => setStake(Math.max(1, parseFloat(e.target.value) || 1))}
                className="flex-1 text-center h-8 text-sm"
                min={1}
                step="0.01"
                disabled={isLoading}
              />
              <span className="text-sm text-gray-600 ml-1">USD</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleStakeChange(1)}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="payout" className="mt-1.5">
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <Label className="text-xs">Payout (USD)</Label>
              {balance && (
                <span className="text-xs text-gray-500">Balance: ${Number(balance).toFixed(2)}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePayoutChange(-1)}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                value={payout}
                onChange={e => setPayout(Math.max(1, parseFloat(e.target.value) || 1))}
                className="flex-1 text-center h-8 text-sm"
                min={1}
                step="0.01"
                disabled={isLoading}
              />
              <span className="text-sm text-gray-600 ml-1">USD</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePayoutChange(1)}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="allow-equals-hl"
          checked={allowEquals}
          onCheckedChange={setAllowEquals}
          disabled={isLoading}
        />
        <label htmlFor="allow-equals-hl" className="text-sm font-medium">
          Allow equals
        </label>
      </div>

      {!hideActionButtons && actionButtons}

      <div className="pt-2 border-t">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Higher Payout:</span>
          <span className="font-semibold">
            {callProposal?.payout ? `$${callProposal.payout.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Lower Payout:</span>
          <span className="font-semibold">
            {putProposal?.payout ? `$${putProposal.payout.toFixed(2)}` : '—'}
          </span>
        </div>
      </div>

      {!hidePrediction && (
        <PredictionPanel
          symbol={selectedMarket?.symbol}
          tradeType={tradeType}
          aiPrediction={aiPrediction ? {
            prediction: aiPrediction.direction?.toLowerCase() || aiPrediction.prediction || 'rise',
            confidence: typeof aiPrediction.confidence === 'number' && aiPrediction.confidence > 1 
              ? aiPrediction.confidence / 100 
              : aiPrediction.confidence || 0.65
          } : { prediction: 'rise', confidence: 0.65 }}
          mode="compact"
        />
      )}
    </div>
  );
};

// Touch/No Touch Execution Component
const TouchNoTouchExecution = ({ selectedMarket, tradeType = 'touch_no_touch', aiPrediction, onBarrierChange, hidePrediction = false, onTradePlaced, hideActionButtons = false, onProposalsSync }) => {
  // Calculate initial barrier based on 7 pips minimum
  const getInitialBarrier = () => {
    if (!selectedMarket?.pip) return 0.01;
    const pip = Number(selectedMarket.pip);
    return pip * 7;
  };
  
  const [stake, setStake] = useState(10);
  const [payout, setPayout] = useState(10);
  const [stakeOrPayout, setStakeOrPayout] = useState('payout'); // Default to payout for Touch/No Touch
  const [durationValue, setDurationValue] = useState(1); // Start from 1 for ticks
  // Set default end date to tomorrow
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 0);
    return tomorrow;
  };
  const [endDate, setEndDate] = useState(getTomorrowDate());
  const [durationOrEndtime, setDurationOrEndtime] = useState('duration');
  const [durationUnit, setDurationUnit] = useState('d'); // Default to days for Touch/No Touch
  const [barrier, setBarrier] = useState(() => getInitialBarrier());
  const [barrierError, setBarrierError] = useState(null);
  const [touchProposal, setTouchProposal] = useState(null);
  const [noTouchProposal, setNoTouchProposal] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const lastTradeTimeRef = useRef(0); // Track last trade attempt time for cooldown
  const { toast } = useToast();
  const { api, connected: isConnected, user, lastTick, login, tickData } = useDerivAPI();
  // CRITICAL: Use selected account balance from localStorage (most up-to-date for selected account)
  // This ensures we use the balance for the selected account, not the first account
  const selectedAccount = getSelectedAccountFromStorage();
  const balance = selectedAccount?.balance ?? user?.balance ?? 0;
  // Get current tick from tickData (more reliable than lastTick prop which might be stale)
  const currentTick = selectedMarket?.symbol ? (tickData?.[selectedMarket.symbol] || lastTick) : lastTick;
  const prevTradeTypeRef = useRef(null);
  const isMountedRef = useRef(false);
  
  // Clear proposals immediately when tradeType changes to ensure fresh fetch
  useEffect(() => {
    setTouchProposal(null);
    setNoTouchProposal(null);
    setIsLoading(true); // Set loading to true immediately to keep buttons enabled during fetch
    // Reset prevTradeTypeRef to force fetch effect to detect the change
    prevTradeTypeRef.current = null;
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, [tradeType]);
  
  // Calculate minimum barrier offset (7 pips)
  const getMinBarrierOffset = useCallback(() => {
    if (!selectedMarket?.pip) return 0.01; // Default minimum
    const pip = Number(selectedMarket.pip);
    const minPips = 7;
    return pip * minPips;
  }, [selectedMarket?.pip]);
  
  // Update barrier when market changes to ensure it meets minimum requirement
  useEffect(() => {
    const minBarrier = getMinBarrierOffset();
    if (barrier < minBarrier) {
      setBarrier(minBarrier);
    }
  }, [selectedMarket?.pip, getMinBarrierOffset, barrier]);
  
  // Report barrier to chart
  useEffect(() => {
    if (!onBarrierChange || !selectedMarket?.symbol) {
      onBarrierChange?.([]);
      return;
    }
    
    // Always show barrier if we have a value (even 0.001)
    if (barrier !== undefined && barrier !== null) {
      // Calculate barrier price from current tick if available
      const tick = currentTick || (selectedMarket?.symbol ? tickData?.[selectedMarket.symbol] : null);
      let barrierPrice = null;
      if (tick && tick.symbol === selectedMarket.symbol && tick.quote) {
        barrierPrice = tick.quote + barrier;
      }
      
      // Always report barrier, even if price not available yet (will be calculated in TradingChart)
      onBarrierChange?.([{
        price: barrierPrice,
        barrierOffset: barrier, // Always include offset for calculation
        label: `≡ +${barrier}`,
        color: '#60A5FA', // Light blue color
        lineStyle: 2, // dashed
      }]);
    } else {
      onBarrierChange?.([]);
    }
  }, [barrier, selectedMarket?.symbol, currentTick, tickData, onBarrierChange]);

  const fetchProposal = useCallback(async (contractType) => {
    const amount = stakeOrPayout === 'payout' ? payout : stake;
    if (!selectedMarket?.symbol || amount <= 0 || !api || !isConnected) return null;

    // Validate barrier is at least 7 pips away
    const minBarrier = getMinBarrierOffset();
    if (barrier < minBarrier) {
      const pip = Number(selectedMarket.pip) || 0.0001;
      const decimals = pip === 0.00001 ? 5 : pip === 0.0001 ? 4 : pip === 0.001 ? 3 : pip === 0.01 ? 2 : 2;
      toast({
        title: 'Invalid Barrier',
        description: `Barrier must be at least 7 pips (${minBarrier.toFixed(decimals)}) away from spot price. Current: ${barrier.toFixed(decimals)}`,
        variant: 'destructive',
      });
      return null;
    }

    // Calculate duration in hours to determine if we need absolute barrier
    let durationInHours = 0;
    if (durationOrEndtime === 'duration') {
      // Convert duration to hours based on unit
      const durationMultipliers = {
        's': 1 / 3600,  // seconds to hours
        'm': 1 / 60,    // minutes to hours
        'h': 1,         // hours
        'd': 24,        // days to hours
        't': 0          // ticks - cannot determine hours, assume < 24h
      };
      durationInHours = durationValue * (durationMultipliers[durationUnit] || 0);
    } else if (endDate) {
      // Calculate hours until expiry
      const now = Date.now();
      const expiry = endDate.getTime();
      durationInHours = (expiry - now) / (1000 * 60 * 60); // milliseconds to hours
    }

    // For contracts >= 24 hours, use absolute barrier (no +/- prefix)
    // For contracts < 24 hours, use relative barrier (with +/- prefix)
    // Note: Synthetic indices (R_*) support both relative and absolute barriers
    const needsAbsoluteBarrier = durationInHours >= 24;
    let formattedBarrier;
    
    if (needsAbsoluteBarrier) {
      // Calculate absolute barrier price: current price + barrier offset
      // CRITICAL: For contracts >= 24h, we MUST have current price to calculate absolute barrier
      // Try to get current price from tickData first, then fallback to lastTick
      const tick = currentTick || (selectedMarket?.symbol ? tickData?.[selectedMarket.symbol] : null);
      
      if (tick && tick.symbol === selectedMarket.symbol && tick.quote) {
        const absoluteBarrierPrice = tick.quote + barrier;
        formattedBarrier = formatBarrierValue(absoluteBarrierPrice);
        console.log('[TouchNoTouchExecution] Using absolute barrier:', {
          contractType,
          currentPrice: tick.quote,
          barrierOffset: barrier,
          absoluteBarrier: absoluteBarrierPrice,
          formattedBarrier
        });
      } else {
        // Cannot calculate absolute barrier - return null to prevent invalid request
        console.error('[TouchNoTouchExecution] Cannot fetch proposal - need absolute barrier but no current price available', {
          contractType,
          durationInHours,
          barrier,
          hasTickData: !!tickData,
          tickDataKeys: tickData ? Object.keys(tickData) : [],
          currentTick: currentTick ? 'exists' : 'not available',
          lastTick: lastTick ? 'exists' : 'not available',
          selectedMarketSymbol: selectedMarket?.symbol
        });
        // Return null instead of using relative barrier - this will prevent the error
        return null;
      }
    } else {
      // Relative barrier for contracts < 24 hours
      formattedBarrier = barrier >= 0 ? `+${formatBarrierValue(barrier)}` : `${formatBarrierValue(barrier)}`;
    }

    const baseParams = {
      proposal: 1,
      subscribe: 1,
      amount: amount,
      basis: stakeOrPayout, // 'payout' or 'stake'
      contract_type: contractType,
      currency: 'USD',
      symbol: selectedMarket.symbol,
      // Barrier format: string matching ^(?=.{1,20}$)[+-]?[0-9]+\.?[0-9]*$
      // For contracts >= 24 hours: absolute barrier (no +/- prefix)
      // For contracts < 24 hours: relative barrier (with +/- prefix)
      barrier: formattedBarrier,
    };

    if (durationOrEndtime === 'duration') {
      baseParams.duration = durationValue;
      baseParams.duration_unit = durationUnit;
    } else if (endDate) {
      baseParams.date_expiry = Math.floor(endDate.getTime() / 1000);
      baseParams.duration = null;
    }

    try {
      const response = await api.send(baseParams);
      if (response.error) {
        const errorCode = response.error.code;
        const errorMsg = response.error.message || 'Failed to get proposal';
        
        // For AlreadySubscribed errors, check if proposal is still available in response
        // Sometimes the API returns both error and proposal
        if (errorCode === 'AlreadySubscribed' && response.proposal) {
          // Use the proposal even though there's an AlreadySubscribed error
          setBarrierError(null);
          return response.proposal;
        }
        
        // Check if it's a barrier range error
        if (errorMsg.includes('Barrier is out of acceptable range') || errorMsg.includes('barrier') || errorCode === 'InvalidBarrier') {
          setBarrierError('Barrier is out of acceptable range.');
        } else {
          setBarrierError(null);
        }
        
        // Don't show toast for rate limit or AlreadySubscribed errors
        const isRateLimit = errorCode === 'RateLimit' || errorMsg.includes('rate limit') || errorMsg.includes('RateLimit');
        const isAlreadySubscribed = errorCode === 'AlreadySubscribed' || errorMsg.includes('already subscribed');
        if (!isRateLimit && !isAlreadySubscribed && !errorMsg.includes('Barrier is out of acceptable range')) {
          const tradeTypeChanged = prevTradeTypeRef.current !== tradeType;
          if (tradeTypeChanged) {
            toast({
              title: 'Proposal Error',
              description: errorMsg,
              variant: 'destructive'
            });
          }
        }
        return null;
      } else {
        // Clear barrier error on success
        setBarrierError(null);
      }
      return response.proposal || null;
    } catch (error) {
      // Don't log expected errors (WebSocket not connected, AlreadySubscribed, RateLimit)
      const errorMessage = error?.message || error?.toString() || '';
      const errorCode = error?.code;
      const isExpectedError = 
        errorMessage.includes('WebSocket not connected') || 
        errorCode === 'AlreadySubscribed' ||
        errorCode === 'RateLimit' ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('RateLimit');
      if (!isExpectedError) {
        // Only show error if trade type actually changed
        const tradeTypeChanged = prevTradeTypeRef.current !== tradeType;
        if (tradeTypeChanged) {
          toast({
            description: error.message || 'Failed to fetch proposal',
            variant: 'destructive'
          });
        }
      } else {
      }
      return null;
    }
  }, [selectedMarket, stake, payout, stakeOrPayout, api, isConnected, barrier, durationOrEndtime, durationValue, durationUnit, endDate, toast, tradeType, getMinBarrierOffset, tickData, currentTick]);

  useEffect(() => {
    const tradeTypeChanged = prevTradeTypeRef.current !== null && prevTradeTypeRef.current !== tradeType;
    const isInitialMount = prevTradeTypeRef.current === undefined || prevTradeTypeRef.current === null;
    prevTradeTypeRef.current = tradeType;
    
    const fetchProposals = async () => {
      if (!selectedMarket?.symbol || !api || !isConnected) {
        // Clear proposals if requirements not met
        setTouchProposal(null);
        setNoTouchProposal(null);
        return;
      }
      
      // Disable trade buttons while fetching proposals
      setIsLoading(true);
      
      try {
        const [touchRes, noTouchRes] = await Promise.all([
          fetchProposal('ONETOUCH'),
          fetchProposal('NOTOUCH'),
        ]);
        
        if (isMountedRef.current) {
          setTouchProposal(touchRes);
          setNoTouchProposal(noTouchRes);
        }
      } catch (error) {
        // Don't log expected errors (WebSocket not connected, AlreadySubscribed, WrongResponse)
        const errorMessage = error?.message || error?.toString() || '';
        const errorCode = error?.code;
        const isExpectedError = 
          errorMessage.includes('WebSocket not connected') || 
          errorCode === 'AlreadySubscribed' ||
          errorCode === 'WrongResponse' ||
          errorCode === 'RateLimit' ||
          errorMessage.includes('WrongResponse') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('RateLimit');
        if (!isExpectedError) {
        } else {
        }
        // Clear proposals on error to ensure buttons are properly disabled
        if (isMountedRef.current) {
          setTouchProposal(null);
          setNoTouchProposal(null);
        }
      } finally {
        if (isMountedRef.current) {
          // Keep buttons disabled for a short time (500ms) then re-enable
          setTimeout(() => {
            if (isMountedRef.current) {
              setIsLoading(false);
            }
          }, 500);
        }
      }
    };

  // Fetch immediately on initial mount or trade type change, debounce only for parameter changes
  // Increased debounce to 800ms to prevent rate limit errors
  if (isInitialMount || tradeTypeChanged) {
    fetchProposals();
  } else {
    const timeoutId = setTimeout(fetchProposals, 800);
    return () => clearTimeout(timeoutId);
  }
  }, [fetchProposal, stakeOrPayout, stake, payout, selectedMarket?.symbol, api, isConnected, tradeType, durationValue, durationUnit, durationOrEndtime, endDate]);

  const handleStakeChange = (amount) => setStake(prev => Math.max(1, prev + amount));
  const handlePayoutChange = (amount) => setPayout(prev => Math.max(1, prev + amount));
  const handleDurationChange = (amount) => {
    // Minimums: 1 tick, 2 minutes, 15 seconds, 1 for hours/days
    const minValue = durationUnit === 't' ? 1 : (durationUnit === 'm' ? 2 : 1);
    setDurationValue(prev => Math.max(minValue, prev + amount));
  };
  const handleBarrierChange = (e) => {
    const value = parseFloat(e.target.value) || 0;
    setBarrier(value);
    // Validate barrier - will be validated against API response
    setBarrierError(null);
  };

  // Calculate expiry date from duration
  const calculateExpiry = useMemo(() => {
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

  const handlePurchase = async (direction, proposal) => {
    // Log token and wallet information when trade button is clicked
    logTradeButtonClick(user, balance, direction, proposal?.id);
    
    // Prevent duplicate requests - critical for real-time trading
    if (isPurchasing) {
      return;
    }

    // Cooldown mechanism: prevent accidental double-clicks (300ms minimum between trades)
    const now = Date.now();
    const timeSinceLastTrade = now - lastTradeTimeRef.current;
    const COOLDOWN_MS = 300; // 0.3 seconds cooldown to prevent accidental double-clicks only
    
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

    if (!api || !isConnected) {
      toast({
        title: 'Not Connected',
        description: 'Please connect to your account first',
        variant: 'destructive'
      });
      return;
    }

    // Check if user is logged in (either user state is set or token exists in localStorage)
    const hasValidToken = user?.token ? isValidAuthToken(user.token) : isUserAuthenticated();
    if (!hasValidToken) {
      toast({
        title: 'Login Required',
        description: 'Please log in to your account to place trades',
        variant: 'destructive'
      });
      return;
    }

    // CRITICAL: Use selected account balance from localStorage (most accurate for selected account)
    // This ensures we check the correct account's balance, not the first account's balance
    const selectedAccount = getSelectedAccountFromStorage();
    const currentAccountBalance = selectedAccount?.balance ?? user?.balance ?? balance ?? 0;
    
    // CRITICAL: Prevent trading if selected account doesn't match authenticated account
    if (selectedAccount && user?.loginid && selectedAccount.loginid !== user.loginid) {
      toast({
        title: 'Account Not Ready',
        description: `Please wait for account switch to complete. Selected: ${selectedAccount.loginid}, Authenticated: ${user.loginid}`,
        variant: 'destructive',
        duration: 3000,
      });
      return;
    }
    
    console.log('[TradeExecution] Current Account Balance:', currentAccountBalance,selectedAccount?.balance, user?.balance,selectedAccount?.loginid || user?.loginid,user);
    // if (currentAccountBalance <= 0) {
    //   toast({
    //     title: 'Insufficient Balance',
    //     description: `Your account balance (${currentAccountBalance.toFixed(2)} USD) is insufficient to buy this contract (${(proposal?.ask_price || stake).toFixed(2)} USD).`,
    //     variant: 'destructive'
    //   });
    //   return;
    // }

    if (!proposal?.id) {
      toast({
        title: 'No Proposal',
        description: 'Please wait for proposal to load',
        variant: 'destructive'
      });
      return;
    }

    // Check balance - use ask_price if available, otherwise use stake
    const requiredAmount = proposal?.ask_price || stake;
    if (currentAccountBalance && requiredAmount > currentAccountBalance) {
      toast({
        title: 'Insufficient Balance',
        description: `You need ${requiredAmount.toFixed(2)} USD but have ${currentAccountBalance.toFixed(2)} USD`,
        variant: 'destructive'
      });
      return;
    }

    // CRITICAL: Extract wallet information and save to localStorage
    const walletLoginid = selectedAccount?.loginid || user?.loginid || '';
    const walletAmount = currentAccountBalance || user?.balance || balance || 0;
    const walletToken = user?.token || '';
    
    // Save wallet information to localStorage
    try {
      const walletData = {
        loginid: walletLoginid,
        amount: walletAmount,
        token: walletToken,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('deriv_wallet_trade', JSON.stringify(walletData));
      
      // Console log wallet information
      console.log('[TradeExecution] Wallet Information:', {
        loginid: walletLoginid,
        amount: walletAmount,
        token: walletToken ? `${walletToken.substring(0, 20)}...` : 'No token',
        timestamp: walletData.timestamp
      });
    } catch (e) {
      console.error('[TradeExecution] Error saving wallet data to localStorage:', e);
    }

    // CRITICAL: Verify account match before placing trade
    // The Deriv API uses the account that the WebSocket is authenticated with
    // If user.loginid doesn't match selectedAccount.loginid, the API will check the wrong account's balance
    if (selectedAccount && selectedAccount.loginid && user?.loginid && user.loginid !== selectedAccount.loginid) {
      console.error('[TradeExecution] CRITICAL: Account mismatch detected!', {
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
      // buy: proposal ID from price proposal, or 1 if using parameters
      // price: Maximum price at which to purchase the contract
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

      // CRITICAL: Log account info before placing trade
      console.log('[TradeExecution] Placing trade with:', {
        selectedAccountLoginid: selectedAccount?.loginid,
        authenticatedLoginid: user?.loginid,
        balance: currentAccountBalance,
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
          // CRITICAL: Get balance from multiple sources, prioritizing accounts array
          let selectedAccountBalance = selectedAccount?.balance ?? 0;
          
          // Try accounts array first (most reliable - comes from authorize response)
          if (selectedAccount?.loginid && user?.accounts) {
            const accountInList = user.accounts.find(acc => acc.loginid === selectedAccount.loginid);
            if (accountInList?.balance !== undefined && accountInList.balance !== null) {
              const accBalance = parseFloat(accountInList.balance);
              if (!isNaN(accBalance) && accBalance > 0) {
                selectedAccountBalance = accBalance;
              }
            }
          }
          
          // Fallback to liveBalances
          if (selectedAccountBalance <= 0 && selectedAccount?.loginid && user?.liveBalances?.[selectedAccount.loginid]) {
            selectedAccountBalance = user.liveBalances[selectedAccount.loginid].balance || 0;
          }
          
          // Last fallback (but this is from primary account, not selected)
          if (selectedAccountBalance <= 0) {
            selectedAccountBalance = user?.balance ?? 0;
          }
          
          const requiredAmount = proposal?.ask_price || stake;
          
          // CRITICAL: Check if there's an account mismatch
          // The API uses the account from authorize response for balance checks, not the selected account
          const accountMismatch = selectedAccount?.loginid && user?.loginid && selectedAccount.loginid !== user.loginid;
          
          // Check if the API error message contains balance information
          const apiErrorMessage = response.error?.message || '';
          const apiBalanceMatch = apiErrorMessage.match(/balance[:\s]+([\d.]+)/i);
          const apiBalance = apiBalanceMatch ? parseFloat(apiBalanceMatch[1]) : null;
          
          // CRITICAL: The API always checks the primary account from authorize response, not the selected account
          // If the API shows 0.00 balance but our selected account has balance, it's an account mismatch
          const apiCheckedWrongAccount = apiBalance !== null && apiBalance === 0 && selectedAccountBalance >= requiredAmount;
          
          // CRITICAL: Also check if user.balance is 0 but selected account has balance
          // This indicates the API is checking the wrong account
          const primaryAccountHasZero = user?.balance === 0 && selectedAccountBalance >= requiredAmount;
          
          if (accountMismatch || apiCheckedWrongAccount || primaryAccountHasZero) {
            userMessage = `⚠️ Account Mismatch Detected! The Deriv API checked account ${user?.loginid || 'unknown'} (balance: ${apiBalance !== null ? apiBalance.toFixed(2) : (user?.balance || 0).toFixed(2)} USD), but you selected account ${selectedAccount?.loginid || 'unknown'} (balance: ${selectedAccountBalance.toFixed(2)} USD). The WebSocket is still using the primary account from the authorize response. Please refresh the page to complete the account switch, then try again.`;
          } else {
            userMessage = `Insufficient balance. Your account (${selectedAccount?.loginid || user?.loginid || 'current'}) has ${selectedAccountBalance.toFixed(2)} USD, but ${requiredAmount.toFixed(2)} USD is required.`;
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
        const accountLoginid = selectedAccount?.loginid || user?.loginid;
        if (deductBalance && buyPrice && accountLoginid) {
          deductBalance(buyPrice, accountLoginid);
        }
        
        // Request balance update from WebSocket to sync with server
        if (requestBalanceUpdate && accountLoginid) {
          requestBalanceUpdate(accountLoginid);
        }
        
        toast({
          title: `✅ ${direction} Contract Purchased`,
          description: `Contract ID: ${contractId}${payout ? ` | Payout: $${payout.toFixed(2)}` : ''}`,
        });

        // Add position to open positions
        if (onTradePlaced) {
          onTradePlaced({
            contract_id: contractId,
            buy_price: buyPrice,
            payout: payout,
            stake: stake,
            contract_type: direction === 'Stays In' ? 'RANGE' : 'UPORDOWN',
            trade_type: tradeType,
            symbol: selectedMarket.symbol,
            display_name: selectedMarket.name || selectedMarket.symbol,
            duration: durationValue,
            duration_unit: durationUnit,
            start_time: Date.now() / 1000,
            profit: 0,
            sell_price: buyPrice,
          });
        }

        // Optional: Handle subscription if response includes it
        if (response.subscription) {
        }
        
        // Refresh proposals after successful trade to update buttons with fresh proposal IDs
        if (typeof refreshProposals === 'function') {
          setTimeout(() => refreshProposals(false), 100);
        }
      } else {
        throw new Error('Invalid response: missing buy data');
      }
    } catch (error) {
      // Enhanced error logging for debugging
      
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

  // Check if user is logged in (for onClick validation)
  // Match desktop logic: allow if user exists OR localStorage has deriv_user
  // Note: Balance check is done in onClick handler, not in disabled prop
  const canTrade = useMemo(() => {
    // Check if user exists OR localStorage has deriv_user (same as desktop buttons)
    const hasValidToken = user?.token ? isValidAuthToken(user.token) : isUserAuthenticated();
    return hasValidToken;
  }, [user]);

  // Compute disabled states for buttons
  // Don't disable based on proposals - check in onClick instead (prevents buttons from being disabled when trade type changes)
  const touchDisabled = !api || !isConnected || isPurchasing;
  const noTouchDisabled = !api || !isConnected || isPurchasing;
  
  // Log button state whenever it changes for debugging
  useEffect(() => {
    console.log('[TouchNoTouchExecution] Button states:', {
      touchDisabled,
      noTouchDisabled,
      hasApi: !!api,
      isConnected,
      isPurchasing,
      isLoading,
      hasTouchProposal: !!touchProposal,
      hasNoTouchProposal: !!noTouchProposal,
      touchProposalId: touchProposal?.id || 'N/A',
      noTouchProposalId: noTouchProposal?.id || 'N/A',
      canTrade,
      balance,
      symbol: selectedMarket?.symbol
    });
  }, [touchDisabled, noTouchDisabled, api, isConnected, isPurchasing, isLoading, touchProposal, noTouchProposal, canTrade, balance, selectedMarket?.symbol]);

  // Log errors when Touch button is disabled
  useEffect(() => {
    if (touchDisabled) {
      const reasons = [];
      if (!api) reasons.push('API not available');
      if (!isConnected) reasons.push('WebSocket not connected');
      if (isPurchasing) reasons.push('Purchase in progress');
      if (!touchProposal) reasons.push('Touch proposal not available');
      if (!canTrade) reasons.push('User not authenticated or no balance');
      
      if (reasons.length > 0) {
        console.error('[TouchNoTouchExecution] Touch button disabled:', {
          reasons,
          hasApi: !!api,
          isConnected,
          isPurchasing,
          hasTouchProposal: !!touchProposal,
          canTrade,
          touchProposalId: touchProposal?.id || 'N/A',
          symbol: selectedMarket?.symbol,
          balance: balance,
          userToken: user?.token ? `${user.token.substring(0, 10)}...` : 'N/A',
          isLoading,
          barrier,
          durationValue,
          durationUnit
        });
      }
    }
  }, [touchDisabled, api, isConnected, isPurchasing, touchProposal, canTrade, balance, user, selectedMarket?.symbol, isLoading, barrier, durationValue, durationUnit]);

  // Log errors when No Touch button is disabled
  useEffect(() => {
    if (noTouchDisabled) {
      const reasons = [];
      if (!api) reasons.push('API not available');
      if (!isConnected) reasons.push('WebSocket not connected');
      if (isPurchasing) reasons.push('Purchase in progress');
      if (!noTouchProposal) reasons.push('No Touch proposal not available');
      if (!canTrade) reasons.push('User not authenticated or no balance');
      
      if (reasons.length > 0) {
        console.error('[TouchNoTouchExecution] No Touch button disabled:', {
          reasons,
          hasApi: !!api,
          isConnected,
          isPurchasing,
          hasNoTouchProposal: !!noTouchProposal,
          canTrade,
          noTouchProposalId: noTouchProposal?.id || 'N/A',
          symbol: selectedMarket?.symbol,
          balance: balance,
          userToken: user?.token ? `${user.token.substring(0, 10)}...` : 'N/A',
          isLoading,
          barrier,
          durationValue,
          durationUnit
        });
      }
    }
  }, [noTouchDisabled, api, isConnected, isPurchasing, noTouchProposal, canTrade, balance, user, selectedMarket?.symbol, isLoading, barrier, durationValue, durationUnit]);

  // Use refs to store latest function references to prevent infinite loops
  const handlePurchaseRef = useRef(handlePurchase);
  const toastRef = useRef(toast);
  
  // Update refs when functions change
  useEffect(() => {
    handlePurchaseRef.current = handlePurchase;
    toastRef.current = toast;
  }, [handlePurchase, toast]);

  // Sync proposals and button handlers to parent component for mobile footer buttons
  useEffect(() => {
    if (onProposalsSync) {
      const handleTouchClick = () => {
        if (!canTrade) {
          toastRef.current({
            title: 'Login Required',
            description: 'Please log in with an account that has a non-zero balance to place trades',
            variant: 'destructive'
          });
          return;
        }
        if (!touchProposal) {
          toastRef.current({
            title: 'Proposal Not Available',
            description: 'Please wait for the proposal to load or check your connection.',
            variant: 'destructive'
          });
          return;
        }
        if (!api || !isConnected) {
          toastRef.current({
            title: 'Not Connected',
            description: 'Please wait for connection to be established.',
            variant: 'destructive'
          });
          return;
        }
        handlePurchaseRef.current('Touch', touchProposal);
      };

      const handleNoTouchClick = () => {
        if (!canTrade) {
          toastRef.current({
            title: 'Login Required',
            description: 'Please log in with an account that has a non-zero balance to place trades',
            variant: 'destructive'
          });
          return;
        }
        if (!noTouchProposal) {
          toastRef.current({
            title: 'Proposal Not Available',
            description: 'Please wait for the proposal to load or check your connection.',
            variant: 'destructive'
          });
          return;
        }
        if (!api || !isConnected) {
          toastRef.current({
            title: 'Not Connected',
            description: 'Please wait for connection to be established.',
            variant: 'destructive'
          });
          return;
        }
        handlePurchaseRef.current('No Touch', noTouchProposal);
      };

      onProposalsSync({
        positive: {
          label: 'Touch',
          proposal: touchProposal,
          onClick: handleTouchClick,
          disabled: touchDisabled,
          isLoading: isPurchasing,
          color: 'bg-teal-500 hover:bg-teal-600',
          icon: Target
        },
        negative: {
          label: 'No Touch',
          proposal: noTouchProposal,
          onClick: handleNoTouchClick,
          disabled: noTouchDisabled,
          isLoading: isPurchasing,
          color: 'bg-red-500 hover:bg-red-600',
          icon: X
        }
      });
    }
  }, [touchProposal, noTouchProposal, touchDisabled, noTouchDisabled, isPurchasing, canTrade, api, isConnected, onProposalsSync]);

  return (
    <div className="p-2 space-y-1.5">
      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
          <p className="text-xs text-yellow-800">
            ⚠️ You need to connect your account to trade
          </p>
        </div>
      )}

      <Tabs value={durationOrEndtime} onValueChange={(value) => {
        setDurationOrEndtime(value);
        if (value === 'endtime' && (!endDate || endDate <= new Date())) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(23, 59, 59, 0);
          setEndDate(tomorrow);
        }
      }}>
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
                  <span>{durationUnit === 't' ? 'Ticks' : durationUnit === 'm' ? 'Minutes' : durationUnit === 'h' ? 'Hours' : 'Days'}</span>
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="space-y-1">
                  {[
                    { value: 't', label: 'Ticks' },
                    { value: 'm', label: 'Minutes' },
                    { value: 'h', label: 'Hours' },
                    { value: 'd', label: 'Days' }
                  ].map((unit) => (
                    <Button
                      key={unit.value}
                      variant={durationUnit === unit.value ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => {
                        setDurationUnit(unit.value);
                        const minValue = unit.value === 't' ? 1 : 1;
                        if (durationValue < minValue) setDurationValue(minValue);
                      }}
                    >
                      {unit.label}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Duration Input - Show slider for ticks, input for others */}
            {durationUnit === 't' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{durationValue} {durationValue === 1 ? 'Tick' : 'Ticks'}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDurationChange(1)}
                    disabled={isLoading}
                    className="h-6 w-6"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                </div>
                {/* Slider with stop points */}
                <div className="relative">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={Math.min(Math.max(durationValue, 1), 10)}
                    onChange={(e) => setDurationValue(Math.max(1, parseInt(e.target.value)))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    disabled={isLoading}
                  />
                  {/* Stop points - ticks from 1 to 10 */}
                  <div className="flex justify-between mt-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((point) => (
                      <div
                        key={point}
                        className={cn(
                          "w-1 h-1 rounded-full",
                          point <= durationValue ? "bg-gray-700" : "bg-gray-300"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
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
                      // Minimums: 1 tick, 2 minutes, 15 seconds, 1 for hours/days
                      const minValue = durationUnit === 't' ? 1 : (durationUnit === 'm' ? 2 : 1);
                      const maxValue = durationUnit === 'm' ? 1440 : durationUnit === 'h' ? 24 : 365;
                      const val = Math.max(minValue, Math.min(maxValue, parseInt(e.target.value) || minValue));
                      setDurationValue(val);
                    }}
                    className="flex-1 text-center"
                    min={durationUnit === 't' ? 1 : (durationUnit === 'm' ? 2 : 1)}
                    max={durationUnit === 'm' ? 1440 : durationUnit === 'h' ? 24 : 365}
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
                <p className="text-xs text-gray-500">
                  {durationUnit === 't' && 'Range: 5 - 10 ticks'}
                  {durationUnit === 'm' && 'Range: 2 - 1,440 minutes'}
                  {durationUnit === 'h' && 'Range: 1 - 24 hours'}
                  {durationUnit === 'd' && 'Range: 1 - 365 days'}
                </p>
                {durationUnit === 'd' && calculateExpiry && (
                  <p className="text-xs text-gray-600">
                    Expiry: {format(calculateExpiry, "dd MMM yyyy, HH:mm:ss")} GMT +0
                  </p>
                )}
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
                  {endDate ? format(endDate, "dd MMM yyyy, HH:mm:ss 'GMT'xxx") : 'Pick expiry time'}
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
                  const newDate = new Date(endDate);
                  newDate.setDate(newDate.getDate() - 1);
                  if (newDate >= new Date()) {
                    setEndDate(newDate);
                  }
                }}
                disabled={isLoading || !endDate}
                className="h-8 w-8"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="text"
                value={endDate ? format(endDate, "dd MMM yyyy") : ''}
                readOnly
                className="w-full text-center"
                disabled={isLoading}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const newDate = new Date(endDate);
                  newDate.setDate(newDate.getDate() + 1);
                  setEndDate(newDate);
                }}
                disabled={isLoading || !endDate}
                className="h-8 w-8"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="space-y-1">
        <Label>Barrier</Label>
        <div className="relative">
          <Input
            type="number"
            step="0.01"
            value={barrier}
            onChange={handleBarrierChange}
            className={cn(
              "w-full",
              barrierError && "border-red-500 focus-visible:ring-red-500"
            )}
            disabled={isLoading}
          />
          {barrierError && (
            <div className="absolute -left-2 top-full mt-1 bg-red-500 text-white text-xs px-2 py-1 rounded shadow-lg z-10 whitespace-nowrap">
              <div className="absolute -top-1 left-4 w-2 h-2 bg-red-500 transform rotate-45"></div>
              {barrierError}
            </div>
          )}
        </div>
        {barrierError && (
          <p className="text-xs text-red-500 mt-1">{barrierError}</p>
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
              {balance && (
                <span className="text-xs text-gray-500">Balance: ${Number(balance).toFixed(2)}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleStakeChange(-1)}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                value={stake}
                onChange={e => setStake(Math.max(1, parseFloat(e.target.value) || 1))}
                className="flex-1 text-center h-8 text-sm"
                min={1}
                step="0.01"
                disabled={isLoading}
              />
              <span className="text-sm text-gray-600 ml-1">USD</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleStakeChange(1)}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="payout" className="mt-1.5">
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <Label className="text-xs">Payout (USD)</Label>
              {balance && (
                <span className="text-xs text-gray-500">Balance: ${Number(balance).toFixed(2)}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePayoutChange(-1)}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                value={payout}
                onChange={e => setPayout(Math.max(1, parseFloat(e.target.value) || 1))}
                className="flex-1 text-center h-8 text-sm"
                min={1}
                step="0.01"
                disabled={isLoading}
              />
              <span className="text-sm text-gray-600 ml-1">USD</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePayoutChange(1)}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {!hideActionButtons && (
        <div className="border-t border-gray-200 pt-4 flex gap-2">
            {/* Touch Button */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-600">Stake</span>
                  <span className="text-xs font-semibold text-gray-900">
                    {touchProposal?.ask_price ? `${touchProposal.ask_price.toFixed(2)} USD` : '—'}
                  </span>
                  <ChevronDown className="h-3 w-3 text-red-500" />
                </div>
                <Info className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <StyledTradeButton
                label="Touch"
                proposal={touchProposal}
                icon={Target}
                color="bg-teal-500 hover:bg-teal-600"
                onClick={() => {
                  console.log('[TouchNoTouchExecution] Touch button clicked', {
                    touchDisabled,
                    canTrade,
                    hasTouchProposal: !!touchProposal,
                    hasApi: !!api,
                    isConnected,
                    isPurchasing,
                    isLoading
                  });
                  
                  if (!canTrade) {
                    console.error('[TouchNoTouchExecution] Touch button clicked but canTrade is false:', {
                      hasUser: !!user,
                      hasToken: !!user?.token,
                      balance,
                      isAuthenticated: isUserAuthenticated()
                    });
                    toast({
                      title: 'Login Required',
                      description: 'Please log in with an account that has a non-zero balance to place trades',
                      variant: 'destructive'
                    });
                    return;
                  }
                  if (!touchProposal) {
                    console.error('[TouchNoTouchExecution] Touch button clicked but proposal is null', {
                      isLoading,
                      hasApi: !!api,
                      isConnected,
                      symbol: selectedMarket?.symbol,
                      barrier,
                      durationValue,
                      durationUnit
                    });
                    toast({
                      title: 'Proposal Not Available',
                      description: 'Please wait for the proposal to load or check your connection.',
                      variant: 'destructive'
                    });
                    return;
                  }
                  if (!api || !isConnected) {
                    console.error('[TouchNoTouchExecution] Touch button clicked but API not ready:', {
                      hasApi: !!api,
                      isConnected
                    });
                    toast({
                      title: 'Not Connected',
                      description: 'Please wait for connection to be established.',
                      variant: 'destructive'
                    });
                    return;
                  }
                  handlePurchase('Touch', touchProposal);
                }}
                disabled={touchDisabled}
                isLoading={isPurchasing}
                // Note: Only show loading spinner for purchases, not for proposal loading
                // Don't disable based on proposal - check in onClick instead
                getPayoutPct={getPayoutPct}
                getPayoutAmount={(proposal) => {
                  if (!proposal || !proposal.payout) return '—';
                  return proposal.payout.toFixed(2);
                }}
              />
            </div>
            {/* No Touch Button */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-600">Stake</span>
                  <span className="text-xs font-semibold text-gray-900">
                    {noTouchProposal?.ask_price ? `${noTouchProposal.ask_price.toFixed(2)} USD` : '—'}
                  </span>
                  <ChevronUp className="h-3 w-3 text-green-500" />
                </div>
                <Info className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <StyledTradeButton
                label="No Touch"
                proposal={noTouchProposal}
                icon={X}
                color="bg-red-500 hover:bg-red-600"
                onClick={() => {
                  console.log('[TouchNoTouchExecution] No Touch button clicked', {
                    noTouchDisabled,
                    canTrade,
                    hasNoTouchProposal: !!noTouchProposal,
                    hasApi: !!api,
                    isConnected,
                    isPurchasing,
                    isLoading
                  });
                  
                  if (!canTrade) {
                    console.error('[TouchNoTouchExecution] No Touch button clicked but canTrade is false:', {
                      hasUser: !!user,
                      hasToken: !!user?.token,
                      balance,
                      isAuthenticated: isUserAuthenticated()
                    });
                    toast({
                      title: 'Login Required',
                      description: 'Please log in with an account that has a non-zero balance to place trades',
                      variant: 'destructive'
                    });
                    return;
                  }
                  if (!noTouchProposal) {
                    console.error('[TouchNoTouchExecution] No Touch button clicked but proposal is null', {
                      isLoading,
                      hasApi: !!api,
                      isConnected,
                      symbol: selectedMarket?.symbol,
                      barrier,
                      durationValue,
                      durationUnit
                    });
                    toast({
                      title: 'Proposal Not Available',
                      description: 'Please wait for the proposal to load or check your connection.',
                      variant: 'destructive'
                    });
                    return;
                  }
                  if (!api || !isConnected) {
                    console.error('[TouchNoTouchExecution] No Touch button clicked but API not ready:', {
                      hasApi: !!api,
                      isConnected
                    });
                    toast({
                      title: 'Not Connected',
                      description: 'Please wait for connection to be established.',
                      variant: 'destructive'
                    });
                    return;
                  }
                  handlePurchase('No Touch', noTouchProposal);
                }}
                disabled={noTouchDisabled}
                isLoading={isPurchasing}
                // Note: Only show loading spinner for purchases, not for proposal loading
                // Don't disable based on proposal - check in onClick instead
                getPayoutPct={getPayoutPct}
                getPayoutAmount={(proposal) => {
                  if (!proposal || !proposal.payout) return '—';
                  return proposal.payout.toFixed(2);
                }}
              />
            </div>
        </div>
      )}

      {!hidePrediction && (
        <PredictionPanel
          symbol={selectedMarket?.symbol}
          tradeType={tradeType}
          aiPrediction={aiPrediction ? {
            prediction: aiPrediction.direction?.toLowerCase() || aiPrediction.prediction || 'rise',
            confidence: typeof aiPrediction.confidence === 'number' && aiPrediction.confidence > 1 
              ? aiPrediction.confidence / 100 
              : aiPrediction.confidence || 0.65
          } : { prediction: 'rise', confidence: 0.65 }}
          mode="compact"
        />
      )}
    </div>
  );
};

// Ends In/Out Execution Component  
const EndsInOutExecution = ({ selectedMarket, tradeType = 'ends_in_out', aiPrediction, onBarrierChange, hidePrediction = false, onTradePlaced, hideActionButtons = false, onProposalsSync }) => {
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
  const [barrier, setBarrier] = useState(0.01);
  const [barrierError, setBarrierError] = useState(null);
  const [endsInProposal, setEndsInProposal] = useState(null);
  const [endsOutProposal, setEndsOutProposal] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const lastTradeTimeRef = useRef(0); // Track last trade attempt time for cooldown
  const { toast } = useToast();
  const { api, connected: isConnected, user, lastTick, login } = useDerivAPI();
  // CRITICAL: Use selected account balance from localStorage (most up-to-date for selected account)
  // This ensures we use the balance for the selected account, not the first account
  const selectedAccount = getSelectedAccountFromStorage();
  const balance = selectedAccount?.balance ?? user?.balance ?? 0;
  const prevTradeTypeRef = useRef(null);
  const isMountedRef = useRef(false);
  
  // Clear proposals immediately when tradeType changes to ensure fresh fetch
  useEffect(() => {
    setEndsInProposal(null);
    setEndsOutProposal(null);
    setIsLoading(true); // Set loading to true immediately to keep buttons enabled during fetch
    // Reset prevTradeTypeRef to force fetch effect to detect the change
    prevTradeTypeRef.current = null;
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, [tradeType]);
  
  // Report barrier to chart
  useEffect(() => {
    if (!onBarrierChange || !selectedMarket?.symbol) {
      onBarrierChange?.([]);
      return;
    }
    
    // Always show barrier if we have a value (even 0.001)
    if (barrier !== undefined && barrier !== null) {
      // Calculate barrier price from lastTick if available
      let barrierPrice = null;
      if (lastTick && lastTick.symbol === selectedMarket.symbol && lastTick.quote) {
        barrierPrice = lastTick.quote + barrier;
      }
      
      // Always report barrier, even if price not available yet (will be calculated in TradingChart)
      onBarrierChange?.([{
        price: barrierPrice,
        barrierOffset: barrier, // Always include offset for calculation
        label: `≡ +${barrier}`,
        color: '#60A5FA', // Light blue color
        lineStyle: 2, // dashed
      }]);
    } else {
      onBarrierChange?.([]);
    }
  }, [barrier, selectedMarket?.symbol, lastTick, onBarrierChange]);

  const fetchProposal = useCallback(async (contractType) => {
    const amount = stakeOrPayout === 'payout' ? payout : stake;
    if (!selectedMarket?.symbol || amount <= 0 || !api || !isConnected) return null;

    // For EXPIRYRANGE/EXPIRYMISS, double barrier is required
    // Format: "+high,-low" where both are relative to current price
    // Each barrier value must match the regex: ^(?=.{1,20}$)[+-]?[0-9]+\.?[0-9]*$
    // Use formatBarrierValue helper to ensure proper formatting that matches the regex
    const absBarrier = Math.max(0.01, Math.abs(barrier));
    const barrierValue = formatBarrierValue(absBarrier);
    // Ensure we have a valid value (formatBarrierValue returns '0' for invalid, so use minimum)
    const validBarrier = (barrierValue && barrierValue !== '0' && !isNaN(parseFloat(barrierValue))) ? barrierValue : '0.01';
    // Format double barrier: "+value,-value" (comma-separated, no spaces)
    // The API should parse this and validate each part against the regex
    const formattedBarrier = `+${validBarrier},-${validBarrier}`;
    
    const baseParams = {
      proposal: 1,
      subscribe: 1,
      amount: amount,
      basis: stakeOrPayout,
      contract_type: contractType,
      currency: 'USD',
      symbol: selectedMarket.symbol,
      barrier: formattedBarrier,
    };

    if (durationOrEndtime === 'duration') {
      baseParams.duration = durationValue;
      baseParams.duration_unit = durationUnit;
    } else if (endDate) {
      baseParams.date_expiry = Math.floor(endDate.getTime() / 1000);
      baseParams.duration = null;
    }

    try {
      const response = await api.send(baseParams);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.proposal || null;
    } catch (error) {
      // Don't log expected errors (WebSocket not connected, AlreadySubscribed)
      const errorMessage = error?.message || error?.toString() || '';
      const errorCode = error?.code;
      const isExpectedError = errorMessage.includes('WebSocket not connected') || errorCode === 'AlreadySubscribed';
      if (!isExpectedError) {
      }
      // Only show error if trade type actually changed
      const tradeTypeChanged = prevTradeTypeRef.current !== tradeType;
      if (tradeTypeChanged) {
        toast({
          description: error.message || 'Failed to fetch proposal',
          variant: 'destructive'
        });
      }
      return null;
    }
  }, [selectedMarket, stake, api, isConnected, barrier, durationOrEndtime, durationValue, durationUnit, endDate, toast, tradeType]);

  useEffect(() => {
    const tradeTypeChanged = prevTradeTypeRef.current !== null && prevTradeTypeRef.current !== tradeType;
    const isInitialMount = prevTradeTypeRef.current === undefined || prevTradeTypeRef.current === null;
    prevTradeTypeRef.current = tradeType;
    
    const fetchProposals = async () => {
      if (!selectedMarket?.symbol || !api || !isConnected) {
        // Clear proposals if requirements not met
        setEndsInProposal(null);
        setEndsOutProposal(null);
        return;
      }
      
      setIsLoading(true);
      try {
        const [endsInRes, endsOutRes] = await Promise.all([
          fetchProposal('EXPIRYRANGE'),
          fetchProposal('EXPIRYMISS'),
        ]);
        
        if (isMountedRef.current) {
          setEndsInProposal(endsInRes);
          setEndsOutProposal(endsOutRes);
        }
      } catch (error) {
        // Don't log expected errors (WebSocket not connected, AlreadySubscribed, WrongResponse)
        const errorMessage = error?.message || error?.toString() || '';
        const errorCode = error?.code;
        const isExpectedError = 
          errorMessage.includes('WebSocket not connected') || 
          errorCode === 'AlreadySubscribed' ||
          errorCode === 'WrongResponse' ||
          errorCode === 'RateLimit' ||
          errorMessage.includes('WrongResponse') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('RateLimit');
        if (!isExpectedError) {
        } else {
        }
        // Clear proposals on error to ensure buttons are properly disabled
        if (isMountedRef.current) {
          setEndsInProposal(null);
          setEndsOutProposal(null);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    // Fetch immediately on initial mount or trade type change, debounce only for parameter changes
    // Increased debounce to 800ms to prevent rate limit errors
    if (isInitialMount || tradeTypeChanged) {
      fetchProposals();
    } else {
      const timeoutId = setTimeout(fetchProposals, 800);
      return () => clearTimeout(timeoutId);
    }
  }, [fetchProposal, stakeOrPayout, stake, payout, selectedMarket?.symbol, api, isConnected, tradeType, durationValue, durationUnit, durationOrEndtime, endDate]);

  const handleStakeChange = (amount) => setStake(prev => Math.max(1, prev + amount));
  const handlePayoutChange = (amount) => setPayout(prev => Math.max(1, prev + amount));
  const handleDurationChange = (amount) => {
    const minValue = durationUnit === 't' ? 1 : (durationUnit === 'm' ? 1 : (durationUnit === 'h' ? 1 : 1));
    setDurationValue(prev => Math.max(minValue, prev + amount));
  };
  const handleBarrierChange = (e) => {
    const value = parseFloat(e.target.value) || 0;
    setBarrier(value);
    // Validate barrier - will be validated against API response
    setBarrierError(null);
  };

  // Calculate expiry date from duration
  const calculateExpiry = useMemo(() => {
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

  const handlePurchase = async (direction, proposal) => {
    // Log token and wallet information when trade button is clicked
    logTradeButtonClick(user, balance, direction, proposal?.id);
    
    // Prevent duplicate requests - critical for real-time trading
    if (isPurchasing) {
      return;
    }

    // Cooldown mechanism: prevent accidental double-clicks (300ms minimum between trades)
    const now = Date.now();
    const timeSinceLastTrade = now - lastTradeTimeRef.current;
    const COOLDOWN_MS = 300; // 0.3 seconds cooldown to prevent accidental double-clicks only
    
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

    if (!api || !isConnected) {
      toast({
        title: 'Not Connected',
        description: 'Please connect to your account first',
        variant: 'destructive'
      });
      return;
    }

    // Check if user is logged in (either user state is set or token exists in localStorage)
    const hasValidToken = user?.token ? isValidAuthToken(user.token) : isUserAuthenticated();
    if (!hasValidToken) {
      toast({
        title: 'Login Required',
        description: 'Please log in to your account to place trades',
        variant: 'destructive'
      });
      return;
    }

    // CRITICAL: Use selected account balance from localStorage (most accurate for selected account)
    // This ensures we check the correct account's balance, not the first account's balance
    const selectedAccount = getSelectedAccountFromStorage();
    const currentAccountBalance = selectedAccount?.balance ?? user?.balance ?? balance ?? 0;
   console.log('[TradeExecution] Current Account Balance:', currentAccountBalance,selectedAccount?.balance, user?.balance,selectedAccount?.loginid || user?.loginid,user);
    // if (currentAccountBalance <= 0) {
    //   toast({
    //     title: 'Insufficient Balance',
    //     description: `Your account balance (${currentAccountBalance.toFixed(2)} USD) is insufficient to buy this contract (${(proposal?.ask_price || stake).toFixed(2)} USD).`,
    //     variant: 'destructive'
    //   });
    //   return;
    // }

    if (!proposal?.id) {
      toast({
        title: 'No Proposal',
        description: 'Please wait for proposal to load',
        variant: 'destructive'
      });
      return;
    }

    // Check balance - use ask_price if available, otherwise use stake
    const requiredAmount = proposal?.ask_price || stake;
    if (currentAccountBalance && requiredAmount > currentAccountBalance) {
      toast({
        title: 'Insufficient Balance',
        description: `You need ${requiredAmount.toFixed(2)} USD but have ${currentAccountBalance.toFixed(2)} USD`,
        variant: 'destructive'
      });
      return;
    }

    // CRITICAL: Extract wallet information and save to localStorage
    const walletLoginid = selectedAccount?.loginid || user?.loginid || '';
    const walletAmount = currentAccountBalance || user?.balance || balance || 0;
    const walletToken = user?.token || '';
    
    // Save wallet information to localStorage
    try {
      const walletData = {
        loginid: walletLoginid,
        amount: walletAmount,
        token: walletToken,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('deriv_wallet_trade', JSON.stringify(walletData));
      
      // Console log wallet information
      console.log('[TradeExecution] Wallet Information:', {
        loginid: walletLoginid,
        amount: walletAmount,
        token: walletToken ? `${walletToken.substring(0, 20)}...` : 'No token',
        timestamp: walletData.timestamp
      });
    } catch (e) {
      console.error('[TradeExecution] Error saving wallet data to localStorage:', e);
    }

    // CRITICAL: Verify account match before placing trade
    // The Deriv API uses the account that the WebSocket is authenticated with
    // If user.loginid doesn't match selectedAccount.loginid, the API will check the wrong account's balance
    if (selectedAccount && selectedAccount.loginid && user?.loginid && user.loginid !== selectedAccount.loginid) {
      console.error('[TradeExecution] CRITICAL: Account mismatch detected!', {
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
      // buy: proposal ID from price proposal, or 1 if using parameters
      // price: Maximum price at which to purchase the contract
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

      // CRITICAL: Log account info before placing trade
      console.log('[TradeExecution] Placing trade with:', {
        selectedAccountLoginid: selectedAccount?.loginid,
        authenticatedLoginid: user?.loginid,
        balance: currentAccountBalance,
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
          // CRITICAL: Get balance from multiple sources, prioritizing accounts array
          let selectedAccountBalance = selectedAccount?.balance ?? 0;
          
          // Try accounts array first (most reliable - comes from authorize response)
          if (selectedAccount?.loginid && user?.accounts) {
            const accountInList = user.accounts.find(acc => acc.loginid === selectedAccount.loginid);
            if (accountInList?.balance !== undefined && accountInList.balance !== null) {
              const accBalance = parseFloat(accountInList.balance);
              if (!isNaN(accBalance) && accBalance > 0) {
                selectedAccountBalance = accBalance;
              }
            }
          }
          
          // Fallback to liveBalances
          if (selectedAccountBalance <= 0 && selectedAccount?.loginid && user?.liveBalances?.[selectedAccount.loginid]) {
            selectedAccountBalance = user.liveBalances[selectedAccount.loginid].balance || 0;
          }
          
          // Last fallback (but this is from primary account, not selected)
          if (selectedAccountBalance <= 0) {
            selectedAccountBalance = user?.balance ?? 0;
          }
          
          const requiredAmount = proposal?.ask_price || stake;
          
          // CRITICAL: Check if there's an account mismatch
          // The API uses the account from authorize response for balance checks, not the selected account
          const accountMismatch = selectedAccount?.loginid && user?.loginid && selectedAccount.loginid !== user.loginid;
          
          // Check if the API error message contains balance information
          const apiErrorMessage = response.error?.message || '';
          const apiBalanceMatch = apiErrorMessage.match(/balance[:\s]+([\d.]+)/i);
          const apiBalance = apiBalanceMatch ? parseFloat(apiBalanceMatch[1]) : null;
          
          // CRITICAL: The API always checks the primary account from authorize response, not the selected account
          // If the API shows 0.00 balance but our selected account has balance, it's an account mismatch
          const apiCheckedWrongAccount = apiBalance !== null && apiBalance === 0 && selectedAccountBalance >= requiredAmount;
          
          // CRITICAL: Also check if user.balance is 0 but selected account has balance
          // This indicates the API is checking the wrong account
          const primaryAccountHasZero = user?.balance === 0 && selectedAccountBalance >= requiredAmount;
          
          if (accountMismatch || apiCheckedWrongAccount || primaryAccountHasZero) {
            userMessage = `⚠️ Account Mismatch Detected! The Deriv API checked account ${user?.loginid || 'unknown'} (balance: ${apiBalance !== null ? apiBalance.toFixed(2) : (user?.balance || 0).toFixed(2)} USD), but you selected account ${selectedAccount?.loginid || 'unknown'} (balance: ${selectedAccountBalance.toFixed(2)} USD). The WebSocket is still using the primary account from the authorize response. Please refresh the page to complete the account switch, then try again.`;
          } else {
            userMessage = `Insufficient balance. Your account (${selectedAccount?.loginid || user?.loginid || 'current'}) has ${selectedAccountBalance.toFixed(2)} USD, but ${requiredAmount.toFixed(2)} USD is required.`;
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
        const accountLoginid = selectedAccount?.loginid || user?.loginid;
        if (deductBalance && buyPrice && accountLoginid) {
          deductBalance(buyPrice, accountLoginid);
        }
        
        // Request balance update from WebSocket to sync with server
        if (requestBalanceUpdate && accountLoginid) {
          requestBalanceUpdate(accountLoginid);
        }
        
        toast({
          title: `✅ ${direction} Contract Purchased`,
          description: `Contract ID: ${contractId}${payout ? ` | Payout: $${payout.toFixed(2)}` : ''}`,
        });

        // Add position to open positions
        if (onTradePlaced) {
          onTradePlaced({
            contract_id: contractId,
            buy_price: buyPrice,
            payout: payout,
            stake: stake,
            contract_type: direction === 'Stays In' ? 'RANGE' : 'UPORDOWN',
            trade_type: tradeType,
            symbol: selectedMarket.symbol,
            display_name: selectedMarket.name || selectedMarket.symbol,
            duration: durationValue,
            duration_unit: durationUnit,
            start_time: Date.now() / 1000,
            profit: 0,
            sell_price: buyPrice,
          });
        }

        // Optional: Handle subscription if response includes it
        if (response.subscription) {
        }
        
        // Refresh proposals after successful trade to update buttons with fresh proposal IDs
        if (typeof refreshProposals === 'function') {
          setTimeout(() => refreshProposals(false), 100);
        }
      } else {
        throw new Error('Invalid response: missing buy data');
      }
    } catch (error) {
      // Enhanced error logging for debugging
      
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

  // Check if user is logged in (for onClick validation)
  // Match desktop logic: allow if user exists OR localStorage has deriv_user
  // Note: Balance check is done in onClick handler, not in disabled prop
  const canTrade = useMemo(() => {
    // Check if user exists OR localStorage has deriv_user (same as desktop buttons)
    const hasValidToken = user?.token ? isValidAuthToken(user.token) : isUserAuthenticated();
    return hasValidToken;
  }, [user]);

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
        <Label>Barrier</Label>
        <Input
          type="number"
          step="0.01"
          value={barrier}
          onChange={handleBarrierChange}
          className={cn("w-full", barrierError && "border-red-500")}
          min={0.01}
          disabled={isLoading}
        />
        {barrierError && (
          <p className="text-xs text-red-500 mt-1">{barrierError}</p>
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
              <Button onClick={() => handleStakeChange(-1)}><Minus /></Button>
              <Input type="number" value={stake} onChange={e => setStake(Math.max(1, parseFloat(e.target.value) || 1))} className="flex-1 text-center" />
              <Button onClick={() => handleStakeChange(1)}><Plus /></Button>
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
              <Button onClick={() => handlePayoutChange(-1)}><Minus /></Button>
              <Input type="number" value={payout} onChange={e => setPayout(Math.max(1, parseFloat(e.target.value) || 1))} className="flex-1 text-center" />
              <Button onClick={() => handlePayoutChange(1)}><Plus /></Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {!hideActionButtons && (
        <div className="border-t border-gray-200 pt-4 flex gap-2">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-gray-600">
                Stake {stake.toFixed(2)} USD <ChevronUp className="h-3 w-3 text-green-500 inline-block ml-1" />
              </span>
              <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full p-0 hover:bg-gray-100 flex-shrink-0">
                <Info className="h-2.5 w-2.5 text-gray-400" />
              </Button>
            </div>
            <StyledTradeButton
              label="Ends In"
              proposal={endsInProposal}
              icon={ChevronUp}
              color="bg-green-500 hover:bg-green-600"
              onClick={() => {
                if (!canTrade) {
                  toast({
                    title: 'Login Required',
                    description: 'Please log in with an account that has a non-zero balance to place trades',
                    variant: 'destructive'
                  });
                  return;
                }
                if (!endsInProposal) {
                  toast({
                    title: 'Proposal Not Available',
                    description: 'Please wait for the proposal to load or check your connection.',
                    variant: 'destructive'
                  });
                  return;
                }
                handlePurchase('Ends In', endsInProposal);
              }}
              disabled={!api || !isConnected || isPurchasing}
              isLoading={isPurchasing || isLoading}
              getPayoutPct={getPayoutPct}
              getPayoutAmount={(proposal) => {
                if (!proposal || !proposal.payout) return '—';
                return proposal.payout.toFixed(2);
              }}
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
              label="Ends Out"
              proposal={endsOutProposal}
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
                if (!endsOutProposal) {
                  toast({
                    title: 'Proposal Not Available',
                    description: 'Please wait for the proposal to load or check your connection.',
                    variant: 'destructive'
                  });
                  return;
                }
                handlePurchase('Ends Out', endsOutProposal);
              }}
              disabled={!api || !isConnected || isPurchasing}
              isLoading={isPurchasing || isLoading}
              getPayoutPct={getPayoutPct}
              getPayoutAmount={(proposal) => {
                if (!proposal || !proposal.payout) return '—';
                return proposal.payout.toFixed(2);
              }}
            />
          </div>
        </div>
      )}

      {!hidePrediction && (
        <PredictionPanel
          symbol={selectedMarket?.symbol}
          tradeType={tradeType}
          aiPrediction={aiPrediction ? {
            prediction: aiPrediction.direction?.toLowerCase() || aiPrediction.prediction || 'rise',
            confidence: typeof aiPrediction.confidence === 'number' && aiPrediction.confidence > 1 
              ? aiPrediction.confidence / 100 
              : aiPrediction.confidence || 0.65
          } : { prediction: 'rise', confidence: 0.65 }}
          mode="compact"
        />
      )}
    </div>
  );
};

// Stays In/Goes Out Execution Component
const StaysInGoesOutExecution = ({ selectedMarket, tradeType = 'stays_in_goes_out', aiPrediction, onBarrierChange, hidePrediction = false, onTradePlaced, hideActionButtons = false, onProposalsSync }) => {
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
  const [barrier, setBarrier] = useState(0.01);
  const [barrierError, setBarrierError] = useState(null);
  const [staysInProposal, setStaysInProposal] = useState(null);
  const [goesOutProposal, setGoesOutProposal] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const lastTradeTimeRef = useRef(0); // Track last trade attempt time for cooldown
  const { toast } = useToast();
  const { api, connected: isConnected, user, lastTick, login } = useDerivAPI();
  // CRITICAL: Use selected account balance from localStorage (most up-to-date for selected account)
  // This ensures we use the balance for the selected account, not the first account
  const selectedAccount = getSelectedAccountFromStorage();
  const balance = selectedAccount?.balance ?? user?.balance ?? 0;
  const prevTradeTypeRef = useRef(null);
  const isMountedRef = useRef(false);
  
  // Clear proposals immediately when tradeType changes to ensure fresh fetch
  useEffect(() => {
    setStaysInProposal(null);
    setGoesOutProposal(null);
    setIsLoading(true); // Set loading to true immediately to keep buttons enabled during fetch
    // Reset prevTradeTypeRef to force fetch effect to detect the change
    prevTradeTypeRef.current = null;
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, [tradeType]);
  
  // Report barrier to chart
  useEffect(() => {
    if (!onBarrierChange || !selectedMarket?.symbol) {
      onBarrierChange?.([]);
      return;
    }
    
    // Always show barrier if we have a value (even 0.001)
    if (barrier !== undefined && barrier !== null) {
      // Calculate barrier price from lastTick if available
      let barrierPrice = null;
      if (lastTick && lastTick.symbol === selectedMarket.symbol && lastTick.quote) {
        barrierPrice = lastTick.quote + barrier;
      }
      
      // Always report barrier, even if price not available yet (will be calculated in TradingChart)
      onBarrierChange?.([{
        price: barrierPrice,
        barrierOffset: barrier, // Always include offset for calculation
        label: `≡ +${barrier}`,
        color: '#60A5FA', // Light blue color
        lineStyle: 2, // dashed
      }]);
    } else {
      onBarrierChange?.([]);
    }
  }, [barrier, selectedMarket?.symbol, lastTick, onBarrierChange]);

  const fetchProposal = useCallback(async (contractType) => {
    const amount = stakeOrPayout === 'payout' ? payout : stake;
    if (!selectedMarket?.symbol || amount <= 0 || !api || !isConnected) return null;

    // Validate duration for stays in/goes out - must be >= 2 and only minutes/hours/days
    if (durationOrEndtime === 'duration' && (durationUnit === 't' || durationValue < 2)) {
      return null;
    }

    // For RANGE/UPORDOWN, double barrier is required
    // Format: "+high,-low" where both are relative to current price
    // Each barrier value must match the regex: ^(?=.{1,20}$)[+-]?[0-9]+\.?[0-9]*$
    // Use formatBarrierValue helper to ensure proper formatting that matches the regex
    const absBarrier = Math.max(0.01, Math.abs(barrier));
    const barrierValue = formatBarrierValue(absBarrier);
    // Ensure we have a valid value (formatBarrierValue returns '0' for invalid, so use minimum)
    const validBarrier = (barrierValue && barrierValue !== '0' && !isNaN(parseFloat(barrierValue))) ? barrierValue : '0.01';
    // Format double barrier: "+value,-value" (comma-separated, no spaces)
    // The API should parse this and validate each part against the regex
    const formattedBarrier = `+${validBarrier},-${validBarrier}`;
    
    const baseParams = {
      proposal: 1,
      subscribe: 1,
      amount: amount,
      basis: stakeOrPayout,
      contract_type: contractType,
      currency: 'USD',
      symbol: selectedMarket.symbol,
      barrier: formattedBarrier,
    };

    if (durationOrEndtime === 'duration') {
      baseParams.duration = durationValue;
      baseParams.duration_unit = durationUnit;
    } else if (endDate) {
      baseParams.date_expiry = Math.floor(endDate.getTime() / 1000);
      baseParams.duration = null;
    }

    try {
      const response = await api.send(baseParams);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.proposal || null;
    } catch (error) {
      // Don't log expected errors (WebSocket not connected, AlreadySubscribed)
      const errorMessage = error?.message || error?.toString() || '';
      const errorCode = error?.code;
      const isExpectedError = errorMessage.includes('WebSocket not connected') || errorCode === 'AlreadySubscribed';
      if (!isExpectedError) {
      }
      // Only show error if trade type actually changed
      const tradeTypeChanged = prevTradeTypeRef.current !== tradeType;
      if (tradeTypeChanged) {
        toast({
          description: error.message || 'Failed to fetch proposal',
          variant: 'destructive'
        });
      }
      return null;
    }
  }, [selectedMarket, stake, api, isConnected, barrier, durationOrEndtime, durationValue, durationUnit, endDate, toast, tradeType]);

  useEffect(() => {
    const tradeTypeChanged = prevTradeTypeRef.current !== null && prevTradeTypeRef.current !== tradeType;
    const isInitialMount = prevTradeTypeRef.current === undefined || prevTradeTypeRef.current === null;
    prevTradeTypeRef.current = tradeType;
    
    const fetchProposals = async () => {
      if (!selectedMarket?.symbol || !api || !isConnected) {
        // Clear proposals if requirements not met
        setStaysInProposal(null);
        setGoesOutProposal(null);
        return;
      }
      
      setIsLoading(true);
      try {
        const [staysInRes, goesOutRes] = await Promise.all([
          fetchProposal('RANGE'),
          fetchProposal('UPORDOWN'),
        ]);
        
        if (isMountedRef.current) {
          setStaysInProposal(staysInRes);
          setGoesOutProposal(goesOutRes);
        }
      } catch (error) {
        // Don't log expected errors (WebSocket not connected, AlreadySubscribed, WrongResponse)
        const errorMessage = error?.message || error?.toString() || '';
        const errorCode = error?.code;
        const isExpectedError = 
          errorMessage.includes('WebSocket not connected') || 
          errorCode === 'AlreadySubscribed' ||
          errorCode === 'WrongResponse' ||
          errorCode === 'RateLimit' ||
          errorMessage.includes('WrongResponse') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('RateLimit');
        if (!isExpectedError) {
        } else {
        }
        // Clear proposals on error to ensure buttons are properly disabled
        if (isMountedRef.current) {
          setStaysInProposal(null);
          setGoesOutProposal(null);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    // Fetch immediately on initial mount or trade type change, debounce only for parameter changes
    // Increased debounce to 800ms to prevent rate limit errors
    if (isInitialMount || tradeTypeChanged) {
      fetchProposals();
    } else {
      const timeoutId = setTimeout(fetchProposals, 800);
      return () => clearTimeout(timeoutId);
    }
  }, [fetchProposal, stakeOrPayout, stake, payout, selectedMarket?.symbol, api, isConnected, tradeType, durationValue, durationUnit, durationOrEndtime, endDate]);

  const handleStakeChange = (amount) => setStake(prev => Math.max(1, prev + amount));
  const handlePayoutChange = (amount) => setPayout(prev => Math.max(1, prev + amount));
  const handleDurationChange = (amount) => {
    const minValue = durationUnit === 't' ? 1 : (durationUnit === 'm' ? 1 : (durationUnit === 'h' ? 1 : 1));
    setDurationValue(prev => Math.max(minValue, prev + amount));
  };
  const handleBarrierChange = (e) => {
    const value = parseFloat(e.target.value) || 0;
    setBarrier(value);
    // Validate barrier - will be validated against API response
    setBarrierError(null);
  };

  // Calculate expiry date from duration
  const calculateExpiry = useMemo(() => {
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

  const handlePurchase = async (direction, proposal) => {
    // Log token and wallet information when trade button is clicked
    logTradeButtonClick(user, balance, direction, proposal?.id);
    
    // Prevent duplicate requests - critical for real-time trading
    if (isPurchasing) {
      return;
    }

    // Cooldown mechanism: prevent accidental double-clicks (300ms minimum between trades)
    const now = Date.now();
    const timeSinceLastTrade = now - lastTradeTimeRef.current;
    const COOLDOWN_MS = 300; // 0.3 seconds cooldown to prevent accidental double-clicks only
    
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

    if (!api || !isConnected) {
      toast({
        title: 'Not Connected',
        description: 'Please connect to your account first',
        variant: 'destructive'
      });
      return;
    }

    // Check if user is logged in (either user state is set or token exists in localStorage)
    const hasValidToken = user?.token ? isValidAuthToken(user.token) : isUserAuthenticated();
    if (!hasValidToken) {
      toast({
        title: 'Login Required',
        description: 'Please log in to your account to place trades',
        variant: 'destructive'
      });
      return;
    }

    // CRITICAL: Use selected account balance from localStorage (most accurate for selected account)
    // This ensures we check the correct account's balance, not the first account's balance
    const selectedAccount = getSelectedAccountFromStorage();
    const currentAccountBalance = selectedAccount?.balance ?? user?.balance ?? balance ?? 0;
 console.log('[TradeExecution] Current Account Balance2:', currentAccountBalance,selectedAccount?.balance, user?.balance,selectedAccount?.loginid || user?.loginid,user);
    // if (currentAccountBalance <= 0) {
    //   toast({
    //     title: 'Insufficient Balance',
    //     description: `Your account balance (${currentAccountBalance.toFixed(2)} USD) is insufficient to buy this contract (${(proposal?.ask_price || stake).toFixed(2)} USD).`,
    //     variant: 'destructive'
    //   });
    //   return;
    // }

    if (!proposal?.id) {
      toast({
        title: 'No Proposal',
        description: 'Please wait for proposal to load',
        variant: 'destructive'
      });
      return;
    }

    // Check balance - use ask_price if available, otherwise use stake
    const requiredAmount = proposal?.ask_price || stake;
    if (currentAccountBalance && requiredAmount > currentAccountBalance) {
      toast({
        title: 'Insufficient Balance',
        description: `You need ${requiredAmount.toFixed(2)} USD but have ${currentAccountBalance.toFixed(2)} USD`,
        variant: 'destructive'
      });
      return;
    }

    // CRITICAL: Extract wallet information and save to localStorage
    const walletLoginid = selectedAccount?.loginid || user?.loginid || '';
    const walletAmount = currentAccountBalance || user?.balance || balance || 0;
    const walletToken = user?.token || '';
    
    // Save wallet information to localStorage
    try {
      const walletData = {
        loginid: walletLoginid,
        amount: walletAmount,
        token: walletToken,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('deriv_wallet_trade', JSON.stringify(walletData));
      
      // Console log wallet information
      console.log('[TradeExecution] Wallet Information:', {
        loginid: walletLoginid,
        amount: walletAmount,
        token: walletToken ? `${walletToken.substring(0, 20)}...` : 'No token',
        timestamp: walletData.timestamp
      });
    } catch (e) {
      console.error('[TradeExecution] Error saving wallet data to localStorage:', e);
    }

    // CRITICAL: Verify account match before placing trade
    // The Deriv API uses the account that the WebSocket is authenticated with
    // If user.loginid doesn't match selectedAccount.loginid, the API will check the wrong account's balance
    if (selectedAccount && selectedAccount.loginid && user?.loginid && user.loginid !== selectedAccount.loginid) {
      console.error('[TradeExecution] CRITICAL: Account mismatch detected!', {
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
      // buy: proposal ID from price proposal, or 1 if using parameters
      // price: Maximum price at which to purchase the contract
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

      // CRITICAL: Log account info before placing trade
      console.log('[TradeExecution] Placing trade with:', {
        selectedAccountLoginid: selectedAccount?.loginid,
        authenticatedLoginid: user?.loginid,
        balance: currentAccountBalance,
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
          // CRITICAL: Get balance from multiple sources, prioritizing accounts array
          let selectedAccountBalance = selectedAccount?.balance ?? 0;
          
          // Try accounts array first (most reliable - comes from authorize response)
          if (selectedAccount?.loginid && user?.accounts) {
            const accountInList = user.accounts.find(acc => acc.loginid === selectedAccount.loginid);
            if (accountInList?.balance !== undefined && accountInList.balance !== null) {
              const accBalance = parseFloat(accountInList.balance);
              if (!isNaN(accBalance) && accBalance > 0) {
                selectedAccountBalance = accBalance;
              }
            }
          }
          
          // Fallback to liveBalances
          if (selectedAccountBalance <= 0 && selectedAccount?.loginid && user?.liveBalances?.[selectedAccount.loginid]) {
            selectedAccountBalance = user.liveBalances[selectedAccount.loginid].balance || 0;
          }
          
          // Last fallback (but this is from primary account, not selected)
          if (selectedAccountBalance <= 0) {
            selectedAccountBalance = user?.balance ?? 0;
          }
          
          const requiredAmount = proposal?.ask_price || stake;
          
          // CRITICAL: Check if there's an account mismatch
          // The API uses the account from authorize response for balance checks, not the selected account
          const accountMismatch = selectedAccount?.loginid && user?.loginid && selectedAccount.loginid !== user.loginid;
          
          // Check if the API error message contains balance information
          const apiErrorMessage = response.error?.message || '';
          const apiBalanceMatch = apiErrorMessage.match(/balance[:\s]+([\d.]+)/i);
          const apiBalance = apiBalanceMatch ? parseFloat(apiBalanceMatch[1]) : null;
          
          // CRITICAL: The API always checks the primary account from authorize response, not the selected account
          // If the API shows 0.00 balance but our selected account has balance, it's an account mismatch
          const apiCheckedWrongAccount = apiBalance !== null && apiBalance === 0 && selectedAccountBalance >= requiredAmount;
          
          // CRITICAL: Also check if user.balance is 0 but selected account has balance
          // This indicates the API is checking the wrong account
          const primaryAccountHasZero = user?.balance === 0 && selectedAccountBalance >= requiredAmount;
          
          if (accountMismatch || apiCheckedWrongAccount || primaryAccountHasZero) {
            userMessage = `⚠️ Account Mismatch Detected! The Deriv API checked account ${user?.loginid || 'unknown'} (balance: ${apiBalance !== null ? apiBalance.toFixed(2) : (user?.balance || 0).toFixed(2)} USD), but you selected account ${selectedAccount?.loginid || 'unknown'} (balance: ${selectedAccountBalance.toFixed(2)} USD). The WebSocket is still using the primary account from the authorize response. Please refresh the page to complete the account switch, then try again.`;
          } else {
            userMessage = `Insufficient balance. Your account (${selectedAccount?.loginid || user?.loginid || 'current'}) has ${selectedAccountBalance.toFixed(2)} USD, but ${requiredAmount.toFixed(2)} USD is required.`;
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
        const accountLoginid = selectedAccount?.loginid || user?.loginid;
        if (deductBalance && buyPrice && accountLoginid) {
          deductBalance(buyPrice, accountLoginid);
        }
        
        // Request balance update from WebSocket to sync with server
        if (requestBalanceUpdate && accountLoginid) {
          requestBalanceUpdate(accountLoginid);
        }
        
        toast({
          title: `✅ ${direction} Contract Purchased`,
          description: `Contract ID: ${contractId}${payout ? ` | Payout: $${payout.toFixed(2)}` : ''}`,
        });

        // Add position to open positions
        if (onTradePlaced) {
          onTradePlaced({
            contract_id: contractId,
            buy_price: buyPrice,
            payout: payout,
            stake: stake,
            contract_type: direction === 'Stays In' ? 'RANGE' : 'UPORDOWN',
            trade_type: tradeType,
            symbol: selectedMarket.symbol,
            display_name: selectedMarket.name || selectedMarket.symbol,
            duration: durationValue,
            duration_unit: durationUnit,
            start_time: Date.now() / 1000,
            profit: 0,
            sell_price: buyPrice,
          });
        }

        // Optional: Handle subscription if response includes it
        if (response.subscription) {
        }
        
        // Refresh proposals after successful trade to update buttons with fresh proposal IDs
        if (typeof refreshProposals === 'function') {
          setTimeout(() => refreshProposals(false), 100);
        }
      } else {
        throw new Error('Invalid response: missing buy data');
      }
    } catch (error) {
      // Enhanced error logging for debugging
      
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

  // Check if user is logged in (for onClick validation)
  // Match desktop logic: allow if user exists OR localStorage has deriv_user
  // Note: Balance check is done in onClick handler, not in disabled prop
  const canTrade = useMemo(() => {
    // Check if user exists OR localStorage has deriv_user (same as desktop buttons)
    const hasValidToken = user?.token ? isValidAuthToken(user.token) : isUserAuthenticated();
    return hasValidToken;
  }, [user]);

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
        <Label>Barrier</Label>
        <Input
          type="number"
          step="0.01"
          value={barrier}
          onChange={handleBarrierChange}
          className={cn("w-full", barrierError && "border-red-500")}
          min={0.01}
          disabled={isLoading}
        />
        {barrierError && (
          <p className="text-xs text-red-500 mt-1">{barrierError}</p>
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
              <Button onClick={() => handleStakeChange(-1)}><Minus /></Button>
              <Input type="number" value={stake} onChange={e => setStake(Math.max(1, parseFloat(e.target.value) || 1))} className="flex-1 text-center" />
              <Button onClick={() => handleStakeChange(1)}><Plus /></Button>
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
              <Button onClick={() => handlePayoutChange(-1)}><Minus /></Button>
              <Input type="number" value={payout} onChange={e => setPayout(Math.max(1, parseFloat(e.target.value) || 1))} className="flex-1 text-center" />
              <Button onClick={() => handlePayoutChange(1)}><Plus /></Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {!hideActionButtons && (
        <div className="border-t border-gray-200 pt-4 flex gap-2">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-gray-600">
                Stake {stake.toFixed(2)} USD <ChevronUp className="h-3 w-3 text-green-500 inline-block ml-1" />
              </span>
              <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full p-0 hover:bg-gray-100 flex-shrink-0">
                <Info className="h-2.5 w-2.5 text-gray-400" />
              </Button>
            </div>
            <StyledTradeButton
              label="Stays In"
              proposal={staysInProposal}
              icon={ChevronUp}
              color="bg-green-500 hover:bg-green-600"
              onClick={() => {
                if (!canTrade) {
                  toast({
                    title: 'Login Required',
                    description: 'Please log in with an account that has a non-zero balance to place trades',
                    variant: 'destructive'
                  });
                  return;
                }
                if (!staysInProposal) {
                  toast({
                    title: 'Proposal Not Available',
                    description: 'Please wait for the proposal to load or check your connection.',
                    variant: 'destructive'
                  });
                  return;
                }
                handlePurchase('Stays In', staysInProposal);
              }}
              disabled={!api || !isConnected || isPurchasing}
              isLoading={isPurchasing || isLoading}
              getPayoutPct={getPayoutPct}
              getPayoutAmount={(proposal) => {
                if (!proposal || !proposal.payout) return '—';
                return proposal.payout.toFixed(2);
              }}
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
              label="Goes Out"
              proposal={goesOutProposal}
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
                if (!goesOutProposal) {
                  toast({
                    title: 'Proposal Not Available',
                    description: 'Please wait for the proposal to load or check your connection.',
                    variant: 'destructive'
                  });
                  return;
                }
                handlePurchase('Goes Out', goesOutProposal);
              }}
              disabled={!api || !isConnected || isPurchasing}
              isLoading={isPurchasing || isLoading}
              getPayoutPct={getPayoutPct}
              getPayoutAmount={(proposal) => {
                if (!proposal || !proposal.payout) return '—';
                return proposal.payout.toFixed(2);
              }}
            />
          </div>
        </div>
      )}

      {!hidePrediction && (
        <PredictionPanel
          symbol={selectedMarket?.symbol}
          tradeType={tradeType}
          aiPrediction={aiPrediction ? {
            prediction: aiPrediction.direction?.toLowerCase() || aiPrediction.prediction || 'rise',
            confidence: typeof aiPrediction.confidence === 'number' && aiPrediction.confidence > 1 
              ? aiPrediction.confidence / 100 
              : aiPrediction.confidence || 0.65
          } : { prediction: 'rise', confidence: 0.65 }}
          mode="compact"
        />
      )}
    </div>
  );
};

// Multipliers Execution Component
const MultipliersExecution = ({ selectedMarket, tradeType = 'multipliers', aiPrediction, hidePrediction = false, onBarrierChange, onTradePlaced, openPositions, hideActionButtons = false, onProposalsSync }) => {
  // Clear barriers for trade types that don't use them
  useEffect(() => {
    if (onBarrierChange) {
      onBarrierChange([]);
    }
  }, [onBarrierChange]);
  const [stake, setStake] = useState(10);
  const [durationValue, setDurationValue] = useState(5);
  const [endDate, setEndDate] = useState(null);
  const [durationOrEndtime, setDurationOrEndtime] = useState('duration');
  const [durationUnit, setDurationUnit] = useState('m');
  const [multiplier, setMultiplier] = useState(40);
  const [takeProfit, setTakeProfit] = useState(false);
  const [takeProfitAmount, setTakeProfitAmount] = useState('');
  const [stopLoss, setStopLoss] = useState(false);
  const [stopLossAmount, setStopLossAmount] = useState('');
  const [dealCancellation, setDealCancellation] = useState(false);
  
  // Multiplier options (common values)
  const multiplierOptions = [10, 20, 30, 40, 50, 100, 200, 300, 500, 1000];
  const [upProposal, setUpProposal] = useState(null);
  const [downProposal, setDownProposal] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const lastTradeTimeRef = useRef(0); // Track last trade attempt time for cooldown
  const { toast } = useToast();
  const { api, connected: isConnected, user, login } = useDerivAPI();
  // CRITICAL: Use selected account balance from localStorage (most up-to-date for selected account)
  // This ensures we use the balance for the selected account, not the first account
  const selectedAccount = getSelectedAccountFromStorage();
  const balance = selectedAccount?.balance ?? user?.balance ?? 0;
  const prevTradeTypeRef = useRef(null);
  const isMountedRef = useRef(false);
  
  // Clear proposals immediately when tradeType changes to ensure fresh fetch
  useEffect(() => {
    setUpProposal(null);
    setDownProposal(null);
    setIsLoading(true); // Set loading to true immediately to keep buttons enabled during fetch
    // Reset prevTradeTypeRef to force fetch effect to detect the change
    prevTradeTypeRef.current = null;
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, [tradeType]);

  const fetchProposal = useCallback(async (contractType) => {
    if (!selectedMarket?.symbol || stake <= 0 || !api || !isConnected) return null;

    const baseParams = {
      proposal: 1,
      subscribe: 1,
      amount: stake,
      basis: 'stake',
      contract_type: contractType,
      currency: 'USD',
      symbol: selectedMarket.symbol,
      multiplier: multiplier,
      // Multipliers don't use duration/date_expiry - they're open-ended contracts
      // They close when stop_loss or take_profit is hit
    };

    // Add optional parameters if set
    if (takeProfit && takeProfitAmount) {
      baseParams.take_profit = parseFloat(takeProfitAmount);
    }
    if (stopLoss && stopLossAmount) {
      baseParams.stop_loss = parseFloat(stopLossAmount);
    }
    if (dealCancellation) {
      baseParams.cancellation = 'cancellation';
    }

    try {
      const response = await api.send(baseParams);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.proposal || null;
    } catch (error) {
      // Don't log expected errors (WebSocket not connected, AlreadySubscribed)
      const errorMessage = error?.message || error?.toString() || '';
      const errorCode = error?.code;
      const isExpectedError = errorMessage.includes('WebSocket not connected') || errorCode === 'AlreadySubscribed';
      if (!isExpectedError) {
      }
      // Only show error if trade type actually changed
      const tradeTypeChanged = prevTradeTypeRef.current !== tradeType;
      if (tradeTypeChanged) {
        toast({
          description: error.message || 'Failed to fetch proposal',
          variant: 'destructive'
        });
      }
      return null;
    }
  }, [selectedMarket, stake, api, isConnected, multiplier, takeProfit, takeProfitAmount, stopLoss, stopLossAmount, dealCancellation, toast, tradeType]);

  useEffect(() => {
    const tradeTypeChanged = prevTradeTypeRef.current !== null && prevTradeTypeRef.current !== tradeType;
    const isInitialMount = prevTradeTypeRef.current === undefined || prevTradeTypeRef.current === null;
    prevTradeTypeRef.current = tradeType;
    
    const fetchProposals = async () => {
      if (!selectedMarket?.symbol || !api || !isConnected) {
        // Clear proposals if requirements not met
        setUpProposal(null);
        setDownProposal(null);
        return;
      }
      
      // Disable trade buttons while fetching proposals
      setIsLoading(true);
      
      try {
        const [upRes, downRes] = await Promise.all([
          fetchProposal('MULTUP'),
          fetchProposal('MULTDOWN'),
        ]);
        
        if (isMountedRef.current) {
          setUpProposal(upRes);
          setDownProposal(downRes);
        }
      } catch (error) {
        // Don't log expected errors (WebSocket not connected, AlreadySubscribed, WrongResponse)
        const errorMessage = error?.message || error?.toString() || '';
        const errorCode = error?.code;
        const isExpectedError = 
          errorMessage.includes('WebSocket not connected') || 
          errorCode === 'AlreadySubscribed' ||
          errorCode === 'WrongResponse' ||
          errorCode === 'RateLimit' ||
          errorMessage.includes('WrongResponse') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('RateLimit');
        if (!isExpectedError) {
        } else {
        }
        // Clear proposals on error to ensure buttons are properly disabled
        if (isMountedRef.current) {
          setUpProposal(null);
          setDownProposal(null);
        }
      } finally {
        if (isMountedRef.current) {
          // Keep buttons disabled for a short time (500ms) then re-enable
          setTimeout(() => {
            if (isMountedRef.current) {
              setIsLoading(false);
            }
          }, 500);
        }
      }
    };

    // Fetch immediately on initial mount or trade type change, debounce only for parameter changes
    if (isInitialMount || tradeTypeChanged) {
      fetchProposals();
    } else {
      const timeoutId = setTimeout(fetchProposals, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [fetchProposal, selectedMarket?.symbol, api, isConnected, tradeType]);

  const handleStakeChange = (amount) => setStake(prev => Math.max(1, prev + amount));
  const handleDurationChange = (amount) => setDurationValue(prev => Math.max(1, prev + amount));
  const handleMultiplierChange = (e) => setMultiplier(Math.max(1, parseInt(e.target.value) || 1));

  const handlePurchase = async (direction, proposal) => {
    // Log token and wallet information when trade button is clicked
    logTradeButtonClick(user, balance, direction, proposal?.id);
    
    // Prevent duplicate requests - critical for real-time trading
    if (isPurchasing) {
      return;
    }

    // Cooldown mechanism: prevent accidental double-clicks (300ms minimum between trades)
    const now = Date.now();
    const timeSinceLastTrade = now - lastTradeTimeRef.current;
    const COOLDOWN_MS = 300; // 0.3 seconds cooldown to prevent accidental double-clicks only
    
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

    if (!api || !isConnected) {
      toast({
        title: 'Not Connected',
        description: 'Please connect to your account first',
        variant: 'destructive'
      });
      return;
    }

    // Check if user is logged in (either user state is set or token exists in localStorage)
    const hasValidToken = user?.token ? isValidAuthToken(user.token) : isUserAuthenticated();
    if (!hasValidToken) {
      toast({
        title: 'Login Required',
        description: 'Please log in to your account to place trades',
        variant: 'destructive'
      });
      return;
    }

    // CRITICAL: Use selected account balance from localStorage (most accurate for selected account)
    // This ensures we check the correct account's balance, not the first account's balance
    const selectedAccount = getSelectedAccountFromStorage();
    const currentAccountBalance = selectedAccount?.balance ?? user?.balance ?? balance ?? 0;
    // if (currentAccountBalance <= 0) {
    //   toast({
    //     title: 'Insufficient Balance',
    //     description: `Your account balance (${currentAccountBalance.toFixed(2)} USD) is insufficient to buy this contract (${(proposal?.ask_price || stake).toFixed(2)} USD).`,
    //     variant: 'destructive'
    //   });
    //   return;
    // }

    if (!proposal?.id) {
      toast({
        title: 'No Proposal',
        description: 'Please wait for proposal to load',
        variant: 'destructive'
      });
      return;
    }

    // Check balance - use ask_price if available, otherwise use stake
    const requiredAmount = proposal?.ask_price || stake;
    if (currentAccountBalance && requiredAmount > currentAccountBalance) {
      toast({
        title: 'Insufficient Balance',
        description: `You need ${requiredAmount.toFixed(2)} USD but have ${currentAccountBalance.toFixed(2)} USD`,
        variant: 'destructive'
      });
      return;
    }

    // CRITICAL: Extract wallet information and save to localStorage
    const walletLoginid = selectedAccount?.loginid || user?.loginid || '';
    const walletAmount = currentAccountBalance || user?.balance || balance || 0;
    const walletToken = user?.token || '';
    
    // Save wallet information to localStorage
    try {
      const walletData = {
        loginid: walletLoginid,
        amount: walletAmount,
        token: walletToken,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('deriv_wallet_trade', JSON.stringify(walletData));
      
      // Console log wallet information
      console.log('[TradeExecution] Wallet Information:', {
        loginid: walletLoginid,
        amount: walletAmount,
        token: walletToken ? `${walletToken.substring(0, 20)}...` : 'No token',
        timestamp: walletData.timestamp
      });
    } catch (e) {
      console.error('[TradeExecution] Error saving wallet data to localStorage:', e);
    }

    // CRITICAL: Verify account match before placing trade
    // The Deriv API uses the account that the WebSocket is authenticated with
    // If user.loginid doesn't match selectedAccount.loginid, the API will check the wrong account's balance
    if (selectedAccount && selectedAccount.loginid && user?.loginid && user.loginid !== selectedAccount.loginid) {
      console.error('[TradeExecution] CRITICAL: Account mismatch detected!', {
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
      // buy: proposal ID from price proposal, or 1 if using parameters
      // price: Maximum price at which to purchase the contract
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

      // CRITICAL: Log account info before placing trade
      console.log('[TradeExecution] Placing trade with:', {
        selectedAccountLoginid: selectedAccount?.loginid,
        authenticatedLoginid: user?.loginid,
        balance: currentAccountBalance,
        token: user?.token ? `${user.token.substring(0, 20)}...` : 'no token'
      });

      const response = await api.send(buyRequest);


      // Handle error response
      if (response.error) {
        const errorMsg = response.error.message || response.error.code || 'Purchase failed';
        throw new Error(errorMsg);
      }

      // Handle successful purchase
      if (response.buy) {
        const contractId = response.buy.contract_id;
        const buyPrice = response.buy.buy_price;
        const payout = response.buy.payout;
        
        // CRITICAL: Deduct balance immediately after successful trade
        // Use selectedAccount loginid if available, otherwise use user loginid
        const accountLoginid = selectedAccount?.loginid || user?.loginid;
        if (deductBalance && buyPrice && accountLoginid) {
          deductBalance(buyPrice, accountLoginid);
        }
        
        // Request balance update from WebSocket to sync with server
        if (requestBalanceUpdate && accountLoginid) {
          requestBalanceUpdate(accountLoginid);
        }
        
        toast({
          title: `✅ ${direction} Contract Purchased`,
          description: `Contract ID: ${contractId}${payout ? ` | Payout: $${payout.toFixed(2)}` : ''}`,
        });

        // Add position to open positions
        if (onTradePlaced) {
          onTradePlaced({
            contract_id: contractId,
            buy_price: buyPrice,
            payout: payout,
            stake: stake,
            contract_type: direction === 'Up' ? 'MULTUP' : 'MULTDOWN',
            trade_type: tradeType,
            symbol: selectedMarket.symbol,
            display_name: selectedMarket.name || selectedMarket.symbol,
            duration: durationValue,
            duration_unit: durationUnit,
            start_time: Date.now() / 1000,
            profit: 0,
            sell_price: buyPrice,
          });
        }

        // Optional: Handle subscription if response includes it
        if (response.subscription) {
        }
        
        // Refresh proposals after successful trade to update buttons with fresh proposal IDs
        if (typeof refreshProposals === 'function') {
          setTimeout(() => refreshProposals(false), 100);
        }
      } else {
        throw new Error('Invalid response: missing buy data');
      }
    } catch (error) {
      // Enhanced error logging for debugging
      toast({
        title: 'Purchase Failed',
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsPurchasing(false);
      lastTradeTimeRef.current = Date.now(); // Update last trade time after completion
    }
  };

  const getPayoutPct = (proposal) => {
    if (!proposal || !proposal.payout) return '—';
    return ((proposal.payout / stake * 100) - 100).toFixed(2);
  };

  // Calculate commission and stop out
  const commission = stake * 0.015; // 1.5% commission
  const stopOut = stake; // Stop out equals stake

  // Navigate multiplier
  const handleMultiplierNav = (direction) => {
    const currentIndex = multiplierOptions.indexOf(multiplier);
    if (currentIndex === -1) {
      setMultiplier(multiplierOptions[0]);
      return;
    }
    if (direction === 'prev' && currentIndex > 0) {
      setMultiplier(multiplierOptions[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < multiplierOptions.length - 1) {
      setMultiplier(multiplierOptions[currentIndex + 1]);
    }
  };

  // Use refs to store latest function references to prevent infinite loops
  const handlePurchaseRef = useRef(handlePurchase);
  const toastRef = useRef(toast);
  
  // Update refs when functions change
  useEffect(() => {
    handlePurchaseRef.current = handlePurchase;
    toastRef.current = toast;
  }, [handlePurchase, toast]);

  // Sync proposals and button handlers to parent component for mobile footer buttons
  useEffect(() => {
    if (onProposalsSync) {
      const handleUpClick = () => {
        if (!upProposal) {
          toastRef.current({
            title: 'Proposal Not Available',
            description: 'Please wait for the proposal to load or check your connection.',
            variant: 'destructive'
          });
          return;
        }
        if (!api || !isConnected) {
          toastRef.current({
            title: 'Not Connected',
            description: 'Please wait for connection to be established.',
            variant: 'destructive'
          });
          return;
        }
        handlePurchaseRef.current('Up', upProposal);
      };

      const handleDownClick = () => {
        if (!downProposal) {
          toastRef.current({
            title: 'Proposal Not Available',
            description: 'Please wait for the proposal to load or check your connection.',
            variant: 'destructive'
          });
          return;
        }
        if (!api || !isConnected) {
          toastRef.current({
            title: 'Not Connected',
            description: 'Please wait for connection to be established.',
            variant: 'destructive'
          });
          return;
        }
        handlePurchaseRef.current('Down', downProposal);
      };

      onProposalsSync({
        positive: {
          label: 'Up',
          proposal: upProposal,
          onClick: handleUpClick,
          disabled: !api || !isConnected || isPurchasing,
          isLoading: isPurchasing || isLoading,
          color: 'bg-green-500 hover:bg-green-600',
          icon: TrendingUp
        },
        negative: {
          label: 'Down',
          proposal: downProposal,
          onClick: handleDownClick,
          disabled: !api || !isConnected || isPurchasing,
          isLoading: isPurchasing || isLoading,
          color: 'bg-red-500 hover:bg-red-600',
          icon: TrendingDown
        }
      });
    }
  }, [upProposal, downProposal, isPurchasing, isLoading, api, isConnected, onProposalsSync]);

  return (
    <div className="p-2 space-y-1.5">
      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
          <p className="text-xs text-yellow-800">
            ⚠️ You need to connect your account to trade
          </p>
        </div>
      )}

      {/* Multiplier Selector */}
      <div>
        <Label className="mb-1 block text-xs">Multiplier</Label>
        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-2 border border-gray-200">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleMultiplierNav('prev')}
            disabled={isLoading || multiplierOptions.indexOf(multiplier) === 0}
            className="h-7 w-7"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="flex-1 text-center font-bold text-sm">x{multiplier}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleMultiplierNav('next')}
            disabled={isLoading || multiplierOptions.indexOf(multiplier) === multiplierOptions.length - 1}
            className="h-7 w-7"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Stake Section */}
      <div>
        <Label className="mb-1 block text-xs">Stake</Label>
        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-2 border border-gray-200">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleStakeChange(-1)}
            disabled={isLoading}
            className="h-7 w-7"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <div className="flex-1 text-center">
            <span className="text-sm font-semibold">{stake}</span>
            <span className="text-xs text-gray-500 ml-1">USD</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleStakeChange(1)}
            disabled={isLoading}
            className="h-7 w-7"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        {/* Commission and Stop out */}
        <div className="mt-1 space-y-0.5">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Commission</span>
            <span className="underline">{commission.toFixed(2)} USD</span>
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>Stop out</span>
            <span className="underline">{stopOut.toFixed(2)} USD</span>
          </div>
        </div>
      </div>

      {/* Optional Trade Parameters */}
      <div className="space-y-1">
        <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Checkbox
                checked={takeProfit}
                onCheckedChange={(checked) => {
                  setTakeProfit(checked);
                  if (!checked) setTakeProfitAmount('');
                }}
                disabled={isLoading}
                className="h-3.5 w-3.5"
              />
              <Label className="text-xs font-normal cursor-pointer">Take profit</Label>
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full">
              <Info className="h-3 w-3 text-gray-400" />
            </Button>
          </div>
          {takeProfit && (
            <div className="mt-1.5">
              <input
                type="number"
                value={takeProfitAmount}
                onChange={(e) => setTakeProfitAmount(e.target.value)}
                placeholder="Amount (USD)"
                disabled={isLoading}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
          )}
        </div>
        <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Checkbox
                checked={stopLoss}
                onCheckedChange={(checked) => {
                  setStopLoss(checked);
                  if (!checked) setStopLossAmount('');
                }}
                disabled={isLoading}
                className="h-3.5 w-3.5"
              />
              <Label className="text-xs font-normal cursor-pointer">Stop loss</Label>
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full">
              <Info className="h-3 w-3 text-gray-400" />
            </Button>
          </div>
          {stopLoss && (
            <div className="mt-1.5">
              <input
                type="number"
                value={stopLossAmount}
                onChange={(e) => setStopLossAmount(e.target.value)}
                placeholder="Amount (USD)"
                disabled={isLoading}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2 border border-gray-200">
          <div className="flex items-center gap-1.5">
            <Checkbox
              checked={dealCancellation}
              onCheckedChange={setDealCancellation}
              disabled={isLoading}
              className="h-3.5 w-3.5"
            />
            <Label className="text-xs font-normal cursor-pointer">Deal cancellation</Label>
          </div>
          <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full">
            <Info className="h-3 w-3 text-gray-400" />
          </Button>
        </div>
      </div>

      {/* Trade Execution Buttons */}
      <div className="space-y-1.5 pt-1.5 border-t border-gray-200">
        {(() => {
          const getPayoutPct = (proposal) => {
            if (!proposal || !proposal.payout) return '—';
            return ((proposal.payout / stake * 100) - 100).toFixed(2);
          };

          const getPayoutAmount = (proposal) => {
            if (!proposal || !proposal.payout) return '—';
            return proposal.payout.toFixed(2);
          };

          return (
            <>
              <StyledTradeButton
                label="Up"
                proposal={upProposal}
                icon={TrendingUp}
                color="bg-green-500 hover:bg-green-600"
                onClick={() => {
                  if (!upProposal) {
                    toast({
                      title: 'Proposal Not Available',
                      description: 'Please wait for the proposal to load or check your connection.',
                      variant: 'destructive'
                    });
                    return;
                  }
                  handlePurchase('Up', upProposal);
                }}
                disabled={!api || !isConnected || isPurchasing}
                isLoading={isPurchasing || isLoading}
                getPayoutPct={getPayoutPct}
                getPayoutAmount={getPayoutAmount}
              />
              <StyledTradeButton
                label="Down"
                proposal={downProposal}
                icon={TrendingDown}
                color="bg-red-500 hover:bg-red-600"
                onClick={() => {
                  if (!downProposal) {
                    toast({
                      title: 'Proposal Not Available',
                      description: 'Please wait for the proposal to load or check your connection.',
                      variant: 'destructive'
                    });
                    return;
                  }
                  handlePurchase('Down', downProposal);
                }}
                disabled={!api || !isConnected || isPurchasing}
                isLoading={isPurchasing || isLoading}
                getPayoutPct={getPayoutPct}
                getPayoutAmount={getPayoutAmount}
              />
            </>
          );
        })()}
      </div>

      {!hidePrediction && (
        <PredictionPanel
          symbol={selectedMarket?.symbol}
          tradeType={tradeType}
          aiPrediction={aiPrediction ? {
            prediction: aiPrediction.direction?.toLowerCase() || aiPrediction.prediction || 'rise',
            confidence: typeof aiPrediction.confidence === 'number' && aiPrediction.confidence > 1 
              ? aiPrediction.confidence / 100 
              : aiPrediction.confidence || 0.65
          } : { prediction: 'rise', confidence: 0.65 }}
          mode="compact"
        />
      )}
    </div>
  );
};

// Accumulators Execution Component
const AccumulatorsExecution = ({ selectedMarket, tradeType = 'accumulators', aiPrediction, hidePrediction = false, onBarrierChange, onTradePlaced, openPositions, hideActionButtons = false, onProposalsSync }) => {
  const [stake, setStake] = useState(10);
  const [growthRate, setGrowthRate] = useState(0.01); // 1% default
  const [takeProfit, setTakeProfit] = useState(false);
  const [takeProfitAmount, setTakeProfitAmount] = useState('');
  const [proposal, setProposal] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const lastTradeTimeRef = useRef(0); // Track last trade attempt time for cooldown
  const { toast } = useToast();
  const { api, connected: isConnected, user, tickData, login } = useDerivAPI();
  // CRITICAL: Use selected account balance from localStorage (most up-to-date for selected account)
  // This ensures we use the balance for the selected account, not the first account
  const selectedAccount = getSelectedAccountFromStorage();
  const balance = selectedAccount?.balance ?? user?.balance ?? 0;
  const prevTradeTypeRef = useRef(null);
  const isMountedRef = useRef(false);
  
  // Clear proposal immediately when tradeType changes to ensure fresh fetch
  useEffect(() => {
    setProposal(null);
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, [tradeType]);
  
  // Get current price from tick data
  const lastTick = tickData?.[selectedMarket?.symbol];
  const currentPrice = lastTick?.quote;
  
  // Calculate barriers based on growth rate and current price
  useEffect(() => {
    if (!onBarrierChange || !selectedMarket?.symbol) {
      onBarrierChange?.([]);
      return;
    }
    
    // Always create a new array reference to ensure React detects the change
    // Always report barriers with growthRatePercent for percentage-based calculation
    // TradingChart will recalculate from latest price data using the percentage
    // This ensures barriers are always shown, even if currentPrice is not available yet
    const newBarriers = [
      {
        price: null, // Will be calculated in TradingChart from latest price
        growthRatePercent: growthRate, // Store growth rate for percentage calculation (e.g., 0.01 for 1%)
        label: `+${(growthRate * 100).toFixed(0)}%`, // Temporary label, will be updated with actual offset
        color: '#60A5FA',
        lineStyle: 2, // dashed
      },
      {
        price: null, // Will be calculated in TradingChart from latest price
        growthRatePercent: -growthRate, // Negative for lower barrier
        label: `-${(growthRate * 100).toFixed(0)}%`, // Temporary label, will be updated with actual offset
        color: '#60A5FA',
        lineStyle: 2, // dashed
      }
    ];
    
    onBarrierChange?.(newBarriers);
  }, [growthRate, selectedMarket?.symbol, onBarrierChange]);

  const fetchProposal = useCallback(async () => {
    if (!selectedMarket?.symbol || stake <= 0 || !api || !isConnected) return null;

    const baseParams = {
      proposal: 1,
      subscribe: 1,
      amount: stake,
      basis: 'stake',
      contract_type: 'ACCU',
      currency: 'USD',
      symbol: selectedMarket.symbol,
      growth_rate: growthRate,
      // Only include take_profit if checkbox is checked and amount is provided
      ...(takeProfit && takeProfitAmount && !isNaN(parseFloat(takeProfitAmount)) && parseFloat(takeProfitAmount) > 0 && { take_profit: parseFloat(takeProfitAmount) }),
    };

    try {
      const response = await api.send(baseParams);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.proposal || null;
    } catch (error) {
      // Don't log expected errors (WebSocket not connected, AlreadySubscribed)
      const errorMessage = error?.message || error?.toString() || '';
      const errorCode = error?.code;
      const isExpectedError = errorMessage.includes('WebSocket not connected') || errorCode === 'AlreadySubscribed';
      
      if (!isExpectedError) {
      }
      
      // Only show error if trade type actually changed
      const tradeTypeChanged = prevTradeTypeRef.current !== tradeType;
      if (tradeTypeChanged && !isExpectedError) {
        toast({
          description: error.message || 'Failed to fetch proposal',
          variant: 'destructive'
        });
      }
      return null;
    }
  }, [selectedMarket, stake, api, isConnected, growthRate, takeProfit, takeProfitAmount, toast, tradeType]);

  useEffect(() => {
    const tradeTypeChanged = prevTradeTypeRef.current !== null && prevTradeTypeRef.current !== tradeType;
    const isInitialMount = prevTradeTypeRef.current === undefined || prevTradeTypeRef.current === null;
    prevTradeTypeRef.current = tradeType;
    
    const fetchData = async () => {
      if (!selectedMarket?.symbol || !api || !isConnected) {
        // Clear proposal if requirements not met
        setProposal(null);
        return;
      }
      
      setIsLoading(true);
      try {
        const proposalData = await fetchProposal();
        if (isMountedRef.current) {
          setProposal(proposalData);
        }
      } catch (error) {
        // Clear proposal on error to ensure button is properly disabled
        if (isMountedRef.current) {
          setProposal(null);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    // Fetch immediately on initial mount or trade type change, debounce only for parameter changes
    if (isInitialMount || tradeTypeChanged) {
      fetchData();
    } else {
      const timeoutId = setTimeout(fetchData, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [fetchProposal, selectedMarket?.symbol, api, isConnected, tradeType]);

  const handleStakeChange = (amount) => setStake(prev => Math.max(1, prev + amount));
  
  // Growth rate options: 1%, 2%, 3%, 4%, 5%
  const growthRateOptions = [0.01, 0.02, 0.03, 0.04, 0.05];
  
  const handleGrowthRateSelect = (rate) => {
    setGrowthRate(rate);
  };

  // Use refs to store latest function references to prevent infinite loops
  const handlePurchaseRef = useRef(handlePurchase);
  const toastRef = useRef(toast);
  
  // Update refs when functions change
  useEffect(() => {
    handlePurchaseRef.current = handlePurchase;
    toastRef.current = toast;
  }, [handlePurchase, toast]);

  // Sync proposals and button handlers to parent component for mobile footer buttons
  useEffect(() => {
    if (onProposalsSync) {
      const handleBuyClick = () => {
        if (!proposal) {
          toastRef.current({
            title: 'Proposal Not Available',
            description: 'Please wait for the proposal to load or check your connection.',
            variant: 'destructive'
          });
          return;
        }
        if (!api || !isConnected) {
          toastRef.current({
            title: 'Not Connected',
            description: 'Please wait for connection to be established.',
            variant: 'destructive'
          });
          return;
        }
        handlePurchaseRef.current();
      };

      onProposalsSync({
        positive: {
          label: 'Buy',
          proposal: proposal,
          onClick: handleBuyClick,
          disabled: !api || !isConnected || isPurchasing,
          isLoading: isPurchasing || isLoading,
          color: 'bg-teal-600 hover:bg-teal-700',
          icon: BarChart3
        },
        negative: null // Accumulators only has one button
      });
    }
  }, [proposal, isPurchasing, isLoading, api, isConnected, onProposalsSync]);

  const handlePurchase = async () => {
    // Log token and wallet information when trade button is clicked
    logTradeButtonClick(user, balance, '', proposal?.id);
    
    // Prevent duplicate requests - critical for real-time trading
    if (isPurchasing) {
      return;
    }

    // Cooldown mechanism: prevent accidental double-clicks (300ms minimum between trades)
    const now = Date.now();
    const timeSinceLastTrade = now - lastTradeTimeRef.current;
    const COOLDOWN_MS = 300; // 0.3 seconds cooldown to prevent accidental double-clicks only
    
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

    if (!api || !isConnected) {
      toast({
        title: 'Not Connected',
        description: 'Please connect to your account first',
        variant: 'destructive'
      });
      return;
    }

    // Check if user is logged in (either user state is set or token exists in localStorage)
    const hasValidToken = user?.token ? isValidAuthToken(user.token) : isUserAuthenticated();
    if (!hasValidToken) {
      toast({
        title: 'Login Required',
        description: 'Please log in to your account to place trades',
        variant: 'destructive'
      });
      return;
    }

    if (!proposal?.id) {
      toast({
        title: 'No Proposal',
        description: 'Please wait for proposal to load',
        variant: 'destructive'
      });
      return;
    }

    if (takeProfit && (!takeProfitAmount || isNaN(parseFloat(takeProfitAmount)) || parseFloat(takeProfitAmount) <= 0)) {
      toast({
        title: 'Take Profit Required',
        description: 'Please enter a take profit amount',
        variant: 'destructive'
      });
      return;
    }

    // CRITICAL: Use selected account balance from localStorage (most accurate for selected account)
    const selectedAccount = getSelectedAccountFromStorage();
    const currentAccountBalance = selectedAccount?.balance ?? user?.balance ?? balance ?? 0;
    
    if (currentAccountBalance && stake > currentAccountBalance) {
      toast({
        title: 'Insufficient Balance',
        description: `You need ${stake} USD but have ${currentAccountBalance.toFixed(2)} USD`,
        variant: 'destructive'
      });
      return;
    }

    // CRITICAL: Extract wallet information and save to localStorage
    const walletLoginid = selectedAccount?.loginid || user?.loginid || '';
    const walletAmount = currentAccountBalance || user?.balance || balance || 0;
    const walletToken = user?.token || '';
    
    // Save wallet information to localStorage
    try {
      const walletData = {
        loginid: walletLoginid,
        amount: walletAmount,
        token: walletToken,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('deriv_wallet_trade', JSON.stringify(walletData));
      
      // Console log wallet information
      console.log('[TradeExecution] Wallet Information:', {
        loginid: walletLoginid,
        amount: walletAmount,
        token: walletToken ? `${walletToken.substring(0, 20)}...` : 'No token',
        timestamp: walletData.timestamp
      });
    } catch (e) {
      console.error('[TradeExecution] Error saving wallet data to localStorage:', e);
    }

    // CRITICAL: Ensure we're using user's OAuth token, not API token
    const canTrade = await ensureUserAccountAuthenticated({ user, login, toast });
    if (!canTrade) {
      return; // Error already shown by ensureUserAccountAuthenticated
    }

    setIsPurchasing(true);
    try {
      const response = await api.send({
        buy: proposal.id,
        price: proposal.ask_price || proposal.payout,
      });

      if (response.error) {
        throw new Error(response.error.message || 'Purchase failed');
      }

      if (response.buy) {
        const contractId = response.buy.contract_id;
        const buyPrice = response.buy.buy_price;
        const payout = response.buy.payout;
        
        // CRITICAL: Deduct balance immediately after successful trade
        // Validate buyPrice is a valid number before deducting
        if (deductBalance && buyPrice && typeof buyPrice === 'number' && !isNaN(buyPrice) && buyPrice > 0 && user?.loginid) {
          deductBalance(buyPrice, user.loginid);
        } else if (deductBalance && (!buyPrice || isNaN(buyPrice) || buyPrice <= 0)) {
          console.error('[TradeExecution] Cannot deduct balance: buyPrice is invalid', { buyPrice, contractId });
        }
        
        // Request balance update from WebSocket to sync with server
        if (requestBalanceUpdate && user?.loginid) {
          requestBalanceUpdate(user.loginid);
        }
        
        toast({
          title: `✅ Accumulator Contract Purchased`,
          description: `Contract ID: ${contractId}${payout ? ` | Payout: $${payout.toFixed(2)}` : ''}`,
        });

        // Add position to open positions
        if (onTradePlaced) {
          onTradePlaced({
            contract_id: contractId,
            buy_price: buyPrice,
            payout: payout,
            stake: stake,
            contract_type: 'ACCU',
            trade_type: tradeType,
            symbol: selectedMarket.symbol,
            display_name: selectedMarket.name || selectedMarket.symbol,
            growth_rate: growthRate,
            start_time: Date.now() / 1000,
            profit: 0,
            sell_price: buyPrice,
          });
        }
      }
    } catch (error) {
      // Enhanced error logging for debugging
      toast({
        title: 'Purchase Failed',
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsPurchasing(false);
      lastTradeTimeRef.current = Date.now(); // Update last trade time after completion
    }
  };

  const getPayoutPct = () => {
    if (!proposal || !proposal.payout) return '—';
    return ((proposal.payout / stake * 100) - 100).toFixed(1);
  };

  return (
    <div className="p-2.5 space-y-2.5">
      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
          <p className="text-xs text-yellow-800">
            ⚠️ You need to connect your account to trade
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Label className="text-sm">Growth rate</Label>
          <Info className="h-4 w-4 text-gray-400" />
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {growthRateOptions.map((rate) => {
            const ratePercent = (rate * 100).toFixed(0);
            const isSelected = growthRate === rate;
            return (
              <Button
                key={rate}
                type="button"
                variant={isSelected ? "default" : "outline"}
                className={`w-full h-9 text-sm font-medium ${isSelected ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                onClick={() => handleGrowthRateSelect(rate)}
                disabled={isLoading}
              >
                {ratePercent}%
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Label className="text-sm">Take profit</Label>
          <Info className="h-4 w-4 text-gray-400" />
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="takeProfit"
            checked={takeProfit}
            onChange={(e) => setTakeProfit(e.target.checked)}
            disabled={isLoading}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="takeProfit" className="text-sm text-gray-700">
            Enable take profit
          </label>
        </div>
        {takeProfit && (
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTakeProfitAmount(prev => {
                const num = typeof prev === 'number' ? prev : (parseFloat(prev) || 0);
                return Math.max(1, num - 10);
              })}
              disabled={isLoading}
              className="h-9 w-9"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              value={takeProfitAmount}
              onChange={e => {
                const value = e.target.value;
                if (value === '') {
                  setTakeProfitAmount('');
                } else {
                  const num = parseFloat(value);
                  if (!isNaN(num) && num >= 1) {
                    setTakeProfitAmount(num);
                  }
                }
              }}
              className="w-24 text-center h-9 text-sm"
              min={1}
              step="1"
              disabled={isLoading}
            />
            <span className="text-sm text-gray-600">USD</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTakeProfitAmount(prev => {
                const num = typeof prev === 'number' ? prev : (parseFloat(prev) || 0);
                return num + 10;
              })}
              disabled={isLoading}
              className="h-9 w-9"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <Label className="text-sm">Stake (USD)</Label>
          {balance && (
            <span className="text-xs text-gray-500">Balance: ${balance}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleStakeChange(-1)}
            disabled={isLoading}
            className="h-9 w-9"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            value={stake}
            onChange={e => setStake(Math.max(1, parseFloat(e.target.value) || 1))}
            className="w-24 text-center h-9 text-sm"
            min={1}
            step="0.01"
            disabled={isLoading}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleStakeChange(1)}
            disabled={isLoading}
            className="h-9 w-9"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border-t pt-2 space-y-1.5">
        {proposal && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Max. payout:</span>
              <span className="font-semibold">${proposal.payout ? proposal.payout.toFixed(2) : '6,000.00'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Max. ticks:</span>
              <span className="font-semibold">250 ticks</span>
            </div>
          </>
        )}
        
        <Button
          className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11 text-sm font-medium"
          onClick={handlePurchase}
          disabled={!proposal || !api || !isConnected || isPurchasing}
        >
          {isPurchasing ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Purchasing...
            </>
          ) : (
            <>
              <BarChart3 className="h-5 w-5 mr-2" />
              Buy
            </>
          )}
        </Button>
      </div>

      {!hidePrediction && (
        <PredictionPanel
          symbol={selectedMarket?.symbol}
          tradeType={tradeType}
          aiPrediction={aiPrediction ? {
            prediction: aiPrediction.direction?.toLowerCase() || aiPrediction.prediction || 'rise',
            confidence: typeof aiPrediction.confidence === 'number' && aiPrediction.confidence > 1 
              ? aiPrediction.confidence / 100 
              : aiPrediction.confidence || 0.65
          } : { prediction: 'rise', confidence: 0.65 }}
          mode="compact"
        />
      )}
    </div>
  );
};

// Digits Execution Component
const DigitsExecution = ({ selectedMarket, tradeType = 'digits', aiPrediction, hidePrediction = false, onBarrierChange, onTradePlaced, hideActionButtons = false, onProposalsSync }) => {
  // Clear barriers for trade types that don't use them
  useEffect(() => {
    if (onBarrierChange) {
      onBarrierChange([]);
    }
  }, [onBarrierChange]);
  
  const [stake, setStake] = useState(10);
  const [durationValue, setDurationValue] = useState(1);
  const [digitValue, setDigitValue] = useState(5);
  const [positiveProposal, setPositiveProposal] = useState(null);
  const [negativeProposal, setNegativeProposal] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const lastTradeTimeRef = useRef(0); // Track last trade attempt time for cooldown
  const { toast } = useToast();
  const { api, connected: isConnected, user, deductBalance, requestBalanceUpdate, login } = useDerivAPI();
  const balance = user?.balance || 0;
  // Use useMemo to make it reactive to user and balance changes
  const canTrade = useMemo(() => {
    const hasValidToken = user?.token ? isValidAuthToken(user.token) : isUserAuthenticated();
    if (!hasValidToken) return false;
    return balance > 0;
  }, [user, balance]);
  const prevTradeTypeRef = useRef(null);
  const isMountedRef = useRef(false);

  // Clear proposals immediately when tradeType changes to ensure fresh fetch
  // For digits trade types, set isLoading to false to keep buttons enabled during fetch
  useEffect(() => {
    setPositiveProposal(null);
    setNegativeProposal(null);
    // For digits trades, keep isLoading false to enable buttons while fetching proposals
    // For other trades, set to true to show loading state
    const digitsTradeTypes = ['matches_differs', 'even_odd', 'over_under'];
    const isDigitsTrade = digitsTradeTypes.includes(tradeType);
    setIsLoading(!isDigitsTrade); // Only set loading for non-digits trades
    // Reset prevTradeTypeRef to force fetch effect to detect the change
    prevTradeTypeRef.current = null;
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, [tradeType]);
  
  // DigitsIcon function to provide specific symbols for digit trade types
  const DigitsIcon = (label) => {
    if (label === 'Matches') return <span className="text-lg font-bold">✓</span>;
    if (label === 'Even') return <span className="text-lg font-bold">●</span>;
    if (label === 'Over') return <ChevronUp className="h-5 w-5" />;
    if (label === 'Differs') return <span className="text-lg font-bold">≠</span>;
    if (label === 'Odd') return <span className="text-lg font-bold">○</span>;
    if (label === 'Under') return <ChevronDown className="h-5 w-5" />;
    return null;
  };
  
  // Get button configuration based on tradeType
  const buttonLabels = getActionButtonLabels(tradeType);
  
  // Map tradeType to contract types - memoized to prevent unnecessary re-renders
  const contractTypes = useMemo(() => {
    switch(tradeType) {
      case 'matches_differs':
        return { positive: 'DIGITMATCH', negative: 'DIGITDIFF' };
      case 'even_odd':
        return { positive: 'DIGITEVEN', negative: 'DIGITODD' };
      case 'over_under':
        return { positive: 'DIGITOVER', negative: 'DIGITUNDER' };
      default:
        return { positive: 'DIGITMATCH', negative: 'DIGITDIFF' };
    }
  }, [tradeType]);

  // Fetch proposals for both positive and negative buttons
  const fetchProposal = useCallback(async (contractType) => {
    if (!selectedMarket?.symbol || stake <= 0 || !api || !isConnected) {
      return null;
    }

    const baseParams = {
      proposal: 1,
      // Note: subscribe parameter is not supported for DIGIT contract types
      // Omitting subscribe for DIGITMATCH, DIGITDIFF, DIGITEVEN, DIGITODD, DIGITOVER, DIGITUNDER
      amount: stake,
      basis: 'stake',
      contract_type: contractType,
      currency: 'USD',
      symbol: selectedMarket.symbol,
      duration: durationValue,
      duration_unit: 't',
    };
    
    // Only add barrier for matches_differs and over_under (not for even_odd)
    if (tradeType === 'matches_differs' || tradeType === 'over_under') {
      baseParams.barrier = digitValue.toString();
    }


    try {
      const response = await api.send(baseParams);
      
      if (response.error) {
        // Only show error if trade type actually changed
        const tradeTypeChanged = prevTradeTypeRef.current !== tradeType;
        if (tradeTypeChanged) {
          toast({
            title: 'Proposal Error',
            description: response.error.message || `Failed to get proposal for ${contractType}`,
            variant: 'destructive',
            duration: 3000
          });
        }
        return null;
      }
      
      // Handle different response structures
      if (response.proposal) {
        return response.proposal;
      } else if (response.proposal_open_contract) {
        // Some APIs return proposal_open_contract
        return response.proposal_open_contract;
      } else if (response.msg_type === 'proposal' && response.proposal) {
        return response.proposal;
      } else {
        return null;
      }
    } catch (error) {
      // Only show error if trade type actually changed
      const tradeTypeChanged = prevTradeTypeRef.current !== tradeType;
      if (tradeTypeChanged) {
        toast({
          title: 'Connection Error',
          description: `Failed to fetch proposal: ${error.message || 'Unknown error'}`,
          variant: 'destructive',
          duration: 3000
        });
      }
      return null;
    }
  }, [selectedMarket, stake, api, isConnected, digitValue, durationValue, tradeType]);

  const isFetchingRef = useRef(false);
  
  // Function to refresh proposals - can be called after successful trades
  const refreshProposals = useCallback(async (showLoading = false) => {
    if (!selectedMarket?.symbol || !api || !isConnected) {
      return;
    }
    
    // Skip if already fetching to prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      return;
    }
    
    if (showLoading) {
      setIsLoading(true);
    }
    isFetchingRef.current = true;
    
    try {
      const [positiveData, negativeData] = await Promise.all([
        fetchProposal(contractTypes.positive),
        fetchProposal(contractTypes.negative)
      ]);
      if (isMountedRef.current) {
        setPositiveProposal(positiveData);
        setNegativeProposal(negativeData);
      }
    } catch (error) {
      // Don't log expected errors (WebSocket not connected, AlreadySubscribed, WrongResponse)
      const errorMessage = error?.message || error?.toString() || '';
      const errorCode = error?.code;
      const isExpectedError = 
        errorMessage.includes('WebSocket not connected') || 
        errorCode === 'AlreadySubscribed' ||
        errorCode === 'WrongResponse' ||
        errorCode === 'RateLimit' ||
        errorMessage.includes('WrongResponse') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('RateLimit');
      if (!isExpectedError) {
      } else {
      }
    } finally {
      if (showLoading && isMountedRef.current) {
        setIsLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [selectedMarket?.symbol, api, isConnected, tradeType, contractTypes, fetchProposal]);
  
  useEffect(() => {
    const tradeTypeChanged = prevTradeTypeRef.current !== tradeType;
    const isInitialMount = prevTradeTypeRef.current === undefined || prevTradeTypeRef.current === null;
    prevTradeTypeRef.current = tradeType;
    
    const fetchProposals = async () => {
      if (!selectedMarket?.symbol || !api || !isConnected) {
        // Clear proposals if requirements not met
        setPositiveProposal(null);
        setNegativeProposal(null);
        return;
      }
      
      // For digits trade types, don't set loading state to keep buttons enabled
      // Only set loading for non-digits trade types or when explicitly requested
      const digitsTradeTypes = ['matches_differs', 'even_odd', 'over_under'];
      const isDigitsTrade = digitsTradeTypes.includes(tradeType);
      
      if (!isDigitsTrade) {
        setIsLoading(true);
      }
      try {
        const [positiveData, negativeData] = await Promise.all([
          fetchProposal(contractTypes.positive),
          fetchProposal(contractTypes.negative)
        ]);
        
        if (isMountedRef.current) {
          setPositiveProposal(positiveData);
          setNegativeProposal(negativeData);
        }
      } catch (error) {
        // Don't log expected errors (WebSocket not connected, AlreadySubscribed, WrongResponse)
        const errorMessage = error?.message || error?.toString() || '';
        const errorCode = error?.code;
        const isExpectedError = 
          errorMessage.includes('WebSocket not connected') || 
          errorCode === 'AlreadySubscribed' ||
          errorCode === 'WrongResponse' ||
          errorCode === 'RateLimit' ||
          errorMessage.includes('WrongResponse') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('RateLimit');
        if (!isExpectedError) {
        } else {
        }
        // Clear proposals on error to ensure buttons are properly disabled
        if (isMountedRef.current) {
          setPositiveProposal(null);
          setNegativeProposal(null);
        }
      } finally {
        // Reset loading state for all trade types after fetch completes
        if (isMountedRef.current) {
          if (!isDigitsTrade) {
            // For non-digits trades, keep buttons disabled for a short time (500ms) then re-enable
            setTimeout(() => {
              if (isMountedRef.current) {
                setIsLoading(false);
              }
            }, 500);
          } else {
            // For digits trades, ensure isLoading is false to enable buttons
            setIsLoading(false);
          }
        }
      }
    };

    // Fetch immediately on initial mount or trade type change, debounce only for parameter changes
    // Increased debounce to 800ms to prevent rate limit errors
    if (isInitialMount || tradeTypeChanged) {
      fetchProposals();
    } else {
      const timeoutId = setTimeout(fetchProposals, 800);
      return () => clearTimeout(timeoutId);
    }
  }, [fetchProposal, selectedMarket?.symbol, api, isConnected, tradeType, contractTypes, durationValue]);

  const handleStakeChange = (amount) => setStake(prev => Math.max(1, prev + amount));
  const handlePayoutChange = (amount) => setPayout(prev => Math.max(1, prev + amount));
  const handleDurationChange = (amount) => {
    const minValue = durationUnit === 't' ? 1 : (durationUnit === 'm' ? 1 : (durationUnit === 'h' ? 1 : 1));
    setDurationValue(prev => Math.max(minValue, prev + amount));
  };

  const handlePurchase = async (proposal, contractType, label, tradeTypeParam = tradeType) => {
    // Log token and wallet information when trade button is clicked
    logTradeButtonClick(user, balance, label || contractType || '', proposal?.id);
    
    // Prevent duplicate requests - critical for real-time trading
    if (isPurchasing) {
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

    // Check if user is logged in (either user state is set or token exists in localStorage)
    const hasValidToken = user?.token ? isValidAuthToken(user.token) : isUserAuthenticated();
    if (!hasValidToken) {
      toast({
        title: 'Login Required',
        description: 'Please log in to your account to place trades',
        variant: 'destructive'
      });
      return;
    }

    // CRITICAL: Use selected account balance from localStorage (most accurate for selected account)
    // This ensures we check the correct account's balance, not the first account's balance
    const selectedAccount = getSelectedAccountFromStorage();
    const currentAccountBalance = selectedAccount?.balance ?? user?.balance ?? balance ?? 0;
    
    // CRITICAL: Prevent trading if selected account doesn't match authenticated account
    if (selectedAccount && user?.loginid && selectedAccount.loginid !== user.loginid) {
      toast({
        title: 'Account Not Ready',
        description: `Please wait for account switch to complete. Selected: ${selectedAccount.loginid}, Authenticated: ${user.loginid}`,
        variant: 'destructive',
        duration: 3000,
      });
      return;
    }
    
    console.log('[TradeExecution] Current Account Balance:', currentAccountBalance,selectedAccount?.balance, user?.balance,selectedAccount?.loginid || user?.loginid,user);
    // if (currentAccountBalance <= 0) {
    //   toast({
    //     title: 'Insufficient Balance',
    //     description: `Your account balance (${currentAccountBalance.toFixed(2)} USD) is insufficient to buy this contract (${(proposal?.ask_price || stake).toFixed(2)} USD).`,
    //     variant: 'destructive'
    //   });
    //   return;
    // }

    if (!proposal?.id) {
      toast({
        title: 'No Proposal',
        description: 'Please wait for proposal to load',
        variant: 'destructive'
      });
      return;
    }

    if (currentAccountBalance && stake > currentAccountBalance) {
      toast({
        title: 'Insufficient Balance',
        description: `You need ${stake} USD but have ${currentAccountBalance.toFixed(2)} USD`,
        variant: 'destructive'
      });
      return;
    }

    // CRITICAL: Extract wallet information and save to localStorage
    const walletLoginid = selectedAccount?.loginid || user?.loginid || '';
    const walletAmount = currentAccountBalance || user?.balance || balance || 0;
    const walletToken = user?.token || '';
    
    // Save wallet information to localStorage
    try {
      const walletData = {
        loginid: walletLoginid,
        amount: walletAmount,
        token: walletToken,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('deriv_wallet_trade', JSON.stringify(walletData));
      
      // Console log wallet information
      console.log('[TradeExecution] Wallet Information:', {
        loginid: walletLoginid,
        amount: walletAmount,
        token: walletToken ? `${walletToken.substring(0, 20)}...` : 'No token',
        timestamp: walletData.timestamp
      });
    } catch (e) {
      console.error('[TradeExecution] Error saving wallet data to localStorage:', e);
    }

    setIsPurchasing(true);
    try {
      // Always fetch a fresh proposal for each trade to avoid InvalidContractProposal
      // Each proposal ID can only be used once, so we need a new one for each trade
      let currentProposal = proposal;
      
      // Disable trade button while fetching fresh proposal
      setIsLoading(true);
      
      // Fetch fresh proposal before purchase to ensure unique proposal ID
      // CRITICAL: Use only current token from user state, not localStorage
      try {
        const freshProposal = await fetchProposal(contractType);
        if (freshProposal && freshProposal.id) {
          currentProposal = freshProposal;
        } else {
        }
      } catch (fetchError) {
        // Continue with existing proposal if fetch fails
      } finally {
        // Re-enable button after short delay
        setTimeout(() => {
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        }, 300);
      }
      
      // Validate proposal before sending
      if (!currentProposal.id) {
        throw new Error('Invalid proposal: missing proposal ID');
      }
      
      const buyPrice = currentProposal.ask_price || currentProposal.payout;
      if (!buyPrice || buyPrice <= 0) {
        throw new Error('Invalid proposal: missing or invalid price');
      }

      // CRITICAL: Ensure we're using user's OAuth token, not API token
      // Only uses token from user state, not localStorage
      const canTrade = await ensureUserAccountAuthenticated({ user, login, toast });
      if (!canTrade) {
        setIsPurchasing(false);
        return; // Error already shown by ensureUserAccountAuthenticated
      }

      const response = await api.send({
        buy: currentProposal.id,
        price: buyPrice,
      });

      // Check for API errors
      if (response.error) {
        const errorCode = response.error.code;
        const errorMessage = response.error.message || 'Purchase failed';
        
        // Handle InvalidContractProposal and InvalidSellContractProposal - fetch fresh proposal and retry
        if (errorCode === 'InvalidContractProposal' || errorCode === 'InvalidSellContractProposal') {
          
          try {
            const freshProposal = await fetchProposal(contractType);
            if (freshProposal && freshProposal.id) {
              // Retry purchase with fresh proposal
              const retryResponse = await api.send({
                buy: freshProposal.id,
                price: freshProposal.ask_price || freshProposal.payout,
              });
              
              if (retryResponse.error) {
                const retryError = new Error(retryResponse.error.message || 'Purchase failed after refreshing proposal');
                retryError.code = retryResponse.error.code;
                retryError.apiError = retryResponse.error;
                throw retryError;
              }
              
              if (retryResponse.buy) {
                const retryBuyPrice = retryResponse.buy.buy_price;
                
                // CRITICAL: Deduct balance immediately after successful trade
                // Use selectedAccount loginid if available, otherwise use user loginid
                const selectedAccount = getSelectedAccountFromStorage();
                const accountLoginid = selectedAccount?.loginid || user?.loginid;
                // Validate retryBuyPrice is a valid number before deducting
                if (deductBalance && retryBuyPrice && typeof retryBuyPrice === 'number' && !isNaN(retryBuyPrice) && retryBuyPrice > 0 && accountLoginid) {
                  deductBalance(retryBuyPrice, accountLoginid);
                } else if (deductBalance && (!retryBuyPrice || isNaN(retryBuyPrice) || retryBuyPrice <= 0)) {
                  console.error('[TradeExecution] Cannot deduct balance: retryBuyPrice is invalid', { retryBuyPrice, contractId: retryResponse.buy?.contract_id });
                }
                
                // Request balance update from WebSocket to sync with server
                if (requestBalanceUpdate && accountLoginid) {
                  requestBalanceUpdate(accountLoginid);
                }
                
                const description = (tradeTypeParam === 'matches_differs' || tradeTypeParam === 'over_under') 
                  ? `${label} ${digitValue} | Contract ID: ${retryResponse.buy.contract_id}`
                  : `${label} | Contract ID: ${retryResponse.buy.contract_id}`;
                
                toast({
                  title: `✅ ${label} Contract Purchased`,
                  description: description,
                });
                
                if (onTradePlaced) {
                  const tradeData = {
                    contract_id: retryResponse.buy.contract_id,
                    buy_price: retryResponse.buy.buy_price,
                    payout: retryResponse.buy.payout,
                    contract_type: contractType,
                    symbol: selectedMarket.symbol,
                    duration: durationValue,
                    stake: stake,
                  };
                  
                  // Only include barrier for matches_differs and over_under
                  if (tradeTypeParam === 'matches_differs' || tradeTypeParam === 'over_under') {
                    tradeData.barrier = digitValue.toString();
                  }
                  
                  onTradePlaced(tradeData);
                }
                // Refresh proposals after successful trade
                setTimeout(() => refreshProposals(false), 100);
                return; // Success, exit early
              }
            } else {
              throw new Error('Failed to fetch fresh proposal. Please try again.');
            }
          } catch (retryError) {
            throw new Error(retryError.message || 'Failed to refresh proposal and retry purchase');
          }
        }
        
        // Provide more specific error messages for other errors
        let userMessage = errorMessage;
        if (errorCode === 'InvalidContract') {
          userMessage = 'Invalid contract parameters. Please check your trade settings.';
        } else if (errorCode === 'InsufficientBalance') {
          // Show the actual account balance from selected account for better error message
          // Note: selectedAccount is already declared at the top of this function (line 6003)
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
        } else if (errorCode === 'RateLimit') {
          userMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (errorCode === 'InvalidContractProposal') {
          userMessage = 'Proposal expired. Please try again - a fresh proposal will be fetched automatically.';
        }
        
        // Preserve API error details in the error object
        const apiError = new Error(userMessage);
        apiError.code = errorCode;
        apiError.apiError = response.error;
        throw apiError;
      }

      // Validate successful response
      if (!response.buy) {
        throw new Error('Invalid response: missing buy data');
      }

      if (!response.buy.contract_id) {
        throw new Error('Invalid response: missing contract ID');
      }

      const actualBuyPrice = response.buy.buy_price;
      
      // CRITICAL: Deduct balance immediately after successful trade
      // Use selectedAccount loginid if available, otherwise use user loginid
      const selectedAccount = getSelectedAccountFromStorage();
      const accountLoginid = selectedAccount?.loginid || user?.loginid;
      // Validate actualBuyPrice is a valid number before deducting
      if (deductBalance && actualBuyPrice && typeof actualBuyPrice === 'number' && !isNaN(actualBuyPrice) && actualBuyPrice > 0 && accountLoginid) {
        deductBalance(actualBuyPrice, accountLoginid);
      } else if (deductBalance && (!actualBuyPrice || isNaN(actualBuyPrice) || actualBuyPrice <= 0)) {
        console.error('[TradeExecution] Cannot deduct balance: actualBuyPrice is invalid', { actualBuyPrice, contractId: response.buy?.contract_id });
      }
      
      // Request balance update from WebSocket to sync with server
      if (requestBalanceUpdate && accountLoginid) {
        requestBalanceUpdate(accountLoginid);
      }

      const description = (tradeTypeParam === 'matches_differs' || tradeTypeParam === 'over_under') 
        ? `${label} ${digitValue} | Contract ID: ${response.buy.contract_id}`
        : `${label} | Contract ID: ${response.buy.contract_id}`;
      
      toast({
        title: `✅ ${label} Contract Purchased`,
        description: description,
      });
      
      if (onTradePlaced) {
        const tradeData = {
          contract_id: response.buy.contract_id,
          buy_price: response.buy.buy_price,
          payout: response.buy.payout,
          contract_type: contractType,
          symbol: selectedMarket.symbol,
          duration: durationValue,
          stake: stake,
        };
        
        // Only include barrier for matches_differs and over_under
        if (tradeTypeParam === 'matches_differs' || tradeTypeParam === 'over_under') {
          tradeData.barrier = digitValue.toString();
        }
        
        onTradePlaced(tradeData);
      }
      
      // Refresh proposals after successful trade to update buttons with fresh proposal IDs
      setTimeout(() => refreshProposals(false), 100);
    } catch (error) {
      // Enhanced error logging for debugging
      
      // Provide user-friendly error message
      const errorMessage = error.message || 'An unexpected error occurred. Please try again.';
      
      toast({
        title: 'Purchase Failed',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000, // Show error for 5 seconds
      });
    } finally {
      setIsPurchasing(false);
      lastTradeTimeRef.current = Date.now(); // Update last trade time after completion
    }
  };

  const getPayoutPct = (proposal) => {
    if (!proposal || !proposal.payout) return '—';
    return ((proposal.payout / stake * 100) - 100).toFixed(2);
  };

  const getPayoutAmount = (proposal) => {
    if (!proposal || !proposal.payout) return '—';
    return proposal.payout.toFixed(2);
  };

  // Use refs to store latest function references to prevent infinite loops
  const handlePurchaseRef = useRef(handlePurchase);
  const toastRef = useRef(toast);
  
  // Update refs when functions change
  useEffect(() => {
    handlePurchaseRef.current = handlePurchase;
    toastRef.current = toast;
  }, [handlePurchase, toast]);

  // Sync proposals and button handlers to parent component for mobile footer buttons
  useEffect(() => {
    if (onProposalsSync) {
      const handlePositiveClick = () => {
        if (!canTrade) {
          toastRef.current({
            title: 'Login Required',
            description: 'Please log in with an account that has a non-zero balance to place trades',
            variant: 'destructive'
          });
          return;
        }
        if (!positiveProposal) {
          toastRef.current({
            title: 'Proposal Not Available',
            description: 'Please wait for the proposal to load or check your connection.',
            variant: 'destructive'
          });
          return;
        }
        if (!api || !isConnected) {
          toastRef.current({
            title: 'Not Connected',
            description: 'Please wait for connection to be established.',
            variant: 'destructive'
          });
          return;
        }
        handlePurchaseRef.current(positiveProposal, contractTypes.positive, buttonLabels.positive, tradeType);
      };

      const handleNegativeClick = () => {
        if (!canTrade) {
          toastRef.current({
            title: 'Login Required',
            description: 'Please log in with an account that has a non-zero balance to place trades',
            variant: 'destructive'
          });
          return;
        }
        if (!negativeProposal) {
          toastRef.current({
            title: 'Proposal Not Available',
            description: 'Please wait for the proposal to load or check your connection.',
            variant: 'destructive'
          });
          return;
        }
        if (!api || !isConnected) {
          toastRef.current({
            title: 'Not Connected',
            description: 'Please wait for connection to be established.',
            variant: 'destructive'
          });
          return;
        }
        handlePurchaseRef.current(negativeProposal, contractTypes.negative, buttonLabels.negative, tradeType);
      };

      const positiveLabel = `${buttonLabels.positive}${(tradeType === 'matches_differs' || tradeType === 'over_under') ? ` ${digitValue}` : ''}`;
      const negativeLabel = `${buttonLabels.negative}${(tradeType === 'matches_differs' || tradeType === 'over_under') ? ` ${digitValue}` : ''}`;

      onProposalsSync({
        positive: {
          label: positiveLabel,
          proposal: positiveProposal,
          onClick: handlePositiveClick,
          disabled: !api || !isConnected || !canTrade || isPurchasing,
          isLoading: isPurchasing || isLoading,
          color: 'bg-green-500 hover:bg-green-600',
          icon: () => DigitsIcon(buttonLabels.positive)
        },
        negative: buttonLabels.negative ? {
          label: negativeLabel,
          proposal: negativeProposal,
          onClick: handleNegativeClick,
          disabled: !api || !isConnected || !canTrade || isPurchasing,
          isLoading: isPurchasing || isLoading,
          color: 'bg-red-500 hover:bg-red-600',
          icon: () => DigitsIcon(buttonLabels.negative)
        } : null
      });
    }
  }, [positiveProposal, negativeProposal, isPurchasing, isLoading, canTrade, api, isConnected, onProposalsSync, contractTypes, buttonLabels, tradeType, digitValue]);

  return (
    <div className="p-2 space-y-1.5">
      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
          <p className="text-xs text-yellow-800">
            ⚠️ You need to connect your account to trade
          </p>
        </div>
      )}

      {/* Only show digit selection grid for matches_differs and over_under (not for even_odd) */}
      {(tradeType === 'matches_differs' || tradeType === 'over_under') && (
        <div className="mb-4">
          <Label className="text-base font-semibold mb-3 block text-gray-700">Last Digit Prediction</Label>
          <div className="grid grid-cols-5 gap-2.5">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <Button
                key={digit}
                variant="outline"
                className={cn(
                  "h-14 w-full text-xl font-semibold transition-all rounded-lg border-2",
                  digitValue === digit
                    ? "bg-gray-600 text-white border-gray-700 hover:bg-gray-700 shadow-md"
                    : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
                )}
                onClick={() => setDigitValue(digit)}
                disabled={isLoading}
              >
                {digit}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label>Duration (Ticks)</Label>
        <div className="flex items-center gap-2 mt-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleDurationChange(-1)}
            disabled={isLoading}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            value={durationValue}
            onChange={e => setDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-24 text-center"
            min={1}
            disabled={isLoading}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleDurationChange(1)}
            disabled={isLoading}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-0.5">
          <Label className="text-xs">Stake (USD)</Label>
          {balance && (
            <span className="text-xs text-gray-500">Balance: ${balance}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleStakeChange(-1)}
            disabled={isLoading}
            className="h-8 w-8"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Input
            type="number"
            value={stake}
            onChange={e => setStake(Math.max(1, parseFloat(e.target.value) || 1))}
            className="w-20 text-center h-8 text-sm"
            min={1}
            step="0.01"
            disabled={isLoading}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleStakeChange(1)}
            disabled={isLoading}
            className="h-8 w-8"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-1.5 space-y-1.5">
        {/* Positive Button (Matches/Even/Over) */}
        <StyledTradeButton
          label={`${buttonLabels.positive}${(tradeType === 'matches_differs' || tradeType === 'over_under') ? ` ${digitValue}` : ''}`}
          proposal={positiveProposal}
          icon={() => DigitsIcon(buttonLabels.positive)}
          color={buttonLabels.color || 'bg-teal-500 hover:bg-teal-600'}
          onClick={() => {
            // CRITICAL: Use selected account balance, not primary account balance
            const selectedAccount = getSelectedAccountFromStorage();
            let accountBalance = 0;
            
            // Priority 1: Selected account balance from localStorage
            if (selectedAccount?.balance !== undefined && selectedAccount.balance !== null) {
              accountBalance = parseFloat(selectedAccount.balance) || 0;
            }
            
            // Priority 2: Selected account balance from liveBalances
            if (accountBalance <= 0 && selectedAccount?.loginid && user?.liveBalances?.[selectedAccount.loginid]) {
              accountBalance = user.liveBalances[selectedAccount.loginid].balance || 0;
            }
            
            // Priority 3: Selected account from accounts array
            if (accountBalance <= 0 && selectedAccount?.loginid && user?.accounts) {
              const accountInList = user.accounts.find(acc => acc.loginid === selectedAccount.loginid);
              if (accountInList?.balance !== undefined && accountInList.balance !== null) {
                accountBalance = parseFloat(accountInList.balance) || 0;
              }
            }
            
            // Priority 4: Fallback to user.balance (primary account)
            if (accountBalance <= 0 && user?.balance) {
              accountBalance = user.balance;
            }
            
            const hasValidAuth = accountBalance > 0 || 
                                 (user?.token && isValidAuthToken(user.token)) || 
                                 isUserAuthenticated();
            
            if (!hasValidAuth) {
              toast({
                title: 'Login Required',
                description: 'Please log in to place trades',
                variant: 'destructive'
              });
              return;
            }
            
            if (accountBalance <= 0) {
              toast({
                title: 'Insufficient Balance',
                description: `Selected account (${selectedAccount?.loginid || user?.loginid || 'current'}) has ${accountBalance.toFixed(2)} USD. Please ensure your account has a balance greater than 0.`,
                variant: 'destructive'
              });
              return;
            }
            if (positiveProposal && api && isConnected && !isPurchasing && !isLoading) {
              handlePurchase(positiveProposal, contractTypes.positive, buttonLabels.positive, tradeType);
            } else if (!positiveProposal && !isLoading) {
              toast({
                title: 'Proposal Not Available',
                description: 'Please wait for the proposal to load or check your connection.',
                variant: 'destructive'
              });
            }
          }}
          // For digits trade types, don't disable buttons when proposals are null or loading (they'll be checked in onClick)
          // This prevents buttons from being disabled when trade type changes
          disabled={!api || !isConnected || isPurchasing}
          isLoading={isPurchasing || isLoading}
          getPayoutPct={getPayoutPct}
          getPayoutAmount={getPayoutAmount}
        />

        {/* Negative Button (Differs/Odd/Under) */}
        {buttonLabels.negative && (
          <StyledTradeButton
            label={`${buttonLabels.negative}${(tradeType === 'matches_differs' || tradeType === 'over_under') ? ` ${digitValue}` : ''}`}
            proposal={negativeProposal}
            icon={() => DigitsIcon(buttonLabels.negative)}
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
              if (negativeProposal && api && isConnected && !isPurchasing && !isLoading) {
                handlePurchase(negativeProposal, contractTypes.negative, buttonLabels.negative, tradeType);
              } else if (!negativeProposal && !isLoading) {
                toast({
                  title: 'Proposal Not Available',
                  description: 'Please wait for the proposal to load or check your connection.',
                  variant: 'destructive'
                });
              }
            }}
            // For digits trade types, don't disable buttons when proposals are null or loading (they'll be checked in onClick)
            // This prevents buttons from being disabled when trade type changes
            disabled={!api || !isConnected || isPurchasing}
            isLoading={isPurchasing || isLoading}
            getPayoutPct={getPayoutPct}
            getPayoutAmount={getPayoutAmount}
          />
        )}
      </div>

      {!hidePrediction && (
        <div className="min-h-[60px] flex-shrink-0">
          <PredictionPanel
            symbol={selectedMarket?.symbol}
            tradeType={tradeType}
            digitPrediction={aiPrediction?.digitPrediction}
            digitConfidence={aiPrediction?.digitConfidence}
            aiPrediction={aiPrediction ? {
              prediction: aiPrediction.direction?.toLowerCase() || aiPrediction.prediction || 'digits',
              confidence: typeof aiPrediction.confidence === 'number' && aiPrediction.confidence > 1 
                ? aiPrediction.confidence / 100 
                : aiPrediction.confidence || 0.65
            } : { prediction: 'digits', confidence: 0.65 }}
            mode="compact"
          />
        </div>
      )}
    </div>
  );
};

// Main TradeExecution Component
const TradeExecution = ({ tradeType, selectedMarket, aiPrediction, onBarrierChange, hidePrediction = false, onTradePlaced, openPositions, hideActionButtons = false, onProposalsSync }) => {
  // Check if selectedMarket exists
  if (!selectedMarket) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">Please select a market to trade</p>
      </div>
    );
  }

  switch (tradeType) {
    case 'rise_fall':
      return <RiseFallExecution selectedMarket={selectedMarket} tradeType={tradeType} aiPrediction={aiPrediction} onBarrierChange={onBarrierChange} hidePrediction={hidePrediction} onTradePlaced={onTradePlaced} openPositions={openPositions} hideActionButtons={hideActionButtons} onProposalsSync={onProposalsSync} />;
    case 'higher_lower':
      return <HigherLowerExecution selectedMarket={selectedMarket} tradeType={tradeType} aiPrediction={aiPrediction} onBarrierChange={onBarrierChange} hidePrediction={hidePrediction} onTradePlaced={onTradePlaced} openPositions={openPositions} hideActionButtons={hideActionButtons} onProposalsSync={onProposalsSync} />;
    case 'digits':
    case 'matches_differs':
    case 'even_odd':
    case 'over_under':
      return <DigitsExecution selectedMarket={selectedMarket} tradeType={tradeType} aiPrediction={aiPrediction} onBarrierChange={onBarrierChange} hidePrediction={hidePrediction} onTradePlaced={onTradePlaced} hideActionButtons={hideActionButtons} onProposalsSync={onProposalsSync} />;
    case 'call_put':
      return <CallPutExecution selectedMarket={selectedMarket} tradeType={tradeType} aiPrediction={aiPrediction} onBarrierChange={onBarrierChange} hidePrediction={hidePrediction} onTradePlaced={onTradePlaced} hideActionButtons={hideActionButtons} onProposalsSync={onProposalsSync} />;
    case 'turbos':
      return <TurbosExecution selectedMarket={selectedMarket} tradeType={tradeType} aiPrediction={aiPrediction} onBarrierChange={onBarrierChange} hidePrediction={hidePrediction} onTradePlaced={onTradePlaced} hideActionButtons={hideActionButtons} onProposalsSync={onProposalsSync} />;
    case 'touch_no_touch':
      return <TouchNoTouchExecution selectedMarket={selectedMarket} tradeType={tradeType} aiPrediction={aiPrediction} onBarrierChange={onBarrierChange} hidePrediction={hidePrediction} onTradePlaced={onTradePlaced} hideActionButtons={hideActionButtons} onProposalsSync={onProposalsSync} />;
    case 'ends_in_out':
      return <EndsInOutExecution selectedMarket={selectedMarket} tradeType={tradeType} aiPrediction={aiPrediction} onBarrierChange={onBarrierChange} hidePrediction={hidePrediction} onTradePlaced={onTradePlaced} hideActionButtons={hideActionButtons} onProposalsSync={onProposalsSync} />;
    case 'stays_in_goes_out':
      return <StaysInGoesOutExecution selectedMarket={selectedMarket} tradeType={tradeType} aiPrediction={aiPrediction} onBarrierChange={onBarrierChange} hidePrediction={hidePrediction} onTradePlaced={onTradePlaced} hideActionButtons={hideActionButtons} onProposalsSync={onProposalsSync} />;
    case 'multipliers':
      return <MultipliersExecution selectedMarket={selectedMarket} tradeType={tradeType} aiPrediction={aiPrediction} onBarrierChange={onBarrierChange} hidePrediction={hidePrediction} onTradePlaced={onTradePlaced} openPositions={openPositions} hideActionButtons={hideActionButtons} onProposalsSync={onProposalsSync} />;
    case 'accumulators':
      return <AccumulatorsExecution selectedMarket={selectedMarket} tradeType={tradeType} aiPrediction={aiPrediction} onBarrierChange={onBarrierChange} hidePrediction={hidePrediction} onTradePlaced={onTradePlaced} openPositions={openPositions} hideActionButtons={hideActionButtons} onProposalsSync={onProposalsSync} />;
    default:
      return <RiseFallExecution selectedMarket={selectedMarket} tradeType={tradeType} aiPrediction={aiPrediction} onBarrierChange={onBarrierChange} hidePrediction={hidePrediction} onTradePlaced={onTradePlaced} openPositions={openPositions} hideActionButtons={hideActionButtons} onProposalsSync={onProposalsSync} />;
  }
};

export default TradeExecution;