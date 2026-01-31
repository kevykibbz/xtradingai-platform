/**
 * Shared utilities for trade execution
 * Ensures consistent use of selected account balance across all trade types
 */

import { isAPIToken, getUserOAuthToken } from '@/lib/utils';

// Helper function to get selected account from localStorage
export const getSelectedAccountFromStorage = () => {
  try {
    const saved = localStorage.getItem('deriv_selectedAccount');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.loginid) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('[TradeExecution] Error getting selectedAccount from localStorage:', e);
  }
  return null;
};

/**
 * Validates trade preconditions before execution
 * @param {Object} params - Validation parameters
 * @param {boolean} params.isPurchasing - Whether a purchase is in progress
 * @param {number} params.lastTradeTime - Timestamp of last trade
 * @param {Object} params.api - API instance
 * @param {boolean} params.isConnected - WebSocket connection status
 * @param {Object} params.user - User state
 * @param {Object} params.proposal - Trade proposal
 * @param {number} params.stake - Trade stake amount
 * @param {Function} params.toast - Toast notification function
 * @returns {Object} Validation result with { isValid: boolean, error?: string, selectedAccount?: Object, currentAccountBalance?: number }
 */
export const validateTradePreconditions = ({
  isPurchasing,
  lastTradeTime,
  api,
  isConnected,
  user,
  proposal,
  stake,
  toast,
}) => {
  // Prevent duplicate requests
  if (isPurchasing) {
    return { isValid: false, error: 'Trade already in progress' };
  }

  // Cooldown check (300ms minimum between trades)
  const COOLDOWN_MS = 300;
  const now = Date.now();
  const timeSinceLastTrade = now - lastTradeTime;
  
  if (timeSinceLastTrade < COOLDOWN_MS) {
    const remainingTime = ((COOLDOWN_MS - timeSinceLastTrade) / 1000).toFixed(1);
    toast({
      title: 'Please Wait',
      description: `Please wait ${remainingTime} seconds before placing another trade to avoid rate limits.`,
      variant: 'destructive',
      duration: 2000,
    });
    return { isValid: false, error: 'Cooldown period' };
  }

  // Connection check
  if (!api || !isConnected) {
    toast({
      title: 'Not Connected',
      description: 'Please connect to your account first',
      variant: 'destructive'
    });
    return { isValid: false, error: 'Not connected' };
  }

  // Get selected account from localStorage (CRITICAL: Always use selected account)
  const selectedAccount = getSelectedAccountFromStorage();
  const currentAccountBalance = selectedAccount?.balance ?? user?.balance ?? 0;

  // CRITICAL: Prevent trading if selected account doesn't match authenticated account
  // The WebSocket must be authenticated with the selected account for trades to work
  if (selectedAccount && user?.loginid && selectedAccount.loginid !== user.loginid) {
    console.warn('[TradeExecution] Account mismatch:', {
      selectedAccountLoginid: selectedAccount.loginid,
      userLoginid: user.loginid,
      selectedAccountBalance: selectedAccount.balance,
      userBalance: user.balance
    });
    
    toast({
      title: 'Account Not Ready',
      description: `Please wait for account switch to complete. Selected: ${selectedAccount.loginid}, Authenticated: ${user.loginid}`,
      variant: 'destructive',
      duration: 3000,
    });
    return { isValid: false, error: 'Account mismatch', selectedAccount, currentAccountBalance };
  }

  // Proposal validation
  if (!proposal?.id) {
    toast({
      title: 'No Proposal',
      description: 'Please wait for proposal to load',
      variant: 'destructive'
    });
    return { isValid: false, error: 'No proposal', selectedAccount, currentAccountBalance };
  }

  // Balance check using selected account balance
  const requiredAmount = proposal?.ask_price || stake;
  if (currentAccountBalance && requiredAmount > currentAccountBalance) {
    toast({
      title: 'Insufficient Balance',
      description: `You need ${requiredAmount.toFixed(2)} USD but have ${currentAccountBalance.toFixed(2)} USD`,
      variant: 'destructive'
    });
    return { isValid: false, error: 'Insufficient balance', selectedAccount, currentAccountBalance };
  }

  return { 
    isValid: true, 
    selectedAccount, 
    currentAccountBalance,
    walletLoginid: selectedAccount?.loginid || user?.loginid || '',
    walletAmount: currentAccountBalance || user?.balance || 0,
    walletToken: user?.token || ''
  };
};

/**
 * Formats error message for API errors
 * @param {Object} error - API error object
 * @param {Object} proposal - Trade proposal
 * @param {number} stake - Trade stake
 * @returns {string} Formatted error message
 */
