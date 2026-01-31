// components/Header.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useDerivAPI } from '@/contexts/DerivContext';
import { getWebSocketEndpoint, getOAuthRedirectUrl, getAppId } from '@/lib/config';
import { ChevronRight, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Logo = () => (
  <div className="flex items-center gap-2">
    <img src="/logo.jpg" alt="X TradingAI Logo" className="h-14 w-auto md:h-20 lg:h-22" />
  </div>
);

export default function Header({ onLogin, onSignup, aiPrediction, top5Methods = [], currentMethodIndex = 0 }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef(null);
  const authRefreshIntervalRef = useRef(null);
  const isReconnectingRef = useRef(false);
  const switchAccountTimeoutRef = useRef(null);

  const { login, connected } = useDerivAPI();

  const APP_ID = getAppId();
  const AFFILIATE_TRACKING_URL = 'https://track.deriv.com/_js0p5HUTwM1B4VdSfJsOp2Nd7ZgqdRLk/1/';

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all intervals
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (authRefreshIntervalRef.current) {
        clearInterval(authRefreshIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (switchAccountTimeoutRef.current) {
        clearTimeout(switchAccountTimeoutRef.current);
      }
      // Close WebSocket
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {
          // Ignore errors
        }
      }
    };
  }, []);

  // Sync OAuth token from Header storage into shared DerivContext for trading
  useEffect(() => {
    if (!connected) return;
    const saved = localStorage.getItem('deriv_user');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.token) {
        login(parsed.token).catch(() => {});
      }
    } catch {
      // ignore parse errors
    }
  }, [connected, login]);

  useEffect(() => {
    const url = new URL(window.location.href);

    const deepAccounts = [];
    let i = 1;
    while (true) {
      const token = url.searchParams.get(`token${i}`);
      const acct = url.searchParams.get(`acct${i}`);
      const cur = url.searchParams.get(`cur${i}`) || 'USD';
      if (!token || !acct) break;
      deepAccounts.push({ token, loginid: acct, currency: cur });
      i++;
    }

    if (deepAccounts.length > 0) {
      localStorage.setItem('deriv_all_accounts', JSON.stringify(deepAccounts));
      const primary = deepAccounts[0];
      localStorage.setItem('deriv_user', JSON.stringify(primary));
      // initConnection(primary); // Disabled - DerivContext handles WebSocket
      window.history.replaceState({}, '', '/');
      return;
    }

    const code = url.searchParams.get('code');
    if (code) {
      exchangeCode(code);
      return;
    }

    const saved = localStorage.getItem('deriv_user');
    if (saved) {
      // Disabled - DerivContext handles WebSocket
      // try { initConnection(JSON.parse(saved)); }
      // catch { localStorage.removeItem('deriv_user'); }
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
      } catch {
        localStorage.removeItem('deriv_user');
      }
    }
  }, []);

  const exchangeCode = async (code) => {
    try {
      const res = await fetch(`/api/deriv/token?code=${code}`);
      const data = await res.json();
      if (data.authorize?.token) {
        const u = {
          token: data.authorize.token,
          loginid: data.authorize.loginid,
          currency: data.authorize.currency || 'USD',
        };
        localStorage.setItem('deriv_user', JSON.stringify(u));
        setUser(u); // Set user state instead of init connection
        // initConnection(u); // Disabled - DerivContext handles WebSocket
        window.history.replaceState({}, '', '/');
      }
    } catch (e) {}
  };

  const startHeartbeat = (ws) => {
    // Clear any existing heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    // Send ping every 5 seconds to keep connection alive and prevent session timeout
    heartbeatIntervalRef.current = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ ping: 1 }));
        } catch (e) {
          // Ignore errors
        }
      }
    }, 5000);
  };

  const startAuthRefresh = (ws) => {
    // Clear any existing auth refresh
    if (authRefreshIntervalRef.current) {
      clearInterval(authRefreshIntervalRef.current);
    }

    // Refresh authorization every 5 minutes to prevent session timeout
    authRefreshIntervalRef.current = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          const stored = localStorage.getItem('deriv_user');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.token) {
              // Silently refresh authorization to keep session alive
              ws.send(JSON.stringify({ authorize: parsed.token }));
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
    }, 5 * 60 * 1000); // 5 minutes
  };

  const attemptReconnect = (userData) => {
    if (isReconnectingRef.current) return;
    
    isReconnectingRef.current = true;
    reconnectAttemptsRef.current += 1;

    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);

    reconnectTimeoutRef.current = setTimeout(() => {
      isReconnectingRef.current = false;
      // Only reconnect if we still have user data (not logged out)
      const currentUser = localStorage.getItem('deriv_user');
      if (currentUser) {
        try {
          const parsed = JSON.parse(currentUser);
          if (parsed?.token) {
            initConnection(parsed);
          }
        } catch (e) {
          // If can't parse, logout
          logout();
        }
      }
    }, delay);
  };

  const initConnection = (userData) => {
    // Close existing connection if any
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        // Ignore errors
      }
      wsRef.current = null;
    }

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const wsEndpoint = getWebSocketEndpoint();
    console.log('[Header] Creating WebSocket to:', wsEndpoint);
    const ws = new WebSocket(wsEndpoint);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0; // Reset on successful connection
      isReconnectingRef.current = false;
      ws.send(JSON.stringify({ authorize: userData.token }));
      startHeartbeat(ws);
      startAuthRefresh(ws);
    };

    ws.onmessage = (msg) => {
      let d;
      try { d = JSON.parse(msg.data); } catch { return; }

      if (d.error) {
        if (d.error.code === 'InvalidToken') {
          // Token expired - logout
          logout();
        }
        return;
      }

      if (d.msg_type === 'authorize' && d.authorize) {
        const auth = d.authorize;

        const fullUser = {
          token: auth.token,
          loginid: auth.loginid,
          currency: auth.currency || 'USD',
          accounts: auth.account_list || [],
          liveBalances: {},
          ws,
        };

        setUser(fullUser);
        setIsSwitching(false);

        const current = auth.account_list?.find(a => a.loginid === auth.loginid) || auth.account_list?.[0];
        if (current) {
          setSelectedAccount(current);
        }

        if (auth.account_list && auth.account_list.length > 0) {
          auth.account_list.forEach(acc => {
            ws.send(JSON.stringify({ balance: 1, account: acc.loginid }));
          });
        }

        ws.send(JSON.stringify({ balance: 1, account: 'all', subscribe: 1 }));
      }

      if (d.msg_type === 'switch_account' && d.switch_account) {
        const switchData = d.switch_account;
        
        // Clear any pending switch timeout
        if (switchAccountTimeoutRef.current) {
          clearTimeout(switchAccountTimeoutRef.current);
          switchAccountTimeoutRef.current = null;
        }
        
        // Update user state with switched account info
        setUser(prev => {
          // Find the switched account from the accounts list
          const switchedAccount = prev?.accounts?.find(a => a.loginid === switchData.loginid);
          
          // Update selected account with the found account info
          if (switchedAccount) {
            setSelectedAccount({
              ...switchedAccount,
              balance: parseFloat(switchData.balance) || 0,
              currency: switchData.currency || switchedAccount.currency || prev?.currency || 'USD',
            });
          } else {
            // If account not found in list, create a basic account object
            setSelectedAccount({
              loginid: switchData.loginid,
              balance: parseFloat(switchData.balance) || 0,
              currency: switchData.currency || prev?.currency || 'USD',
              is_virtual: switchData.loginid?.includes('VR') || false,
            });
          }
          
          return {
            ...prev,
            loginid: switchData.loginid,
            currency: switchData.currency || prev?.currency || 'USD',
            balance: parseFloat(switchData.balance) || 0,
          };
        });
        
        setIsSwitching(false);
        
        // Update localStorage
        try {
          const currentStored = localStorage.getItem('deriv_user');
          if (currentStored) {
            const storedData = JSON.parse(currentStored);
            localStorage.setItem('deriv_user', JSON.stringify({
              ...storedData,
              loginid: switchData.loginid,
              currency: switchData.currency || storedData.currency || 'USD',
            }));
          }
        } catch (e) {
          // Ignore localStorage errors
        }
        
        // Fetch updated balance
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ balance: 1, account: switchData.loginid }));
        }
      }

      if (d.msg_type === 'balance' && d.balance) {
        const { loginid, balance, currency } = d.balance;

        setUser(prev => ({
          ...prev,
          liveBalances: {
            ...prev?.liveBalances,
            [loginid]: { balance, currency }
          }
        }));

        setSelectedAccount(prev => 
          prev?.loginid === loginid ? { ...prev, balance, currency } : prev
        );
      }

      if (d.msg_type === 'pong') {
        // Heartbeat response - connection is alive
      }
    };

    ws.onerror = () => {
      // Silently handle errors - reconnection will handle it
    };

    ws.onclose = () => {
      // Clear intervals
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (authRefreshIntervalRef.current) {
        clearInterval(authRefreshIntervalRef.current);
        authRefreshIntervalRef.current = null;
      }

      // Don't immediately logout - try to reconnect first
      // Only logout if we've exhausted reconnection attempts or user explicitly logged out
      const currentUser = localStorage.getItem('deriv_user');
      if (currentUser && reconnectAttemptsRef.current < 10) {
        // Try to reconnect
        attemptReconnect(userData);
      } else if (!currentUser) {
        // User was logged out, clear state
        setUser(null);
        setIsSwitching(false);
        setSelectedAccount(null);
      }
    };
  };

  const logout = () => {
    // Clear all intervals
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (authRefreshIntervalRef.current) {
      clearInterval(authRefreshIntervalRef.current);
      authRefreshIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (switchAccountTimeoutRef.current) {
      clearTimeout(switchAccountTimeoutRef.current);
      switchAccountTimeoutRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        // Ignore errors
      }
      wsRef.current = null;
    }

    // Reset reconnection state
    isReconnectingRef.current = false;
    reconnectAttemptsRef.current = 0;

    // Clear storage and state
    localStorage.clear();
    setUser(null);
    setSelectedAccount(null);
    setIsSwitching(false);
    window.location.href = '/';
  };

  const switchAccount = (acc) => {
    setDropdownOpen(false);
    
    // Don't switch if already switching or if it's the same account
    if (isSwitching) return;
    if (selectedAccount?.loginid === acc.loginid) return;
    
    // Get the current WebSocket connection (use wsRef for reliability)
    const ws = wsRef.current || user?.ws;
    const isWSConnected = ws && ws.readyState === WebSocket.OPEN;
    
    // Check if account is in current user's account list
    const isAccountInList = user?.accounts?.some(a => a.loginid === acc.loginid);
    
    // Try fast path: use switch_account if account is in current list and WS is connected
    if (isAccountInList && isWSConnected) {
      setIsSwitching(true);
      
      // Clear any existing timeout
      if (switchAccountTimeoutRef.current) {
        clearTimeout(switchAccountTimeoutRef.current);
      }
      
      // Set a timeout to handle cases where switch_account doesn't respond
      switchAccountTimeoutRef.current = setTimeout(() => {
        console.warn('Account switch timeout, falling back to slow path');
        switchAccountTimeoutRef.current = null;
        setIsSwitching(false);
        // Fall back to slow path
        const allTokens = JSON.parse(localStorage.getItem('deriv_all_accounts') || '[]');
        const tokenInfo = allTokens.find(t => t.loginid === acc.loginid);
        if (tokenInfo) {
          localStorage.setItem('deriv_user', JSON.stringify(tokenInfo));
          setUser(null);
          setSelectedAccount(null);
          initConnection(tokenInfo);
        }
      }, 5000); // 5 second timeout
      
      try {
        ws.send(JSON.stringify({ switch_account: acc.loginid }));
        // Optimistically update selected account with current balance - will be confirmed by switch_account response
        const { balance, currency } = getBalance(acc);
        setSelectedAccount({
          ...acc,
          balance,
          currency,
        });
      } catch (e) {
        if (switchAccountTimeoutRef.current) {
          clearTimeout(switchAccountTimeoutRef.current);
          switchAccountTimeoutRef.current = null;
        }
        console.error('Failed to switch account via WebSocket:', e);
        setIsSwitching(false);
        // Fall back to slow path if switch_account fails
        const allTokens = JSON.parse(localStorage.getItem('deriv_all_accounts') || '[]');
        const tokenInfo = allTokens.find(t => t.loginid === acc.loginid);
        if (tokenInfo) {
          localStorage.setItem('deriv_user', JSON.stringify(tokenInfo));
          setUser(null);
          setSelectedAccount(null);
          initConnection(tokenInfo);
        }
      }
      return;
    }
    
    // Slow path: create new connection (only when account requires different token)
    const allTokens = JSON.parse(localStorage.getItem('deriv_all_accounts') || '[]');
    const tokenInfo = allTokens.find(t => t.loginid === acc.loginid);

    if (tokenInfo) {
      setIsSwitching(true);
      localStorage.setItem('deriv_user', JSON.stringify(tokenInfo));
      setUser(null);
      setSelectedAccount(null);
      // Remove setTimeout delay - connect immediately
      initConnection(tokenInfo);
    } else {
      // Account not in token list but in account list - try switch_account anyway
      if (isWSConnected) {
        setIsSwitching(true);
        
        // Clear any existing timeout
        if (switchAccountTimeoutRef.current) {
          clearTimeout(switchAccountTimeoutRef.current);
        }
        
        switchAccountTimeoutRef.current = setTimeout(() => {
          console.warn('Account switch timeout');
          switchAccountTimeoutRef.current = null;
          setIsSwitching(false);
        }, 5000);
        
        try {
          ws.send(JSON.stringify({ switch_account: acc.loginid }));
          const { balance, currency } = getBalance(acc);
          setSelectedAccount({
            ...acc,
            balance,
            currency,
          });
        } catch (e) {
          if (switchAccountTimeoutRef.current) {
            clearTimeout(switchAccountTimeoutRef.current);
            switchAccountTimeoutRef.current = null;
          }
          console.error('Failed to switch account:', e);
          setIsSwitching(false);
        }
      } else {
        console.error('Cannot switch account: WebSocket not connected and no token found');
      }
    }
  };

  const handleLogin = () => {
    window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&response_type=code&redirect_uri=${encodeURIComponent(getOAuthRedirectUrl() + 'oauth/callback')}`;
    onLogin?.();
  };

  const handleSignup = () => {
    window.location.href = AFFILIATE_TRACKING_URL;
    onSignup?.();
  };

  const getBalance = (acc) => {
    const live = user?.liveBalances?.[acc.loginid];
    if (live) return { balance: live.balance, currency: live.currency };
    return { balance: acc.balance || 0, currency: acc.currency || user?.currency || 'USD' };
  };

  const getAccountType = (acc) => {
    if (acc.is_virtual) {
      return 'Options Demo Wallet';
    }
    return `Options ${acc.currency || 'USD'} Wallet`;
  };

  const AccountIcon = ({ account, isSelected }) => {
    if (account.is_virtual) {
      // Demo account icon - grid with "derivdemo" overlay
      return (
        <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
          <div className="absolute inset-0 bg-gray-200 rounded-lg flex items-center justify-center">
            <div className="grid grid-cols-2 gap-0.5 w-7 h-7 p-1">
              <div className="bg-blue-500 rounded-tl"></div>
              <div className="bg-green-500 rounded-tr"></div>
              <div className="bg-yellow-500 rounded-bl"></div>
              <div className="bg-red-500 rounded-br"></div>
            </div>
          </div>
          <span className="absolute bottom-0 left-0 right-0 text-[8px] md:text-[7px] font-bold text-red-600 leading-tight text-center px-0.5 bg-white/80 rounded-b">
            derivdemo
          </span>
        </div>
      );
    }
    // Real account icon - grid with flag overlay
    return (
      <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
        <div className="absolute inset-0 bg-gray-200 rounded-lg flex items-center justify-center">
          <div className="grid grid-cols-2 gap-0.5 w-7 h-7 p-1">
            <div className="bg-blue-500 rounded-tl"></div>
            <div className="bg-green-500 rounded-tr"></div>
            <div className="bg-yellow-500 rounded-bl"></div>
            <div className="bg-red-500 rounded-br"></div>
          </div>
        </div>
        <img 
          src={`/flags/${(account.currency || 'us').toLowerCase()}.svg`} 
          alt={account.currency || 'USD'}
          className="absolute w-5 h-5 rounded-full border-2 border-white shadow-sm"
          onError={(e) => {
            // Fallback to US flag if flag not found
            e.target.src = '/flags/us.svg';
          }}
        />
      </div>
    );
  };

  const currentMethod = top5Methods[currentMethodIndex];

  return (
    <header className="h-12 md:h-20 flex items-center justify-between px-2 md:px-6 bg-white border-b border-gray-200 flex-shrink-0 relative z-50 gap-2">
      <Logo />

      {/* Top 5 Methods Display - Navbar (Mobile & Desktop) */}
      {aiPrediction && top5Methods.length > 0 && currentMethod && (
        <div className="flex items-center gap-1 md:gap-3 flex-1 justify-center mx-1 md:mx-4 min-w-0">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 backdrop-blur-md border-2 border-purple-200 rounded-xl px-1.5 py-1 md:px-3 md:py-2 shadow-xl">
            <div className="flex items-center gap-1.5 md:gap-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentMethodIndex}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-1 md:gap-2 bg-white rounded-lg px-1.5 py-0.5 md:px-3 md:py-1.5 border-2 border-purple-300 shadow-md"
                >
                  <div className="flex items-center justify-center w-4 h-4 md:w-6 md:h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white text-[9px] md:text-xs font-bold shadow-sm flex-shrink-0">
                    {currentMethodIndex + 1}
                  </div>
                  <div className="flex items-center gap-0.5 md:gap-1.5 min-w-0">
                    <span className="text-[9px] md:text-xs font-bold text-gray-800 whitespace-nowrap truncate max-w-[60px] md:max-w-none">
                      {currentMethod.name}
                    </span>
                    {currentMethod.digit !== null && currentMethod.digit !== undefined && (
                      <span className="text-[9px] md:text-sm font-extrabold text-purple-600 flex-shrink-0">({currentMethod.digit})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 px-1 py-0.5 md:px-2 md:py-0.5 bg-purple-100 rounded-md flex-shrink-0">
                    <span className="text-[9px] md:text-xs font-bold text-purple-700">{currentMethod.confidence}%</span>
                  </div>
                </motion.div>
              </AnimatePresence>
              <div className="flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full bg-white/80 border border-purple-200 shadow-sm flex-shrink-0">
                <span className="text-[8px] md:text-[10px] font-bold text-purple-600">{currentMethodIndex + 1}/5</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0 min-w-0">
        {(user || isSwitching) ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              disabled={isSwitching}
              className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-xs md:text-sm disabled:opacity-60 min-w-0"
            >
              {isSwitching ? 'Switching...' : (
                <>
                  {selectedAccount && (
                    <AccountIcon account={selectedAccount} isSelected={true} />
                  )}
                  <span className="font-semibold text-gray-900 text-xs md:text-sm whitespace-nowrap">
                    {Number(selectedAccount?.balance || 0).toFixed(2)} {selectedAccount?.currency || user?.currency || 'USD'}
                  </span>
                  <svg className={`w-4 h-4 text-gray-500 transition ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>

            {dropdownOpen && user && !isSwitching && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b font-semibold text-sm bg-white text-gray-900">
                  Options accounts
                </div>

                <div className="p-2">
                  {user.accounts.map(acc => {
                    const { balance, currency } = getBalance(acc);
                    const isSelected = acc.loginid === selectedAccount?.loginid;

                    return (
                      <div
                        key={acc.loginid}
                        onClick={() => !isSwitching && switchAccount(acc)}
                        className={`flex items-start gap-3 p-3 mb-2 rounded-lg transition-colors ${
                          isSwitching 
                            ? 'opacity-50 cursor-not-allowed' 
                            : 'cursor-pointer'
                        } ${
                          isSelected ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'
                        }`}
                      >
                        <AccountIcon account={acc} isSelected={isSelected} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 mb-1">
                            {getAccountType(acc)}
                          </div>
                          <div className="text-base font-bold text-gray-900">
                            {Number(balance).toFixed(2)} {currency}
                          </div>
                        </div>
                        {acc.is_virtual && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded flex-shrink-0">
                            Demo
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 space-y-2">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      // Navigate to Trader's Hub for CFDs
                      window.open('https://app.deriv.com/', '_blank');
                    }}
                    className="flex items-center justify-between text-sm text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    <span>Looking for CFDs? Go to Trader's Hub</span>
                    <ChevronRight className="w-4 h-4" />
                  </a>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center justify-between text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-2 rounded transition-colors"
                  >
                    <span className="font-medium">Log out</span>
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:flex items-center gap-3">
              <Button variant="outline" onClick={handleLogin}>Log in</Button>
              <Button className="bg-red-500 hover:bg-red-600 text-white" onClick={handleSignup}>Sign up</Button>
            </div>
            <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </>
        )}
      </div>

      {isMenuOpen && !user && !isSwitching && (
        <div className="absolute top-full left-0 right-0 bg-white border-b shadow-lg md:hidden z-50">
          <div className="p-4 space-y-2">
            <Button variant="ghost" className="w-full justify-start" onClick={() => { handleLogin(); setIsMenuOpen(false); }}>
              Log in
            </Button>
            <Button className="w-full bg-red-500 hover:bg-red-600 text-white" onClick={() => { handleSignup(); setIsMenuOpen(false); }}>
              Sign up
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}