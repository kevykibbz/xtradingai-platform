'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { isValidAuthToken, getTradingToken, isAPIToken, getUserOAuthToken } from '@/lib/utils';
import { DerivAPI } from '@/lib/deriv-api';
import { getWebSocketEndpoint, logConfig } from '@/lib/config';

const DerivContext = createContext();

export const useDerivAPI = () => {
  const context = useContext(DerivContext);
  if (!context) {
    throw new Error('useDerivAPI must be used within DerivProvider');
  }
  return context;
};

const mapCategory = (market) => {
  const map = {
    synthetic_index: 'Derived',
    forex: 'Forex',
    indices: 'Stock Indices',
    commodities: 'Commodities',
    cryptocurrency: 'Cryptocurrencies',
  };
  return map[market] || market;
};

const mapSubcategory = (submarket, subgroup, market) => {
  const map = {
    major_pairs: 'Major Pairs',
    minor_pairs: 'Minor Pairs',
    smart_fx: 'Smart FX',
    basket_index: 'Basket Indices',
    derived_fx: 'Derived FX',
    jump_index: 'Jump Indices',
    volidx: 'Volatility Indices',
    crashdraw: 'Crash/Boom',
  };
  return map[submarket] || map[subgroup] || map[market] || submarket;
};

export const DerivProvider = ({ children }) => {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [api, setApi] = useState(null);
  const [activeSymbols, setActiveSymbols] = useState([]);
  const [tickData, setTickData] = useState({});
  const [marketHistory, setMarketHistory] = useState({});
  const [user, setUser] = useState(null);
  const historyCallback = useRef(null);
  const streamSubscriptions = useRef(new Map());
  const apiCallbacks = useRef(new Map());
  const reqId = useRef(0);
  const symbolsLoadedRef = useRef(false);
  const symbolsRetryCountRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef(null);
  const healthCheckIntervalRef = useRef(null);
  const authRefreshIntervalRef = useRef(null);
  const lastMessageTimeRef = useRef(Date.now());
  const activeTickSubscriptionsRef = useRef(new Set()); // Track active tick subscriptions for re-subscription
  const isReconnectingRef = useRef(false);
  const isInitializedRef = useRef(false); // Track if WebSocket has been initialized
  const userExistsRef = useRef(false); // Track if user exists to detect refresh vs initial login

  const sendRequest = useCallback((request) => {
    return new Promise((resolve, reject) => {
      // Check if WebSocket exists and is open before sending
      if (!ws.current) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      
      // Check if WebSocket is open
      if (ws.current.readyState === WebSocket.OPEN) {
        try {
          reqId.current += 1;
          const currentReqId = reqId.current;
          apiCallbacks.current.set(currentReqId, { resolve, reject });
          ws.current.send(JSON.stringify({ ...request, req_id: currentReqId }));
        } catch (error) {
          // Handle case where send fails (e.g., connection closed during send)
          apiCallbacks.current.delete(reqId.current);
          reject(new Error('Failed to send request: ' + error.message));
        }
      }
      // If WebSocket is connecting, wait a bit and retry
      else if (ws.current?.readyState === WebSocket.CONNECTING) {
        const maxWaitTime = 5000; // Wait up to 5 seconds
        const checkInterval = 100; // Check every 100ms
        let elapsed = 0;

        const checkConnection = setInterval(() => {
          elapsed += checkInterval;

          if (ws.current?.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            try {
              reqId.current += 1;
              const currentReqId = reqId.current;
              apiCallbacks.current.set(currentReqId, { resolve, reject });
              ws.current.send(JSON.stringify({ ...request, req_id: currentReqId }));
            } catch (error) {
              clearInterval(checkConnection);
              const failedReqId = reqId.current;
              apiCallbacks.current.delete(failedReqId);
              reject(new Error('Failed to send request: ' + error.message));
            }
          } else if (!ws.current || ws.current.readyState === WebSocket.CLOSED || elapsed >= maxWaitTime) {
            clearInterval(checkConnection);
            // Silently reject - don't show error if connection is still establishing
            reject(new Error('WebSocket not connected'));
          }
        }, checkInterval);
      }
      // WebSocket is closed or doesn't exist - silently reject
      else {
        // Don't throw error - just silently reject to avoid showing errors during initial load
        reject(new Error('WebSocket not connected'));
      }
    });
  }, []);

  const fetchAllMarketHistory = useCallback(async (symbols) => {
    const delayMs = 150;
    const allResults = [];

    for (const symbol of symbols) {
      try {
        const data = await sendRequest({
          ticks_history: symbol.id,
          adjust_start_time: 1,
          count: 50,
          end: 'latest',
          start: 1,
          style: 'ticks',
        });
        if (data.history) {
          allResults.push({ symbol: symbol.id, history: data.history });
        }
      } catch (err) { }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const newHistory = {};
    allResults.forEach(({ symbol, history }) => {
      const prices = history.prices.map((price, index) => ({
        time: history.times[index] * 1000,
        value: parseFloat(price),
      }));
      newHistory[symbol] = prices;
    });
    setMarketHistory((prev) => ({ ...prev, ...newHistory }));
  }, [sendRequest]);

  const forgetStream = useCallback((streamId) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && streamId) {
      ws.current.send(JSON.stringify({ forget: streamId }));
    }
  }, []);

  const fetchActiveSymbols = useCallback(
    async (retries = 3, delay = 100) => {
      for (let i = 0; i < retries; i++) {
        try {
          if (ws.current?.readyState !== WebSocket.OPEN) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          const response = await sendRequest({
            active_symbols: 'full',
            product_type: 'basic',
          });
          return response;
        } catch (error) {
          await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
        }
      }
    },
    [sendRequest],
  );

  const loadSymbols = useCallback(async () => {
    try {
      const response = await fetchActiveSymbols(5, 200); // Increased retries
      if (response && response.active_symbols) {
        const processedSymbols = response.active_symbols
          .map((s) => {
            const {
              symbol: id,
              display_name: name,
              market,
              market_display_name: marketDisplay,
              subgroup,
              subgroup_display_name: subgroupDisplay,
              submarket,
              submarket_display_name: submarketDisplay,
              exchange_is_open: isOpen,
              is_trading_suspended: isSuspended,
            } = s;
            let flags = [];
            let category = marketDisplay || mapCategory(market);
            let subcategory =
              submarketDisplay || subgroupDisplay || mapSubcategory(submarket, subgroup, market);

            if (market === 'forex') {
              const pair = name.replace(/\/|\s/g, '');
              const base = pair.slice(0, 3);
              const quote = pair.slice(3, 6);
              flags = [base, quote];
            }

            return {
              id,
              name,
              category,
              subcategory,
              flags,
              market,
              display_order: s.display_order,
              pip: s.pip,
              isOpen,
              isSuspended,
              ...s,
            };
          })
          .sort((a, b) => (a.display_order - b.display_order) || a.name.localeCompare(b.name));

        setActiveSymbols(processedSymbols);
        symbolsLoadedRef.current = true;
        symbolsRetryCountRef.current = 0; // Reset retry count on success
        setTimeout(() => fetchAllMarketHistory(processedSymbols), 100);
        return true;
      }
    } catch (error) {
      console.error('Failed to load symbols:', error);
      return false;
    }
    return false;
  }, [fetchActiveSymbols, fetchAllMarketHistory]);

  /**
   * Subscribe to real-time tick stream for a symbol
   * Uses the ticks API: { "ticks": "SYMBOL", "subscribe": 1 }
   * Supports single symbol (string) or multiple symbols (array)
   */
  const subscribeTick = useCallback((symbol) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      // Handle both single symbol and array of symbols
      const symbols = Array.isArray(symbol) ? symbol : [symbol];

      // Track subscriptions for re-subscription on reconnect
      symbols.forEach(s => activeTickSubscriptionsRef.current.add(s));

      // Check if any symbol is already subscribed
      const needsSubscription = symbols.filter(s => {
        const streamKey = `ticks-${s}`;
        return !streamSubscriptions.current.has(streamKey);
      });

      if (needsSubscription.length === 0) {
        return; // All symbols already subscribed
      }

      // Subscribe to symbols that need subscription
      // If only one symbol needs subscription, use single format; otherwise use array
      const symbolsToSubscribe = needsSubscription.length === 1
        ? needsSubscription[0]
        : needsSubscription;

      const request = {
        ticks: symbolsToSubscribe,
        subscribe: 1,
      };

      ws.current.send(JSON.stringify(request));
    }
  }, []);

  useEffect(() => {
    // Connection health monitor - check if connection is stale and re-authenticate if needed
    const startConnectionHealthCheck = () => {
      // Check connection health every 15 seconds
      return setInterval(() => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current;

          // If no message received in 45 seconds (3 missed pings), connection is likely a zombie
          // Force a close to trigger the robust reconnection logic
          if (timeSinceLastMessage > 45000) {
            ws.current.close();
          }
        }
      }, 15000);
    };

    // Heartbeat function to keep connection alive
    const startHeartbeat = () => {
      // Clear any existing heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      // Send ping every 5 seconds to keep connection alive and prevent session timeout
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          try {
            sendRequest({ ping: 1 }).catch(() => { });
          } catch (e) { }
        }
      }, 5000);
    };

    // Periodic authorization refresh to prevent session expiration
    const startAuthRefresh = () => {
      // Clear any existing auth refresh
      if (authRefreshIntervalRef.current) {
        clearInterval(authRefreshIntervalRef.current);
      }

      // Refresh authorization every 5 minutes to prevent session timeout
      authRefreshIntervalRef.current = setInterval(() => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          try {
            const stored = localStorage.getItem('deriv_user');
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                if (parsed?.token) {
                  // Silently refresh authorization to keep session alive
                  console.log('[AUTH REFRESH] Refreshing token for previously logged in user');
                  sendRequest({ authorize: parsed.token }).then((authResponse) => {
                    // After silent refresh, ensure balance is updated
                    const authData = authResponse?.authorize;
                    console.log('[AUTH REFRESH] Refresh successful', {
                      loginid: authData?.loginid,
                      balance: authData?.balance,
                      hasAccountList: !!authData?.account_list
                    });
                    if (authData?.loginid && ws.current && ws.current.readyState === WebSocket.OPEN) {
                      // Request fresh balance update after silent refresh
                      // This ensures wallet balance is always current, even if authorize response had stale balance
                      setTimeout(() => {
                        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                          sendRequest({ balance: 1, account: authData.loginid }).catch(() => {
                            // Silently handle errors - balance subscription will still work
                          });
                        }
                      }, 200); // Small delay to avoid rate limits
                    }
                  }).catch((error) => {
                    console.error('[AUTH REFRESH] Refresh failed', error);
                    // Silently handle errors - connection will retry on next heartbeat
                  });
                }
              } catch { }
            }
          } catch (e) { }
        }
      }, 300000); // 5 minutes
    };

    // Setup WebSocket handlers (extracted to function for reconnection)
    const setupWebSocketHandlers = () => {
      if (!ws.current) return;
      
      // Prevent setting up handlers multiple times
      if (ws.current._handlersSetup) return;
      ws.current._handlersSetup = true;

      ws.current.onopen = () => {
        setConnected(true);
        // Initialize DerivAPI wrapper with WebSocket and sendRequest
        const derivAPI = new DerivAPI(ws.current, sendRequest);
        setApi(derivAPI);
        reconnectAttemptsRef.current = 0; // Reset on successful connection
        isReconnectingRef.current = false;

        // Clear any pending reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Wait for WebSocket to be fully ready before sending authorization
        const authorizeWithDelay = () => {
          // Auto-authorize with token after connection is fully established
          // CRITICAL: Use the appropriate token based on selected account type (real vs demo)
          let tokenToUse = null;

          try {
            // CRITICAL: ALWAYS use user's OAuth token if available, NOT API tokens
            // User's OAuth token has access to ALL their accounts (both real and demo)
            tokenToUse = getUserOAuthToken();
            
            // CRITICAL: ONLY auto-authorize if user has logged in with OAuth token
            // NEVER use API tokens for auto-authorization - they should only be used for connection
            // API tokens should NEVER fetch accounts - only user OAuth tokens should
            if (!tokenToUse) {
              // No user logged in - skip auto-authorization
              // WebSocket will still be connected for market data, but won't authorize until user logs in
              console.log('[DerivContext] No user logged in - skipping auto-authorization. WebSocket connected for market data only. Please log in to see your accounts.');
              return;
            } else {
              console.log('[DerivContext] Auto-authorization - Using user OAuth token (has access to all accounts):', {
                token: tokenToUse ? `${tokenToUse.substring(0, 20)}...` : 'no token'
              });
            }
          } catch {
            // If parsing fails, try user OAuth token only
            tokenToUse = getUserOAuthToken();
            if (!tokenToUse) {
              console.log('[DerivContext] No user logged in - skipping auto-authorization');
              return;
            }
          }
          
          // Only authorize if we have a valid user OAuth token
          if (!tokenToUse) {
            console.warn('[DerivContext] No valid user OAuth token found, skipping auto-authorization');
            return;
          }

          // Wait for WebSocket to be fully OPEN before sending
          const checkAndSend = () => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              // Send authorization via sendRequest to ensure proper handling
              sendRequest({ authorize: tokenToUse }).then((authResponse) => {
                const authData = authResponse.authorize;
                
                // CRITICAL: Always update user state with ALL data from authorize response
                // This ensures token, loginid, currency, and all necessary data is captured
                setUser(prev => {
                  // CRITICAL: Check if we're using an API token and have a user OAuth token
                  // If so, don't use API owner's wallet details - use logged-in user's account instead
                  const isUsingAPIToken = isAPIToken(tokenToUse);
                  const userOAuthToken = getUserOAuthToken();
                  const shouldUseUserAccount = isUsingAPIToken && userOAuthToken && prev?.token === userOAuthToken;
                  
                  // If using API token but have user account, preserve user's account info
                  if (shouldUseUserAccount) {
                    console.log('[DerivContext] Using API token for connection but preserving user account info - not using API owner wallet');
                    // Keep user's own account info, don't overwrite with API owner's wallet
                    return {
                      ...prev,
                      // Keep user's token (OAuth token), not API token
                      token: userOAuthToken,
                      // Keep user's loginid, balance, currency, accounts - don't use API owner's
                      // Only update connection status, don't overwrite user's account data
                    };
                  }
                  
                  const newUser = {
                    ...prev,
                    ...authData,
                    // CRITICAL: Always include token (from request, not response - but ensure it's set)
                    token: tokenToUse, // Use the token we sent (most reliable)
                    // Ensure loginid is set
                    loginid: authData.loginid || prev?.loginid,
                    // Ensure currency is set
                    currency: authData.currency || prev?.currency || 'USD',
                    // Set balance
                    balance: authData.balance || prev?.balance || 0,
                    // Preserve liveBalances
                    liveBalances: prev?.liveBalances || {}
                  };
                  
                  // If authorize response has balance and loginid, update liveBalances
                  // BUT skip if using API token with user account (don't use API owner's balance)
                  if (!shouldUseUserAccount && authData.balance && authData.loginid) {
                    const authBalance = parseFloat(authData.balance) || 0;
                    newUser.liveBalances = {
                      ...newUser.liveBalances,
                      [authData.loginid]: {
                        balance: authBalance,
                        currency: authData.currency || 'USD'
                      }
                    };
                  }
                  
                  // CRITICAL: Include account_list if available (for account switching)
                  // BUT skip if using API token with user account (don't use API owner's accounts)
                  if (!shouldUseUserAccount && authData.account_list && Array.isArray(authData.account_list)) {
                    newUser.accounts = authData.account_list.map(acc => {
                      // CRITICAL: Parse balance properly - account_list balances might be strings or numbers
                      let accBalance = 0;
                      if (acc.balance !== undefined && acc.balance !== null) {
                        accBalance = parseFloat(acc.balance);
                        if (isNaN(accBalance)) {
                          accBalance = 0;
                        }
                      }
                      return {
                        loginid: acc.loginid,
                        currency: acc.currency || authData.currency || 'USD',
                        is_virtual: acc.is_virtual || false,
                        balance: accBalance
                      };
                    });
                  }
                  
                  return newUser;
                });
                
                // CRITICAL: If using API token but have user account, re-authorize with user's token
                // to get their account info and switch WebSocket to user's account
                const isUsingAPIToken = isAPIToken(tokenToUse);
                const userOAuthToken = getUserOAuthToken();
                if (isUsingAPIToken && userOAuthToken) {
                  console.log('[DerivContext] Re-authorizing with user OAuth token to get user account info');
                  // Re-authorize with user's token to switch to their account
                  setTimeout(() => {
                    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                      sendRequest({ authorize: userOAuthToken }).then((userAuthResponse) => {
                        const userAuthData = userAuthResponse?.authorize;
                        if (userAuthData) {
                          setUser(prev => {
                            const newUser = {
                              ...prev,
                              ...userAuthData,
                              token: userOAuthToken, // Use user's OAuth token
                              loginid: userAuthData.loginid || prev?.loginid,
                              currency: userAuthData.currency || prev?.currency || 'USD',
                              balance: userAuthData.balance !== undefined && userAuthData.balance !== null 
                                ? (parseFloat(userAuthData.balance) || 0) 
                                : (prev?.balance || 0),
                              liveBalances: prev?.liveBalances || {}
                            };
                            
                            // Update liveBalances with user's account balance
                            if (userAuthData.balance && userAuthData.loginid) {
                              const userBalance = parseFloat(userAuthData.balance) || 0;
                              newUser.liveBalances = {
                                ...newUser.liveBalances,
                                [userAuthData.loginid]: {
                                  balance: userBalance,
                                  currency: userAuthData.currency || 'USD'
                                }
                              };
                            }
                            
                            // Include user's account_list
                            if (userAuthData.account_list && Array.isArray(userAuthData.account_list)) {
                              newUser.accounts = userAuthData.account_list.map(acc => {
                                let accBalance = 0;
                                if (acc.balance !== undefined && acc.balance !== null) {
                                  accBalance = parseFloat(acc.balance);
                                  if (isNaN(accBalance)) {
                                    accBalance = 0;
                                  }
                                }
                                return {
                                  loginid: acc.loginid,
                                  currency: acc.currency || userAuthData.currency || 'USD',
                                  is_virtual: acc.is_virtual || false,
                                  balance: accBalance
                                };
                              });
                            }
                            
                            return newUser;
                          });
                        }
                      }).catch((error) => {
                        console.error('[DerivContext] Error re-authorizing with user token:', error);
                      });
                    }
                  }, 200);
                }
                
                // Request balance only if not in authorize response, then subscribe
                if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                  // If using user account, request balance for user's account, not API owner's
                  const userOAuthToken = getUserOAuthToken();
                  const isUsingAPIToken = isAPIToken(tokenToUse);
                  const shouldRequestUserBalance = isUsingAPIToken && userOAuthToken;
                  
                  if (shouldRequestUserBalance) {
                    // Wait for re-authorization to complete, then request user's balance
                    setTimeout(() => {
                      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                        sendRequest({ balance: 1, account: 'all', subscribe: 1 }).then((response) => {
                        }).catch((error) => {
                        });
                      }
                    }, 500);
                  } else {
                    const currentLoginid = authData?.loginid;
                    // Only request if balance not in authorize response
                    if (currentLoginid && !authData?.balance) {
                      sendRequest({ balance: 1, account: currentLoginid }).then((response) => {
                      }).catch((error) => {
                      });
                    }
                    
                    // Subscribe to balance updates (small delay to avoid rate limits)
                    setTimeout(() => {
                      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                        sendRequest({ balance: 1, account: 'all', subscribe: 1 }).then((response) => {
                        }).catch((error) => {
                        });
                      }
                    }, 100);
                  }
                }
                // After authorization, re-subscribe to active tick streams
                setTimeout(() => {
                  if (activeTickSubscriptionsRef.current.size > 0) {
                    const symbolsToResubscribe = Array.from(activeTickSubscriptionsRef.current);
                    subscribeTick(symbolsToResubscribe);
                  }
                }, 500);
              }).catch(() => {
                // Silently handle errors - authorization will retry on next connection
              });
            } else if (ws.current && ws.current.readyState === WebSocket.CONNECTING) {
              // Still connecting, wait a bit more
              setTimeout(checkAndSend, 50);
            }
          };

          // Start checking after a short delay
          setTimeout(checkAndSend, 200);
        };

        authorizeWithDelay();

        // Load symbols after a short delay to allow authorization to complete
        setTimeout(() => {
          loadSymbols();
        }, 500);

        // Start heartbeat to keep connection alive
        startHeartbeat();

        // Start periodic authorization refresh to prevent session expiration
        startAuthRefresh();

        // Start connection health check
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current);
        }
        healthCheckIntervalRef.current = startConnectionHealthCheck();
      };

      ws.current.onmessage = (msg) => {
        const data = JSON.parse(msg.data);

        // Update last message time to track connection health
        // Do this after parsing to ensure we process all message types
        lastMessageTimeRef.current = Date.now();

        if (data.req_id && apiCallbacks.current.has(data.req_id)) {
          const { resolve, reject } = apiCallbacks.current.get(data.req_id);
          if (data.error) {
            reject(data.error);
          } else {
            resolve(data);
          }
          apiCallbacks.current.delete(data.req_id);
          return;
        }

        if (data.error) {
          // Handle authorization errors - don't clear user immediately, try to re-authenticate
          if (data.error.code === 'InvalidToken' || data.error.code === 'AuthorizationRequired') {
            // Attempt to re-authenticate if we have a token storage, even if user state is present
            // This handles cases where session expired on server but client state persisted
            const stored = localStorage.getItem('deriv_user');
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                if (parsed?.token) {
                  sendRequest({ authorize: parsed.token }).catch(() => {
                    // If re-auth fails again, we might be truly logged out. 
                    // But we don't force logout to avoid disrupting user workflow excessively.
                  });
                }
              } catch { }
            }
          }
          return;
        }

        const subId = data.subscription?.id;

        switch (data.msg_type) {
          case 'tick':
            // Handle tick stream updates according to ticks API
            // Response format: { msg_type: 'tick', tick: { symbol, quote, epoch, ... }, subscription: { id } }
            if (data.tick && data.tick.symbol) {
              // Update tick data - this triggers real-time chart updates
              setTickData((prev) => {
                const updated = { ...prev, [data.tick.symbol]: data.tick };
                return updated;
              });
              // Store subscription ID when received (may come with first tick or separately)
              if (subId) {
                streamSubscriptions.current.set(`ticks-${data.tick.symbol}`, subId);
              }
            }
            break;
          case 'history':
            if (data.history) {
              // Check if this is candles data (has candles array) or tick data (has prices array)
              if (data.history.candles && Array.isArray(data.history.candles)) {
                // Handle candles data from history response
                const candles = data.history.candles.map((c) => ({
                  time: parseInt(c.epoch) * 1000,
                  open: parseFloat(c.open),
                  high: parseFloat(c.high),
                  low: parseFloat(c.low),
                  close: parseFloat(c.close),
                }));
                if (historyCallback.current && typeof historyCallback.current === 'function')
                  historyCallback.current(candles);
              } else if (data.history.prices && Array.isArray(data.history.prices)) {
                // Handle tick data (prices array)
                const history = data.history.prices.map((price, index) => ({
                  time: data.history.times[index] * 1000,
                  value: parseFloat(price),
                }));
                if (historyCallback.current && typeof historyCallback.current === 'function')
                  historyCallback.current(history);
              }
            }
            break;
          case 'candles':
            if (data.candles) {
              const candles = data.candles.map((c) => ({
                time: parseInt(c.epoch) * 1000,
                open: parseFloat(c.open),
                high: parseFloat(c.high),
                low: parseFloat(c.low),
                close: parseFloat(c.close),
              }));
              if (historyCallback.current && typeof historyCallback.current === 'function')
                historyCallback.current(candles);
              if (subId) streamSubscriptions.current.set(`candles-${data.echo_req.ticks_history}`, subId);
            }
            break;
          case 'ohlc':
            if (data.ohlc) {
              const candle = {
                time: parseInt(data.ohlc.open_time) * 1000,
                open: parseFloat(data.ohlc.open),
                high: parseFloat(data.ohlc.high),
                low: parseFloat(data.ohlc.low),
                close: parseFloat(data.ohlc.close),
              };
              if (historyCallback.current && typeof historyCallback.current === 'function')
                historyCallback.current([candle], true);
              if (subId) streamSubscriptions.current.set(`candles-${data.ohlc.symbol}`, subId);
            }
            break;
          case 'proposal':
            // Handle proposal subscription updates
            // When subscribe: 1 is used, the API sends real-time proposal updates
            // This keeps proposals fresh and prevents InvalidSellContractProposal errors
            if (data.proposal) {
              // Store proposal updates - components can listen to these via a callback
              // For now, we'll just log it - components should handle their own proposal state
            }
            break;
          case 'authorize':
            const authData = data.authorize;
            
            // Check if this is a refresh (user already exists) vs initial login
            const isRefresh = userExistsRef.current;
            
            // CRITICAL: Ensure ALL necessary data is captured from authorize response
            // This includes: token, loginid, currency, balance, account_list
            setUser(prev => {
              // CRITICAL: Token priority order:
              // 1. Token from prev state (if it exists and is valid)
              // 2. Token from localStorage (source of truth)
              // 3. Token from response (rarely present)
              let tokenToUse = null;
              
              // Priority 1: Use prev token if it exists and is valid
              if (prev?.token && isValidAuthToken(prev.token)) {
                tokenToUse = prev.token;
              }
              
              // Priority 2: Get token from localStorage (source of truth)
              if (!tokenToUse) {
                try {
                  const stored = localStorage.getItem('deriv_user');
                  if (stored) {
                    const parsed = JSON.parse(stored);
                    // Use token from localStorage even if validation fails (might be valid but not passing strict validation)
                    if (parsed?.token && typeof parsed.token === 'string' && parsed.token.trim().length > 0) {
                      tokenToUse = parsed.token;
                    }
                  }
                } catch (e) {
                  // Ignore errors
                }
              }
              
              // Priority 3: Token from response (rarely present)
              if (!tokenToUse && authData.token) {
                tokenToUse = authData.token;
              }
              
              // Final fallback: prev token even if not validated
              if (!tokenToUse && prev?.token) {
                tokenToUse = prev.token;
              }
              
              // CRITICAL: Check if the token we're using is an API token and we have a user OAuth token
              // If so, don't use API owner's wallet details - preserve user's account info
              const isUsingAPIToken = tokenToUse && isAPIToken(tokenToUse);
              const userOAuthToken = getUserOAuthToken();
              const shouldUseUserAccount = isUsingAPIToken && userOAuthToken && prev?.token === userOAuthToken;
              
              // If using API token but have user account, preserve user's account info
              if (shouldUseUserAccount) {
                console.log('[DerivContext] Authorize response from API token - preserving user account info, not using API owner wallet');
                // Keep user's own account info, don't overwrite with API owner's wallet
                return {
                  ...prev,
                  // Keep user's token (OAuth token), not API token
                  token: userOAuthToken,
                  // Keep user's loginid, balance, currency, accounts - don't use API owner's
                };
              }
              
              const newUser = {
                ...authData,
                // CRITICAL: Always include token (MUST be set - prioritize localStorage/prev over response)
                // Set token AFTER spreading authData to ensure it's not overwritten
                token: tokenToUse || prev?.token || null,
                // CRITICAL: Ensure loginid is set (required for trading)
                loginid: authData.loginid || prev?.loginid,
                // CRITICAL: Ensure currency is set
                currency: authData.currency || prev?.currency || 'USD',
                // Set balance - parse properly
                balance: authData.balance !== undefined && authData.balance !== null 
                  ? (parseFloat(authData.balance) || 0) 
                  : (prev?.balance || 0),
                // Preserve liveBalances
                liveBalances: prev?.liveBalances || {},
                // CRITICAL: Include account_list if available (for account switching)
                // BUT skip if using API token with user account (don't use API owner's accounts)
                accounts: (!shouldUseUserAccount && authData.account_list && Array.isArray(authData.account_list))
                  ? authData.account_list.map(acc => {
                      // Parse balance properly
                      let accBalance = 0;
                      if (acc.balance !== undefined && acc.balance !== null) {
                        accBalance = parseFloat(acc.balance);
                        if (isNaN(accBalance)) {
                          accBalance = 0;
                        }
                      }
                      return {
                        loginid: acc.loginid,
                        currency: acc.currency || authData.currency || 'USD',
                        is_virtual: acc.is_virtual || false,
                        balance: accBalance
                      };
                    })
                  : (prev?.accounts || [])
              };
              
              // CRITICAL: If token is still missing, try one more time to get it from localStorage
              if (!newUser.token) {
                try {
                  const stored = localStorage.getItem('deriv_user');
                  if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed?.token && typeof parsed.token === 'string' && parsed.token.trim().length > 0) {
                      newUser.token = parsed.token;
                    }
                  }
                } catch (e) {
                  // Ignore errors
                }
              }
              
              // If authorize response has balance and loginid, update liveBalances
              // BUT skip if using API token with user account (don't use API owner's balance)
              if (!shouldUseUserAccount && authData.balance !== undefined && authData.balance !== null && authData.loginid) {
                const authBalance = parseFloat(authData.balance) || 0;
                newUser.liveBalances = {
                  ...newUser.liveBalances,
                  [authData.loginid]: {
                    balance: authBalance,
                    currency: authData.currency || 'USD'
                  }
                };
              }
              
              // Update ref to track that user now exists
              userExistsRef.current = true;
              
              // CRITICAL: Ensure token is saved to localStorage after successful authorization
              // This keeps localStorage in sync with user state
              if (newUser.token) {
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
                  // Update localStorage with token and other user data
                  localStorage.setItem('deriv_user', JSON.stringify({
                    ...storedData,
                    token: newUser.token,
                    loginid: newUser.loginid || storedData.loginid,
                    currency: newUser.currency || storedData.currency || 'USD'
                  }));
                } catch (e) {
                  // Ignore localStorage errors
                }
              }
              
              return newUser;
            });
            
            // Update last message time on successful authorization
            lastMessageTimeRef.current = Date.now();
            
            // Request balance for current account only (to avoid rate limits) and subscribe
            // CRITICAL: Always set up balance subscriptions after authorize, regardless of token type
            // Balance subscriptions work for both API tokens and user OAuth tokens
            if (authData && ws.current && ws.current.readyState === WebSocket.OPEN) {
              const currentLoginid = authData.loginid;
              
              console.log('[DerivContext] Setting up balance subscriptions after authorize:', {
                loginid: currentLoginid,
                hasBalance: !!authData.balance,
                isRefresh
              });
              
              // Always request fresh balance if this is a refresh (silent refresh scenario)
              // OR if balance is not in authorize response (initial login scenario)
              if (currentLoginid && (isRefresh || !authData.balance)) {
                // For refresh, always request fresh balance to ensure it's up-to-date
                // For initial login, only request if not in response
                console.log('[DerivContext] Requesting balance for account:', currentLoginid);
                sendRequest({ balance: 1, account: currentLoginid }).then((response) => {
                  console.log('[DerivContext] Balance request successful:', response);
                }).catch((error) => {
                  console.error('[DerivContext] Balance request failed:', error);
                });
              }
              
              // CRITICAL: Subscribe to balance updates for ALL accounts
              // This ensures we receive real-time balance updates
              // Use a small delay to avoid rate limits from multiple requests
              setTimeout(() => {
                if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                  console.log('[DerivContext] Subscribing to balance updates for all accounts');
                  sendRequest({ balance: 1, account: 'all', subscribe: 1 }).then((response) => {
                    console.log('[DerivContext] Balance subscription successful:', response);
                  }).catch((error) => {
                    console.error('[DerivContext] Balance subscription failed:', error);
                    // Retry subscription after a delay if it fails
                    setTimeout(() => {
                      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                        console.log('[DerivContext] Retrying balance subscription...');
                        sendRequest({ balance: 1, account: 'all', subscribe: 1 }).then((response) => {
                          console.log('[DerivContext] Balance subscription retry successful:', response);
                        }).catch((err) => {
                          console.error('[DerivContext] Balance subscription retry failed:', err);
                        });
                      }
                    }, 2000);
                  });
                } else {
                  console.warn('[DerivContext] WebSocket not ready for balance subscription:', ws.current?.readyState);
                }
              }, 100);
            } else {
              console.warn('[DerivContext] Cannot set up balance subscriptions - WebSocket not ready:', {
                hasAuthData: !!authData,
                wsReady: ws.current?.readyState === WebSocket.OPEN
              });
            }
            // Ensure symbols are loaded after authorization
            if (!symbolsLoadedRef.current) {
              setTimeout(() => loadSymbols(), 500);
            }
            break;
          case 'balance':
            // Handle balance subscription updates and one-time balance requests
            if (data.balance) {
              const { loginid, balance, currency } = data.balance;
              const updateTime = Date.now();
              const balanceNum = parseFloat(balance);
              
              console.log('[DerivContext] Balance update received:', {
                loginid,
                balance: balanceNum,
                currency,
                timestamp: updateTime
              });
              
              // Update user state immediately - use functional update to ensure latest state
              setUser(prev => {
                if (!prev) {
                  // If user doesn't exist yet, create a minimal user object with balance
                  const newUser = {
                    loginid: loginid,
                    balance: balanceNum,
                    currency: currency || 'USD',
                    liveBalances: {
                      [loginid]: { balance: balanceNum, currency: currency || 'USD' }
                    }
                  };
                  return newUser;
                }
                
                // Update main user balance if it's the current account
                const isMainAccount = loginid === prev.loginid;
                const prevBalance = prev.balance ? parseFloat(prev.balance) : 0;
                const updatedBalance = isMainAccount ? balanceNum : prevBalance;
                const balanceChanged = Math.abs(prevBalance - updatedBalance) > 0.01;
                
                const updatedUser = {
                  ...prev,
                  balance: updatedBalance,
                  liveBalances: {
                    ...prev.liveBalances || {},
                    [loginid]: { balance: balanceNum, currency: currency || prev.currency || 'USD' }
                  }
                };
                
                
                return updatedUser;
              });
            }
            break;
          case 'ping':
            // Update last message time when ping response is received
            // This helps the health check know the connection is alive
            lastMessageTimeRef.current = Date.now();
            break;
          default:
            break;
        }
      };

      ws.current.onerror = () => {
        // Silently handle websocket errors - don't show toast
        // Connection errors are handled gracefully through retry logic
      };

      ws.current.onclose = () => {
        // Clear the handlers setup flag so handlers can be set up again on reconnect
        if (ws.current) {
          ws.current._handlersSetup = false;
        }
        
        setConnected(false);
        setApi(null);
        // Don't clear user on disconnect - keep it so we can re-authenticate on reconnect
        // Only clear user if it's a permanent logout (handled elsewhere)
        // setUser(null); // Removed - keep user data for re-authentication
        symbolsLoadedRef.current = false; // Reset flag on disconnect
        symbolsRetryCountRef.current = 0; // Reset retry count on disconnect
        // Clear subscription tracking on disconnect so they can be re-subscribed on reconnect
        streamSubscriptions.current.clear();
        // Don't clear tick data immediately - keep it to prevent "freezing" during reconnection
        // Only clear if reconnection fails after multiple attempts
        // setTickData({}); // Removed - keep data during reconnection

        // Clear heartbeat interval
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Clear health check interval
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current);
          healthCheckIntervalRef.current = null;
        }

        // Clear auth refresh interval
        if (authRefreshIntervalRef.current) {
          clearInterval(authRefreshIntervalRef.current);
          authRefreshIntervalRef.current = null;
        }

        // Attempt to reconnect (unless we're already reconnecting or component is unmounting)
        // Only reconnect if the connection was actually closed (not if we're unmounting)
        if (!isReconnectingRef.current && ws.current && ws.current.readyState === WebSocket.CLOSED) {
          isReconnectingRef.current = true;
          reconnectAttemptsRef.current += 1;

          // Only clear tick data after multiple failed reconnection attempts (prevents freezing)
          if (reconnectAttemptsRef.current > 5) {
            setTickData({}); // Clear data only after 5+ failed attempts
          }

          // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);

          // Silently reconnect without logging
          reconnectTimeoutRef.current = setTimeout(() => {
            isReconnectingRef.current = false;
            // Reconnect by creating a new WebSocket connection
            // Only reconnect if WebSocket is closed and we're not already connected
            // Check if connection already exists and is open/connecting to prevent duplicates
            if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
              // Connection already exists and is active, don't create a new one
              return;
            }
            
            if (ws.current && ws.current.readyState === WebSocket.CLOSED) {
              // Close and clear the old connection
              try {
                ws.current.close();
              } catch (e) {
                // Ignore errors when closing
              }
              ws.current = null;
            }
            
            // Create new connection only if one doesn't exist
            if (!ws.current || ws.current.readyState === WebSocket.CLOSED) {
              const wsEndpoint = getWebSocketEndpoint();
              console.log('[DerivContext] Reconnecting WebSocket to:', wsEndpoint);
              ws.current = new WebSocket(wsEndpoint);
              setupWebSocketHandlers();
            }
          }, delay);
        }
      };
    };

    // Create initial WebSocket connection only once
    if (!isInitializedRef.current && (!ws.current || ws.current.readyState === WebSocket.CLOSED)) {
      // Log configuration on first initialization
      logConfig();
      
      // Close existing connection if it exists but is closed
      if (ws.current && ws.current.readyState === WebSocket.CLOSED) {
        ws.current = null;
      }
      
      // Only create new connection if one doesn't exist or is closed
      if (!ws.current || ws.current.readyState === WebSocket.CLOSED) {
        isInitializedRef.current = true;
        const wsEndpoint = getWebSocketEndpoint();
        console.log('[DerivContext] Creating WebSocket connection to:', wsEndpoint);
        ws.current = new WebSocket(wsEndpoint);
        setupWebSocketHandlers();
      }
    }

    const websocket = ws.current;

    return () => {
      // This cleanup only runs on component unmount
      // Clear timeouts and intervals
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }

      if (authRefreshIntervalRef.current) {
        clearInterval(authRefreshIntervalRef.current);
        authRefreshIntervalRef.current = null;
      }

      // Close WebSocket only on actual component unmount
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        isInitializedRef.current = false; // Reset flag
        websocket.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentionally empty - WebSocket should only be initialized once on mount
    // Callbacks (loadSymbols, subscribeTick, sendRequest) are stable and accessed via closure
  }, []);

  // Separate effect for symbols check that depends on connected state
  useEffect(() => {
    // Periodically check if symbols are loaded, retry if not
    const maxRetries = 10; // Limit retries to prevent infinite spam
    const symbolsCheckInterval = setInterval(() => {
      if (connected && !symbolsLoadedRef.current && ws.current?.readyState === WebSocket.OPEN && symbolsRetryCountRef.current < maxRetries) {
        symbolsRetryCountRef.current++;
        loadSymbols();
      }
    }, 2000); // Check every 2 seconds

    return () => {
      clearInterval(symbolsCheckInterval);
    };
  }, [connected, loadSymbols]);

  const getHistory = useCallback(
    (symbol, style, granularity, count, callback) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        historyCallback.current = callback;
        const candleStreamKey = `candles-${symbol}`;
        if (streamSubscriptions.current.has(candleStreamKey)) {
          forgetStream(streamSubscriptions.current.get(candleStreamKey));
          streamSubscriptions.current.delete(candleStreamKey);
        }

        // Build request according to Deriv API documentation
        // https://developers.deriv.com/docs/trading-apis#ticks-history
        // For long-term data, calculate start time based on count and granularity
        let startTime = 1; // Default: 1 day ago

        if (style === 'candles' && granularity) {
          // For candles, calculate start time to get enough historical data
          // granularity is in seconds, count is number of candles
          // Add buffer of 2x to ensure we get enough data
          const secondsNeeded = (count || 1000) * granularity * 2;
          startTime = Math.floor(Date.now() / 1000) - secondsNeeded;
        } else {
          // For ticks, use a larger count to get more historical data
          // Default to 7 days ago for ticks (604800 seconds)
          startTime = Math.floor(Date.now() / 1000) - 604800;
        }

        const request = {
          ticks_history: symbol,
          adjust_start_time: 1, // Adjust if market is closed at end time
          count: count || (style === 'candles' ? 5000 : 10000), // More data for long-term view
          end: 'latest',
          start: startTime, // Calculated start time for long-term data
          style: style || 'ticks',
        };

        // Add granularity only for candles style
        if (style === 'candles' && granularity) {
          request.granularity = granularity;
        }

        // Add subscribe for real-time updates
        if (style === 'candles') {
          request.subscribe = 1;
        }

        ws.current.send(JSON.stringify(request));
      }
    },
    [forgetStream],
  );

  const login = useCallback(
    (token) => {
      return sendRequest({ authorize: token }).then((authResponse) => {
        // CRITICAL: Handle authorize response to update user state with all accounts
        // This ensures account_list is properly stored and user.loginid is updated
        const authData = authResponse?.authorize;
        if (authData) {
          setUser(prev => {
            // CRITICAL: Token priority order:
            // 1. Token from request (most reliable)
            // 2. Token from prev state
            // 3. Token from localStorage
            let tokenToUse = token;
            if (!tokenToUse) {
              tokenToUse = prev?.token;
            }
            if (!tokenToUse) {
              try {
                const stored = localStorage.getItem('deriv_user');
                if (stored) {
                  const parsed = JSON.parse(stored);
                  if (parsed?.token && typeof parsed.token === 'string' && parsed.token.trim().length > 0) {
                    tokenToUse = parsed.token;
                  }
                }
              } catch (e) {
                // Ignore errors
              }
            }
            
            // CRITICAL: Check if we're using an API token and have a user OAuth token
            // If so, don't use API owner's account_list - use logged-in user's accounts instead
            const isUsingAPIToken = tokenToUse && isAPIToken(tokenToUse);
            const userOAuthToken = getUserOAuthToken();
            const shouldUseUserAccount = isUsingAPIToken && userOAuthToken && prev?.token === userOAuthToken;
            
            // If using API token but have user account, preserve user's account info
            if (shouldUseUserAccount) {
              console.log('[DerivContext] Login with API token - preserving user account info, NOT using API owner accounts');
              // Keep user's own account info, don't overwrite with API owner's wallet
              return {
                ...prev,
                // Keep user's token (OAuth token), not API token
                token: userOAuthToken,
                // Keep user's loginid, balance, currency, accounts - don't use API owner's
              };
            }
            
            // CRITICAL: Preserve the selected loginid if it was explicitly set before login
            // This ensures that when switching accounts, the selected account's loginid is preserved
            // The authorize response might return the primary account's loginid, but we want to use the selected one
            // Priority: 1) Selected account from localStorage (if different from auth), 2) Previous loginid if different from auth, 3) Auth response loginid
            let selectedLoginid = authData.loginid || prev?.loginid;
            
            // CRITICAL: Priority order for loginid during account switching:
            // 1) Previous loginid if different from auth (account switch in progress - most reliable)
            // 2) Selected account from localStorage if different from auth (user switched)
            // 3) Auth response loginid (default/primary account)
            
            // Priority 1: Check if prev.loginid is different from auth (account switch in progress)
            // This is the most reliable indicator that user is switching accounts
            if (prev?.loginid && prev.loginid !== authData.loginid) {
              selectedLoginid = prev.loginid;
              console.log('[DerivContext] Preserving previous loginid (account switch in progress):', selectedLoginid);
            } else {
              // Priority 2: Check localStorage for selected account loginid
              // Only use it if it's different from auth response (means user switched accounts)
              try {
                const selectedAccountStr = localStorage.getItem('deriv_selectedAccount');
                if (selectedAccountStr) {
                  const selectedAccount = JSON.parse(selectedAccountStr);
                  if (selectedAccount?.loginid && selectedAccount.loginid !== authData.loginid) {
                    selectedLoginid = selectedAccount.loginid;
                    console.log('[DerivContext] Using selected account loginid from localStorage (account switch):', selectedLoginid);
                  } else {
                    // Selected account matches auth response or not found - use auth response
                    selectedLoginid = authData.loginid;
                    console.log('[DerivContext] Using auth response loginid (no account switch):', selectedLoginid);
                  }
                }
              } catch (e) {
                // Ignore parse errors, use auth response
                selectedLoginid = authData.loginid;
              }
            }
            
            // CRITICAL: Get balance for selected account from account_list
            // The authorize response balance is for the primary account, not the selected account
            let selectedAccountBalance = authData.balance !== undefined && authData.balance !== null 
              ? (parseFloat(authData.balance) || 0) 
              : (prev?.balance || 0);
            
            // If selectedLoginid is different from authData.loginid, find the balance from account_list
            // BUT only if NOT using API token (don't use API owner's account_list)
            if (!shouldUseUserAccount && selectedLoginid && selectedLoginid !== authData.loginid && authData.account_list) {
              const selectedAcc = authData.account_list.find(acc => acc.loginid === selectedLoginid);
              if (selectedAcc && selectedAcc.balance !== undefined && selectedAcc.balance !== null) {
                const accBalance = parseFloat(selectedAcc.balance);
                if (!isNaN(accBalance)) {
                  selectedAccountBalance = accBalance;
                  console.log('[DerivContext] Using selected account balance from account_list:', {
                    loginid: selectedLoginid,
                    balance: selectedAccountBalance
                  });
                }
              }
            }
            
            const newUser = {
              ...authData,
              // CRITICAL: Always include token from request
              token: tokenToUse || prev?.token || null,
              // CRITICAL: Use selected loginid (preserves account switch)
              loginid: selectedLoginid,
              // CRITICAL: Ensure currency is set
              currency: authData.currency || prev?.currency || 'USD',
              // CRITICAL: Use selected account's balance, not authorize response balance
              // The authorize response balance is for the primary account, not the selected account
              balance: selectedAccountBalance,
              // Preserve liveBalances
              liveBalances: prev?.liveBalances || {},
              // CRITICAL: Include ALL accounts from account_list (for account switching)
              // BUT NEVER use API owner's account_list when we have user OAuth token
              accounts: (!shouldUseUserAccount && authData.account_list && Array.isArray(authData.account_list) && authData.account_list.length > 0)
                ? authData.account_list.map(acc => {
                    // Parse balance properly
                    let accBalance = 0;
                    if (acc.balance !== undefined && acc.balance !== null) {
                      accBalance = parseFloat(acc.balance);
                      if (isNaN(accBalance)) {
                        accBalance = 0;
                      }
                    }
                    return {
                      loginid: acc.loginid,
                      currency: acc.currency || authData.currency || 'USD',
                      is_virtual: acc.is_virtual || false,
                      balance: accBalance
                    };
                  })
                : (prev?.accounts || [])
            };
            
            // If authorize response has balance and loginid, update liveBalances
            // BUT skip if using API token with user account (don't use API owner's balance)
            if (!shouldUseUserAccount && authData.balance !== undefined && authData.balance !== null && authData.loginid) {
              const authBalance = parseFloat(authData.balance) || 0;
              newUser.liveBalances = {
                ...newUser.liveBalances,
                [authData.loginid]: {
                  balance: authBalance,
                  currency: authData.currency || 'USD'
                }
              };
            }
            
            // CRITICAL: Save token and loginid to localStorage
            if (newUser.token) {
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
                  token: newUser.token,
                  loginid: newUser.loginid || storedData.loginid,
                  currency: newUser.currency || storedData.currency || 'USD'
                }));
              } catch (e) {
                // Ignore localStorage errors
              }
            }
            
            return newUser;
          });
        }
        return authResponse;
      }).catch((error) => {
        // Silently handle authorization errors - don't show toast
        // WebSocket connection errors and WrongResponse errors are handled gracefully through retry logic
        // Only log unexpected errors to console for debugging
        const errorMessage = error?.message || error?.toString() || '';
        const errorCode = error?.code;
        const isWebSocketError = errorMessage.includes('WebSocket not connected');
        const isWrongResponse = errorCode === 'WrongResponse' || errorMessage.includes('WrongResponse');
        const isExpectedError = isWebSocketError || isWrongResponse;

        if (!isExpectedError) {
          console.error('Authorization error:', error);
        }
        throw error;
      });
    },
    [sendRequest],
  );

  // Method to update user state immediately (for account switching)
  const updateUser = useCallback((userData) => {
    setUser(prev => {
      // CRITICAL: Always preserve token - priority: userData.token > prev.token > localStorage
      let tokenToUse = userData?.token;
      if (!tokenToUse) {
        tokenToUse = prev?.token;
      }
      if (!tokenToUse) {
        try {
          const stored = localStorage.getItem('deriv_user');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.token && typeof parsed.token === 'string' && parsed.token.trim().length > 0) {
              tokenToUse = parsed.token;
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
      
      const updated = {
        ...prev,
        ...userData,
        // CRITICAL: Always include token (never let it be undefined/null)
        token: tokenToUse || prev?.token || null,
        // Preserve liveBalances if they exist
        liveBalances: {
          ...(prev?.liveBalances || {}),
          ...(userData?.liveBalances || {})
        }
      };
      
      // CRITICAL: Save token to localStorage whenever user state is updated
      if (updated.token) {
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
          // Update localStorage with token to keep it in sync
          localStorage.setItem('deriv_user', JSON.stringify({
            ...storedData,
            token: updated.token,
            loginid: updated.loginid || storedData.loginid,
            currency: updated.currency || storedData.currency || 'USD'
          }));
        } catch (e) {
          // Ignore localStorage errors
        }
      }
      
      return updated;
    });
  }, []);

  // Method to deduct balance immediately after trade execution
  const deductBalance = useCallback((amount, loginid = null) => {
    setUser(prev => {
      if (!prev) {
        console.warn('[deductBalance] No user state available');
        return prev;
      }
      
      const targetLoginid = loginid || prev.loginid;
      if (!targetLoginid) {
        console.warn('[deductBalance] No loginid available');
        return prev;
      }
      
      // CRITICAL: Get current balance from liveBalances first (most accurate)
      const currentBalance = prev.liveBalances?.[targetLoginid]?.balance ?? prev.balance ?? 0;
      const newBalance = Math.max(0, currentBalance - amount);
      
      
      const updated = {
        ...prev,
        // Update main balance if it's the current account
        balance: targetLoginid === prev.loginid ? newBalance : prev.balance,
        liveBalances: {
          ...(prev.liveBalances || {}),
          [targetLoginid]: {
            balance: newBalance,
            currency: prev.liveBalances?.[targetLoginid]?.currency || prev.currency || 'USD'
          }
        }
      };
      
      return updated;
    });
  }, []);

  // Sync userExistsRef with user state to track if user exists
  useEffect(() => {
    userExistsRef.current = user !== null && user !== undefined;
  }, [user]);

  // CRITICAL: Initialize user state from localStorage on mount if available
  // This ensures user state is set immediately if already logged in, before WebSocket authorize
  useEffect(() => {
    // Only initialize if user state is null (not already set)
    if (user === null) {
      try {
        const stored = localStorage.getItem('deriv_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          // Initialize if token exists (be lenient - if it's in localStorage, use it)
          // The authorize response will validate it properly
          if (parsed?.token && typeof parsed.token === 'string' && parsed.token.trim().length > 0) {
            // Initialize user state with data from localStorage
            // This will be updated with full data when authorize response comes in
            setUser({
              token: parsed.token,
              loginid: parsed.loginid || null,
              currency: parsed.currency || 'USD',
              balance: parsed.balance || 0,
              liveBalances: {},
              accounts: []
            });
            
          }
        }
      } catch (e) {
        // Ignore parse errors
        console.error('[DerivContext] Error initializing user from localStorage:', e);
      }
    }
  }, []); // Run only once on mount

  // Method to request balance update from server
  const requestBalanceUpdate = useCallback((loginid = null) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.warn('[DerivContext] Cannot request balance update - WebSocket not ready:', ws.current?.readyState);
      return;
    }
    
    const targetLoginid = loginid || user?.loginid;
    if (!targetLoginid) {
      console.warn('[DerivContext] Cannot request balance update - no loginid');
      return;
    }
    
    try {
      console.log('[DerivContext] Requesting balance update for account:', targetLoginid);
      ws.current.send(JSON.stringify({ balance: 1, account: targetLoginid }));
    } catch (e) {
      console.error('[DerivContext] Failed to request balance update:', e);
    }
  }, [user?.loginid]);

  return (
    <DerivContext.Provider
      value={{
        api,
        connected,
        activeSymbols,
        tickData,
        marketHistory,
        user,
        subscribeTick,
        getHistory,
        forgetStream,
        login,
        updateUser,
        deductBalance,
        requestBalanceUpdate,
      }}
    >
      {children}
    </DerivContext.Provider>
  );
};