export const formatTradeErrorMessage = (error, proposal, stake) => {
  const errorCode = error.code;
  const errorMessage = error.message || 'Purchase failed';

  if (errorCode === 'InvalidContract') {
    return 'Invalid contract parameters. Please check your trade settings.';
  } else if (errorCode === 'InsufficientBalance') {
    const selectedAccount = getSelectedAccountFromStorage();
    const actualBalance = selectedAccount?.balance ?? 0;
    const requiredAmount = proposal?.ask_price || stake;
    return `Insufficient balance. Your account (${selectedAccount?.loginid || 'current'}) has ${actualBalance.toFixed(2)} USD, but ${requiredAmount.toFixed(2)} USD is required.`;
  } else if (errorCode === 'MarketClosed') {
    return 'Market is currently closed. Please try again later.';
  } else if (errorCode === 'RateLimit') {
    return 'Too many requests. Please wait a moment and try again.';
  } else if (errorCode === 'InvalidContractProposal') {
    return 'Proposal expired. Please try again - a fresh proposal will be fetched automatically.';
  }

  return errorMessage;
};

/**
 * Saves wallet information to localStorage
 * @param {Object} walletInfo - Wallet information
 */
export const saveWalletInfo = (walletInfo) => {
  try {
    const walletData = {
      loginid: walletInfo.loginid || '',
      amount: walletInfo.amount || 0,
      token: walletInfo.token || '',
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('deriv_wallet_trade', JSON.stringify(walletData));
    
    console.log('[TradeExecution] Wallet Information:', {
      loginid: walletData.loginid,
      amount: walletData.amount,
      token: walletData.token ? `${walletData.token.substring(0, 20)}...` : 'No token',
      timestamp: walletData.timestamp
    });
  } catch (e) {
    console.error('[TradeExecution] Error saving wallet data to localStorage:', e);
  }
};

/**
 * Handles successful trade response
 * @param {Object} params - Success parameters
 * @param {Object} params.response - API response
 * @param {Function} params.deductBalance - Balance deduction function
 * @param {Function} params.requestBalanceUpdate - Balance update request function
 * @param {Object} params.user - User state
 * @param {Function} params.toast - Toast notification function
 * @param {Function} params.onTradePlaced - Trade placed callback
 * @param {Object} params.tradeData - Additional trade data
 */
export const handleSuccessfulTrade = ({
  response,
  deductBalance,
  requestBalanceUpdate,
  user,
  toast,
  onTradePlaced,
  tradeData = {}
}) => {
  if (!response.buy) {
    throw new Error('Invalid response: missing buy data');
  }

  const contractId = response.buy.contract_id;
  const buyPrice = response.buy.buy_price;
  const payout = response.buy.payout;

  if (!contractId) {
    throw new Error('Invalid response: missing contract ID');
  }

  // CRITICAL: Deduct balance immediately after successful trade
  if (deductBalance && buyPrice && user?.loginid) {
    deductBalance(buyPrice, user.loginid);
  }

  // Request balance update from WebSocket to sync with server
  if (requestBalanceUpdate && user?.loginid) {
    requestBalanceUpdate(user.loginid);
  }

  // Show success notification
  const direction = tradeData.direction || 'Trade';
  toast({
    title: `✅ ${direction} Contract Purchased`,
    description: `Contract ID: ${contractId}${payout ? ` | Payout: $${payout.toFixed(2)}` : ''}`,
  });

  // Call onTradePlaced callback if provided
  if (onTradePlaced) {
    try {
      onTradePlaced({
        contract_id: contractId,
        buy_price: buyPrice,
        payout: payout,
        ...tradeData
      });
    } catch (error) {
      console.error('[TRADE EXECUTION] Error calling onTradePlaced:', error);
    }
  }

  return { contractId, buyPrice, payout };
};

/**
 * Ensures WebSocket is authenticated with user's OAuth token, not API token
 * Re-authorizes with user token if needed before placing trades
 * @param {Object} params - Parameters
 * @param {Object} params.user - User state
 * @param {Function} params.login - Login function to re-authorize
 * @param {Function} params.toast - Toast notification function
 * @returns {Promise<boolean>} True if ready to trade, false if blocked
 */
export const ensureUserAccountAuthenticated = async ({ user, login, toast }) => {
  // CRITICAL: Only use token from user state, NOT from localStorage
  // This ensures we always use the current authenticated token
  if (!user?.token) {
    toast({
      title: 'Not Authenticated',
      description: 'Please log in to place trades',
      variant: 'destructive'
    });
    return false;
  }
  
  // CRITICAL: Use ONLY the token from user state (current session token)
  // Don't check localStorage - use what's in the current user state
  const currentToken = user.token;
  const isUsingAPIToken = isAPIToken(currentToken);
  
  // If using API token, we cannot place trades - user must be logged in with OAuth
  if (isUsingAPIToken) {
    toast({
      title: 'Please Log In',
      description: 'You must log in to place trades. Trades cannot be placed with API owner account.',
      variant: 'destructive'
    });
    return false;
  }
  
  // Token is valid user OAuth token - ready to trade
  return true;
};
