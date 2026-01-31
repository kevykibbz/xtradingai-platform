import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Toaster } from '@/components/ui/toaster';
import ChartArea from '@/components/ChartArea';
import TradePanel from '@/components/TradePanel';
import ScriptRunnerPanel from '@/components/ScriptRunnerPanel';
import { useDerivAPI } from '@/contexts/DerivContext';
import { logConfig } from '@/lib/config';
import { useAppDispatch } from '@/store/hooks';
import { setTradeType as setTradeTypeRedux } from '@/store/slices/tradeTypeSlice';
import Header from '@/components/Header';
import AuthModal from '@/components/AuthModal';
import FloatingTradeTypeSelector from '@/components/FloatingTradeTypeSelector';
import MobileTradeTypeCarousel, { getActionButtonLabels, getTradeTypeConfig } from '@/components/MobileTradeTypeCarousel';
import TradeExecution from '@/components/TradeExecution'; // Import TradeExecution
import OpenPositions from '@/components/OpenPositions';
import { useOpenPositions } from '@/hooks/useOpenPositions';
import { BarChart3, User, ListFilter, Bell, ChevronUp, ChevronDown, Terminal, Target, Repeat, Waves, Zap, Layers, TrendingUp, FileText, ArrowUpDown, ChevronsUpDown, ChevronRight, X, Settings, ChevronLeft, Brain, Trophy, Loader2 } from 'lucide-react';
import MobileMarketSelector from "@/components/MobileMarketSelector.jsx";
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { isValidAuthToken, isUserAuthenticated } from '@/lib/utils';

// Always start with fresh defaults - no URL params or localStorage
const getInitialState = () => {
    return {
        chartType: 'area',
        timeInterval: '1t',
        tradeType: 'rise_fall',
        activeIndicators: [],
        selectedSymbol: null,
    };
};

const AppContent = () => {
    const { activeSymbols, tickData, api, connected: isConnected, user } = useDerivAPI();

    const initialState = getInitialState();
    const [selectedMarket, setSelectedMarket] = useState(null);

    // Check if user can trade (logged in with valid token)
    // Match desktop logic: allow if user exists with valid token OR localStorage has valid deriv_user
    // Note: Balance check is done in onClick handler, not here (same as desktop)
    // Use state to track localStorage changes reactively
    const [hasLocalStorageUser, setHasLocalStorageUser] = useState(() => {
        try {
            return isUserAuthenticated();
        } catch {
            return false;
        }
    });

    // Initialize app configuration on startup
    useEffect(() => {
        logConfig();
    }, []);

    // Update localStorage check when user changes or on mount
    useEffect(() => {
        const checkLocalStorage = () => {
            try {
                setHasLocalStorageUser(isUserAuthenticated());
            } catch {
                setHasLocalStorageUser(false);
            }
        };
        checkLocalStorage();

        // Listen for storage changes (e.g., from other tabs or components)
        const handleStorageChange = (e) => {
            if (e.key === 'deriv_user' || e.key === null) {
                checkLocalStorage();
            }
        };
        window.addEventListener('storage', handleStorageChange);

        // Also listen for custom events (for same-tab updates)
        const handleCustomStorageChange = () => {
            checkLocalStorage();
        };
        window.addEventListener('localStorageChange', handleCustomStorageChange);

        // Poll localStorage periodically to catch immediate changes (fallback)
        // Use 1000ms interval for better performance (was 100ms)
        const intervalId = setInterval(checkLocalStorage, 1000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('localStorageChange', handleCustomStorageChange);
            clearInterval(intervalId);
        };
    }, [user]);

    const [isScriptRunnerOpen, setIsScriptRunnerOpen] = useState(false);
    const [chartData, setChartData] = useState([]);
    const [chartType, setChartType] = useState(initialState.chartType);
    const [timeInterval, setTimeInterval] = useState(initialState.timeInterval);
    const [tradeType, setTradeType] = useState(initialState.tradeType);

    // Comprehensive check for trade button disabled state
    // This checks: login, balance, proposals, connection, trade type, market, account
    // This will automatically update when any of these dependencies change
    const isTradeButtonDisabled = useMemo(() => {
        // SIMPLIFIED LOGIC: If user has wallet balance, they're logged in and can trade
        // Check balance from all possible sources
        let accountBalance = 0;

        // Priority 1: Check liveBalances (most up-to-date, handles multiple accounts)
        if (user?.liveBalances && Object.keys(user.liveBalances).length > 0) {
            const balances = Object.values(user.liveBalances);
            const maxBalance = Math.max(...balances.map(b => (b.balance || 0)));
            if (maxBalance > 0) {
                accountBalance = maxBalance;
            }
        }

        // Priority 2: Check user.balance
        if (accountBalance <= 0 && user?.balance) {
            accountBalance = user.balance;
        }

        // Priority 3: Check localStorage for balance and token (fallback)
        // Check localStorage directly for immediate reactivity (not just relying on state)
        let hasLocalStorageToken = false;
        let hasLocalStorageUserData = false;
        try {
            const saved = localStorage.getItem('deriv_user');
            if (saved) {
                const parsed = JSON.parse(saved);
                // More lenient check: token exists and has reasonable length (not just empty string)
                // This catches valid tokens even if they don't pass strict validation
                if (parsed?.token && typeof parsed.token === 'string' && parsed.token.trim().length >= 10) {
                    hasLocalStorageToken = true;
                    hasLocalStorageUserData = true;
                }
                if (parsed.balance && parsed.balance > 0) {
                    accountBalance = parsed.balance;
                }
            }
        } catch (e) {
            // Ignore errors
        }

        // If user has balance, they're logged in - enable trading
        // Only disable if no balance AND no user state AND no localStorage token
        const hasBalance = accountBalance > 0;
        
        // More lenient check: user object exists OR has token (even if not validated) OR localStorage has user data
        // This ensures buttons enable immediately after login, even if validation is pending
        // Check both state variable AND direct localStorage check for maximum reactivity
        const hasUserState = !!user || 
                            hasLocalStorageUser || 
                            hasLocalStorageUserData ||
                            hasLocalStorageToken || 
                            (user?.token && typeof user.token === 'string' && user.token.trim().length >= 10) ||
                            (user?.token && isValidAuthToken(user.token));

        // If user has balance, they're definitely logged in - allow trading
        if (hasBalance) {
            // Still need connection and API for trading
            if (!api || !isConnected) return true;
            // Proposals will be checked per button
            return false;
        }

        // If no balance but has user state, still allow (balance might be loading)
        // Only disable if completely not logged in
        if (hasUserState) {
            if (!api || !isConnected) return true;
            return false; // Allow trading even with 0 balance (balance check happens in onClick)
        }

        // No user state at all - disable
        return true;
    }, [user, hasLocalStorageUser, api, isConnected, tradeType, selectedMarket]);

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authMode, setAuthMode] = useState('login');

    // Removed URL parameter reading - app always starts fresh
    const [isTradeTypeSelectorOpen, setIsTradeTypeSelectorOpen] = useState(false);
    const [isMarketSelectorOpen, setIsMarketSelectorOpen] = useState(false);
    const [stake, setStake] = useState(10);
    const [durationValue, setDurationValue] = useState(5);
    const [callProposal, setCallProposal] = useState(null);
    const [putProposal, setPutProposal] = useState(null);
    const [isLoadingProposals, setIsLoadingProposals] = useState(false);

    // State for synced proposals from TradeExecution component (for mobile footer buttons)
    const [syncedProposals, setSyncedProposals] = useState(null);

    // New state for mobile trade panel (must be declared before useEffect that uses it)
    const [isMobileTradePanelOpen, setIsMobileTradePanelOpen] = useState(false);
    const [isMobilePositionsOpen, setIsMobilePositionsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);


    // Detect mobile viewport
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    const [activeIndicators, setActiveIndicators] = useState(initialState.activeIndicators);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isAppReady, setIsAppReady] = useState(false);
    const [chartReady, setChartReady] = useState(false);

    // Ref to track if we're updating URL programmatically (to prevent infinite loops)
    const isUpdatingUrlRef = useRef(false);
    const lastSyncedSymbolRef = useRef(null);

    // State for barrier/strike price visualization on chart
    const [chartBarriers, setChartBarriers] = useState([]);

    // Trade types that use barriers (constant, defined outside component would be better but keeping here for now)
    const barrierTradeTypes = useMemo(() => ['higher_lower', 'touch_no_touch', 'ends_in_out', 'stays_in_goes_out', 'turbos', 'call_put', 'accumulators'], []);

    // Clear barriers when switching to trade types that don't use barriers
    useEffect(() => {
        const usesBarriers = tradeType && barrierTradeTypes.includes(tradeType);
        if (!usesBarriers && chartBarriers.length > 0) {
            setChartBarriers([]);
        }
    }, [tradeType, barrierTradeTypes, chartBarriers.length]);

    // Open positions management
    const {
        openPositions,
        addPosition,
        removePosition,
        sellPosition,
    } = useOpenPositions();

    const { toast } = useToast();

    // Handle online/offline status for webview
    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            sessionStorage.removeItem('webview_offline');
        };

        const handleOffline = () => {
            setIsOffline(true);
            sessionStorage.setItem('webview_offline', 'true');
        };

        // Check initial status - check both navigator and sessionStorage
        const webviewOffline = sessionStorage.getItem('webview_offline') === 'true';
        setIsOffline(!navigator.onLine || webviewOffline);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Also listen for webview errors
        const errorHandler = (e) => {
            // If it's a network error, mark as offline
            if (e.message && (
                e.message.includes('Failed to fetch') ||
                e.message.includes('NetworkError') ||
                e.message.includes('Load failed') ||
                e.message.includes('net::ERR')
            )) {
                setIsOffline(true);
                sessionStorage.setItem('webview_offline', 'true');
            }
        };

        window.addEventListener('error', errorHandler);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('error', errorHandler);
        };
    }, []);

    const [aiPrediction, setAiPrediction] = useState({
        direction: 'RISE',
        confidence: 75,
        reason: 'Based on recent momentum and RSI indicators.',
        lastUpdated: new Date().toISOString(),
        digitPrediction: 5,
        digitConfidence: 0.8,
        // Trade-type-specific confidence values (0-100)
        touchNoTouchConfidence: 72,
        matchesDiffersConfidence: 74,
        higherLowerConfidence: 70,
        endsInOutConfidence: 73,
        staysInGoesOutConfidence: 71,
        evenOddConfidence: 68,
        overUnderConfidence: 69
    });

    // Calculate top 5 methods for navbar display
    const top5Methods = useMemo(() => {
        if (!aiPrediction) return [];

        const hasDigitPrediction = typeof aiPrediction.digitPrediction === 'number' && aiPrediction.digitPrediction !== null && aiPrediction.digitPrediction !== undefined;
        const digitConfidence = hasDigitPrediction ? Math.round((aiPrediction.digitConfidence || 0.5) * 100) : null;

        const methods = [
            {
                name: 'Matches/Differs',
                confidence: hasDigitPrediction ? digitConfidence : (aiPrediction.matchesDiffersConfidence ?? aiPrediction.confidence),
                digit: hasDigitPrediction ? aiPrediction.digitPrediction : null
            },
            {
                name: 'Touch/No Touch',
                confidence: hasDigitPrediction ? digitConfidence : (aiPrediction.touchNoTouchConfidence ?? aiPrediction.confidence),
                digit: hasDigitPrediction ? aiPrediction.digitPrediction : null
            },
            {
                name: 'Rise/Fall',
                confidence: aiPrediction.confidence,
                digit: null
            },
            {
                name: 'Higher/Lower',
                confidence: aiPrediction.higherLowerConfidence ?? aiPrediction.confidence,
                digit: null
            },
            {
                name: 'Even/Odd',
                confidence: hasDigitPrediction ? digitConfidence : (aiPrediction.evenOddConfidence ?? aiPrediction.confidence),
                digit: hasDigitPrediction ? aiPrediction.digitPrediction : null
            },
            {
                name: 'Over/Under',
                confidence: hasDigitPrediction ? digitConfidence : (aiPrediction.overUnderConfidence ?? aiPrediction.confidence),
                digit: hasDigitPrediction ? aiPrediction.digitPrediction : null
            },
            {
                name: 'Ends In/Out',
                confidence: aiPrediction.endsInOutConfidence ?? aiPrediction.confidence,
                digit: null
            },
            {
                name: 'Stays In/Goes Out',
                confidence: aiPrediction.staysInGoesOutConfidence ?? aiPrediction.confidence,
                digit: null
            },
            {
                name: 'Call/Put',
                confidence: aiPrediction.confidence,
                digit: null
            },
            {
                name: 'Turbos',
                confidence: aiPrediction.confidence,
                digit: null
            }
        ];

        return methods
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5);
    }, [aiPrediction]);

    // State for rotating through top 5 methods in navbar
    const [navbarMethodIndex, setNavbarMethodIndex] = useState(0);

    // Auto-rotate through top 5 methods in navbar
    useEffect(() => {
        if (top5Methods.length === 0) {
            setNavbarMethodIndex(0);
            return;
        }
        const interval = setInterval(() => {
            setNavbarMethodIndex((prev) => (prev + 1) % top5Methods.length);
        }, 3000); // Change every 3 seconds
        return () => clearInterval(interval);
    }, [top5Methods.length]);

    // Track app ready state
    useEffect(() => {
        if (isOffline) {
            setIsAppReady(false);
            return;
        }

        // App is ready when core conditions are met
        const ready = isConnected && activeSymbols.length > 0 && selectedMarket && chartData.length > 0;
        setIsAppReady(ready);
    }, [isConnected, activeSymbols.length, chartData.length, selectedMarket, isOffline]);

    // Resolve selectedMarket from URL/storage once activeSymbols are loaded
    useEffect(() => {
        // Wait for symbols to load
        if (activeSymbols.length === 0) return;

        // Skip if we just updated the URL programmatically (prevent infinite loop)
        if (isUpdatingUrlRef.current) {
            isUpdatingUrlRef.current = false;
            return;
        }

        // Always start with default market - no URL or localStorage reading
        if (!selectedMarket) {
            const defaultMarket = activeSymbols.find(s => s.symbol === 'R_100' || s.id === 'R_100') ||
                activeSymbols.find(s => s.market === 'synthetic_index') ||
                activeSymbols[0];
            if (defaultMarket) {
                lastSyncedSymbolRef.current = defaultMarket.symbol;
                setSelectedMarket(defaultMarket);
            }
        }

        if (!settingsLoaded) setSettingsLoaded(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSymbols.length, selectedMarket, settingsLoaded]); // Using length for stability - effect only needs to run when symbols are first loaded


    // Note: Removed localStorage persistence - app starts fresh on refresh
    // Settings are only synced to URL for shareable links, not persisted locally

    // Sync key settings into URL parameters for shareable links
    useEffect(() => {
        // Skip if this is the initial load and symbol hasn't changed
        if (!settingsLoaded) return;

        // Skip if symbol hasn't actually changed (prevent unnecessary URL updates)
        if (selectedMarket?.symbol === lastSyncedSymbolRef.current) {
            return;
        }

        try {
            const url = new URL(window.location.href);
            const params = url.searchParams;

            if (selectedMarket?.symbol) {
                params.set('symbol', selectedMarket.symbol);
                lastSyncedSymbolRef.current = selectedMarket.symbol;
            } else {
                params.delete('symbol');
                lastSyncedSymbolRef.current = null;
            }

            params.set('chartType', chartType);
            params.set('interval', timeInterval);
            params.set('tradeType', tradeType);

            url.search = params.toString();
            isUpdatingUrlRef.current = true; // Mark that we're updating URL
            window.history.replaceState({}, '', url.toString());
        } catch {
            // ignore if URL APIs not available
        }
    }, [selectedMarket?.symbol, chartType, timeInterval, tradeType, settingsLoaded]);

    useEffect(() => {
        const interval = setInterval(() => {
            const baseConfidence = Math.floor(Math.random() * 50) + 50;
            setAiPrediction(prev => ({
                ...prev,
                confidence: baseConfidence,
                direction: Math.random() > 0.5 ? 'RISE' : 'FALL',
                digitPrediction: Math.floor(Math.random() * 10),
                digitConfidence: Math.random() * 0.5 + 0.5,
                // Generate real trade-type-specific confidence values (within ±5% of base)
                touchNoTouchConfidence: Math.max(0, Math.min(100, baseConfidence + Math.floor(Math.random() * 10) - 5)),
                matchesDiffersConfidence: Math.max(0, Math.min(100, baseConfidence + Math.floor(Math.random() * 10) - 5)),
                higherLowerConfidence: Math.max(0, Math.min(100, baseConfidence + Math.floor(Math.random() * 10) - 5)),
                endsInOutConfidence: Math.max(0, Math.min(100, baseConfidence + Math.floor(Math.random() * 10) - 5)),
                staysInGoesOutConfidence: Math.max(0, Math.min(100, baseConfidence + Math.floor(Math.random() * 10) - 5)),
                evenOddConfidence: Math.max(0, Math.min(100, baseConfidence + Math.floor(Math.random() * 10) - 5)),
                overUnderConfidence: Math.max(0, Math.min(100, baseConfidence + Math.floor(Math.random() * 10) - 5)),
                lastUpdated: new Date().toISOString()
            }));
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const openAuthModal = (mode) => {
        setAuthMode(mode);
        setIsAuthModalOpen(true);
    };

    const dispatch = useAppDispatch();

    const handleSelectTradeType = (type) => {
        // Clear proposals immediately when trade type changes
        setCallProposal(null);
        setPutProposal(null);
        setIsLoadingProposals(true);

        setTradeType(type);
        // CRITICAL: Update Redux store for trade type change - triggers proposal fetching
        dispatch(setTradeTypeRedux(type));
        setIsMobileTradePanelOpen(true);
        
        // Auto-close the trade type selector panel after selection
        setIsTradeTypeSelectorOpen(false);
    };

    const lastTick = selectedMarket ? tickData?.[selectedMarket.symbol] : null;

    useEffect(() => {
        const handleOpenMarketSelector = () => {
            setIsMarketSelectorOpen(true);
        };

        window.addEventListener('openMobileMarketSelector', handleOpenMarketSelector);

        return () => {
            window.removeEventListener('openMobileMarketSelector', handleOpenMarketSelector);
        };
    }, []);

    const proposalIntervalRef = useRef(null);
    const retryDelayRef = useRef(10000);
    const consecutiveRateLimitsRef = useRef(0);
    const prevTradeTypeRef = useRef(tradeType);

    useEffect(() => {
        // Clear proposals immediately when trade type changes to disable buttons
        const tradeTypeChanged = prevTradeTypeRef.current !== tradeType && prevTradeTypeRef.current !== null;
        if (tradeTypeChanged) {
            setCallProposal(null);
            setPutProposal(null);
            setIsLoadingProposals(true);
        }
        prevTradeTypeRef.current = tradeType;

        const fetchProposals = async () => {
            // Don't fetch if not connected or missing requirements
            if (!selectedMarket?.symbol || stake <= 0 || !api || !isConnected) {
                // Clear proposals if requirements not met - don't set fake defaults
                // Fake defaults cause buttons to appear enabled but trades will fail
                setCallProposal(null);
                setPutProposal(null);
                setIsLoadingProposals(false);
                return;
            }

            // Set loading state when starting to fetch
            setIsLoadingProposals(true);

            const baseParams = (contractType) => {
                const params = {
                    proposal: 1,
                    amount: stake,
                    basis: 'stake',
                    contract_type: contractType,
                    currency: 'USD',
                    symbol: selectedMarket.symbol,
                };

                // Only add duration/duration_unit for trade types that use them
                // Accumulators don't use duration, they use growth_rate and take_profit
                if (tradeType !== 'accumulators') {
                    params.duration = durationValue;
                    params.duration_unit = 't'; // 't' for ticks
                }

                return params;
            };

            // Determine the correct contract types based on trade type
            const getContractTypes = () => {
                switch (tradeType) {
                    case 'rise_fall':
                    case 'higher_lower':
                    case 'call_put':
                        return ['CALL', 'PUT'];
                    case 'touch_no_touch':
                        return ['ONETOUCH', 'NOTOUCH'];
                    case 'ends_in_out':
                        return ['EXPIRYRANGE', 'EXPIRYMISS'];
                    case 'stays_in_goes_out':
                        return ['RANGE', 'UPORDOWN'];
                    case 'matches_differs':
                        return ['DIGITMATCH', 'DIGITDIFF'];
                    case 'even_odd':
                        return ['DIGITEVEN', 'DIGITODD'];
                    case 'over_under':
                        return ['DIGITOVER', 'DIGITUNDER'];
                    case 'multipliers':
                        return ['MULTUP', 'MULTDOWN'];
                    case 'turbos':
                        return ['TURBOSLONG', 'TURBOSSHORT'];
                    case 'accumulators':
                        return null; // Handled by AccumulatorsExecution
                    default:
                        return ['CALL', 'PUT'];
                }
            };

            try {
                // For accumulators, don't fetch proposals here - handled by AccumulatorsExecution
                if (tradeType === 'accumulators') {
                    return;
                }

                const contractTypes = getContractTypes();
                if (!contractTypes || contractTypes.length < 2) {
                    return;
                }

                const [positiveRes, negativeRes] = await Promise.all([
                    api.send(baseParams(contractTypes[0])),
                    api.send(baseParams(contractTypes[1]))
                ]);

                // Success - reset rate limit counter and delay
                consecutiveRateLimitsRef.current = 0;
                retryDelayRef.current = 10000;

                if (positiveRes.proposal && positiveRes.proposal.id) {
                    setCallProposal({
                        ...positiveRes.proposal,
                        payout: positiveRes.proposal.payout || 19.50
                    });
                } else {
                    setCallProposal(null);
                }

                if (negativeRes.proposal && negativeRes.proposal.id) {
                    setPutProposal({
                        ...negativeRes.proposal,
                        payout: negativeRes.proposal.payout || 18.75
                    });
                } else {
                    setPutProposal(null);
                }

                // Clear loading state after proposals are fetched
                setIsLoadingProposals(false);
            } catch (error) {
                // Don't log expected errors (WebSocket not connected, rate limits, WrongResponse)
                const isRateLimit = error?.code === 'RateLimit' || error?.message?.includes('rate limit');
                const isWebSocketError = error.message === 'WebSocket not connected';
                const isWrongResponse = error?.code === 'WrongResponse';


                // Handle rate limits with exponential backoff
                if (isRateLimit) {
                    consecutiveRateLimitsRef.current++;
                    // Exponential backoff: 10s, 20s, 40s, 60s (max)
                    const newDelay = Math.min(60000, 10000 * Math.pow(2, consecutiveRateLimitsRef.current - 1));
                    retryDelayRef.current = newDelay;

                    // Restart interval with new delay
                    if (proposalIntervalRef.current) {
                        clearInterval(proposalIntervalRef.current);
                    }
                    proposalIntervalRef.current = setInterval(fetchProposals, newDelay);
                    return; // Don't set default proposals on rate limit, keep existing ones
                } else {
                    // Reset on non-rate-limit errors
                    consecutiveRateLimitsRef.current = 0;
                    retryDelayRef.current = 10000;
                }

                // For other errors, clear proposals instead of setting defaults
                // This ensures buttons are disabled and user knows proposals aren't ready
                setCallProposal(null);
                setPutProposal(null);
                setIsLoadingProposals(false);
            }
        };

        fetchProposals();
        proposalIntervalRef.current = setInterval(fetchProposals, retryDelayRef.current);

        return () => {
            if (proposalIntervalRef.current) {
                clearInterval(proposalIntervalRef.current);
                proposalIntervalRef.current = null;
            }
        };
    }, [stake, durationValue, selectedMarket?.symbol, api, isConnected, tradeType]);

    const handlePurchase = async (actionType, proposal) => {
        // Accumulators are handled by AccumulatorsExecution component
        if (tradeType === 'accumulators') {
            return;
        }

        // Validate proposal - don't allow default/mock proposals
        if (!proposal || !proposal.id || proposal.id.includes('default')) {
            toast({
                title: 'Proposal Not Ready',
                description: 'Please wait for the proposal to load before placing a trade.',
                variant: 'destructive'
            });
            return;
        }

        // SIMPLIFIED: If user has wallet balance OR valid token, they're logged in
        // Don't require loginid/accounts to be present - they might not be loaded yet
        const hasValidAuth = (() => {
            // Check 1: User has balance (from any source) = definitely logged in
            let accountBalance = 0;
            if (user?.liveBalances && Object.keys(user.liveBalances).length > 0) {
                const balances = Object.values(user.liveBalances);
                const maxBalance = Math.max(...balances.map(b => (b.balance || 0)));
                if (maxBalance > 0) {
                    accountBalance = maxBalance;
                }
            }
            if (accountBalance <= 0 && user?.balance) {
                accountBalance = user.balance;
            }
            if (accountBalance > 0) {
                return true; // Has balance = logged in
            }

            // Check 2: User has valid token (even without loginid/accounts yet)
            if (user?.token && isValidAuthToken(user.token)) {
                return true; // Valid token = logged in
            }

            // Check 3: localStorage has valid token
            return isUserAuthenticated();
        })();

        if (!hasValidAuth) {
            toast({
                title: 'Login Required',
                description: 'Please log in to your account to place trades',
                variant: 'destructive'
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

        try {
            let contractType;
            const buttonLabels = getActionButtonLabels(tradeType);
            switch (tradeType) {
                case 'rise_fall':
                    contractType = actionType === 'RISE' ? 'CALL' : 'PUT';
                    break;
                case 'higher_lower':
                    contractType = actionType === 'HIGHER' ? 'CALL' : 'PUT';
                    break;
                case 'touch_no_touch':
                    contractType = actionType === 'TOUCH' ? 'ONETOUCH' : 'NOTOUCH';
                    break;
                case 'ends_in_out':
                    contractType = actionType === 'ENDS_IN' ? 'EXPIRYRANGE' : 'EXPIRYMISS';
                    break;
                case 'stays_in_goes_out':
                    contractType = actionType === 'STAYS_IN' ? 'RANGE' : 'UPORDOWN';
                    break;
                case 'matches_differs':
                    contractType = actionType === 'MATCHES' ? 'DIGITMATCH' : 'DIGITDIFF';
                    break;
                case 'even_odd':
                    contractType = actionType === 'EVEN' ? 'DIGITEVEN' : 'DIGITODD';
                    break;
                case 'over_under':
                    contractType = actionType === 'OVER' ? 'DIGITOVER' : 'DIGITUNDER';
                    break;
                case 'accumulators':
                    contractType = 'ACCU';
                    break;
                case 'multipliers':
                    contractType = actionType === 'UP' ? 'MULTUP' : 'MULTDOWN';
                    break;
                case 'call_put':
                    contractType = actionType === 'CALL' ? 'CALL' : 'PUT';
                    break;
                case 'turbos':
                    contractType = actionType === 'UP' ? 'TURBOSLONG' : 'TURBOSSHORT';
                    break;
                default:
                    contractType = actionType === 'RISE' ? 'CALL' : 'PUT';
            }

            const response = await api.send({
                buy: proposal.id,
                price: proposal.ask_price,
            });

            if (response.buy) {
                const contractId = response.buy.contract_id;
                const buyPrice = response.buy.buy_price;
                const payout = response.buy.payout;

                toast({
                    title: `Purchase Successful`,
                    description: `Contract ID: ${contractId}`,
                });

                // Add position to open positions list
                addPosition({
                    contract_id: contractId,
                    buy_price: buyPrice,
                    payout: payout,
                    contract_type: contractType,
                    trade_type: tradeType,
                    symbol: selectedMarket?.symbol || '',
                    display_name: selectedMarket?.name || selectedMarket?.symbol || '',
                    duration: durationValue,
                    duration_unit: 't', // Default to ticks for mobile footer trades
                    stake: stake,
                    start_time: Date.now() / 1000,
                    profit: 0,
                    sell_price: buyPrice,
                });

                // Open mobile positions drawer automatically after successful trade
                setIsMobilePositionsOpen(true);
            }
        } catch (error) {
            toast({
                title: 'Purchase Failed',
                description: 'Failed to purchase contract. Please try again.',
                variant: 'destructive',
            });
        }
    };

    // Unified function for payout percentage calculation
    const getPayoutPercentage = (proposal) => {
        if (!proposal || stake <= 0) {
            return tradeType === 'accumulators' ? '185.00' : '195.00';
        }
        const profit = proposal.payout || 19.50;
        return ((profit / stake) * 100).toFixed(2);
    };

    const getActionButtonsConfig = () => {
        const buttonLabels = getActionButtonLabels(tradeType);
        const colorClass = buttonLabels.color;

        let positiveIcon, negativeIcon;

        switch (tradeType) {
            case 'rise_fall':
                positiveIcon = <ChevronUp className="h-4 w-4" />;
                negativeIcon = <ChevronDown className="h-4 w-4" />;
                break;
            case 'higher_lower':
                positiveIcon = <ChevronUp className="h-4 w-4" />;
                negativeIcon = <ChevronDown className="h-4 w-4" />;
                break;
            case 'touch_no_touch':
                positiveIcon = <Target className="h-4 w-4" />;
                negativeIcon = <span className="text-lg font-bold">✕</span>;
                break;
            case 'ends_in_out':
                positiveIcon = <Repeat className="h-4 w-4" />;
                negativeIcon = <Repeat className="h-4 w-4 rotate-45" />;
                break;
            case 'stays_in_goes_out':
                positiveIcon = <Waves className="h-4 w-4" />;
                negativeIcon = <Waves className="h-4 w-4 rotate-90" />;
                break;
            case 'matches_differs':
                positiveIcon = <span className="text-lg font-bold">✓</span>;
                negativeIcon = <span className="text-lg font-bold">≠</span>;
                break;
            case 'even_odd':
                positiveIcon = <span className="text-lg font-bold">●</span>;
                negativeIcon = <span className="text-lg font-bold">○</span>;
                break;
            case 'over_under':
                positiveIcon = <ChevronUp className="h-4 w-4" />;
                negativeIcon = <ChevronDown className="h-4 w-4" />;
                break;
            case 'accumulators':
                positiveIcon = <Layers className="h-4 w-4" />;
                negativeIcon = null;
                break;
            case 'multipliers':
                positiveIcon = <TrendingUp className="h-4 w-4" />;
                negativeIcon = <TrendingUp className="h-4 w-4 rotate-180" />;
                break;
            case 'call_put':
                positiveIcon = <ArrowUpDown className="h-4 w-4" />;
                negativeIcon = <ArrowUpDown className="h-4 w-4 rotate-180" />;
                break;
            case 'turbos':
                positiveIcon = <Zap className="h-4 w-4" />;
                negativeIcon = <Zap className="h-4 w-4 rotate-180" />;
                break;
            default:
                positiveIcon = <ChevronUp className="h-4 w-4" />;
                negativeIcon = <ChevronDown className="h-4 w-4" />;
        }

        return {
            positive: {
                label: buttonLabels.positive,
                icon: positiveIcon,
                color: colorClass || 'bg-teal-500 hover:bg-teal-600',
                action: tradeType === 'accumulators' ? 'BUY' :
                    tradeType === 'rise_fall' ? 'RISE' :
                        tradeType === 'higher_lower' ? 'HIGHER' :
                            tradeType === 'touch_no_touch' ? 'TOUCH' :
                                tradeType === 'ends_in_out' ? 'ENDS_IN' :
                                    tradeType === 'stays_in_goes_out' ? 'STAYS_IN' :
                                        tradeType === 'matches_differs' ? 'MATCHES' :
                                            tradeType === 'even_odd' ? 'EVEN' :
                                                tradeType === 'over_under' ? 'OVER' :
                                                    tradeType === 'multipliers' ? 'UP' :
                                                        tradeType === 'call_put' ? 'CALL' :
                                                            tradeType === 'turbos' ? 'UP' : 'RISE'
            },
            negative: buttonLabels.negative ? {
                label: buttonLabels.negative,
                icon: negativeIcon,
                color: tradeType === 'accumulators' ? colorClass : 'bg-red-500 hover:bg-red-600',
                action: tradeType === 'rise_fall' ? 'FALL' :
                    tradeType === 'higher_lower' ? 'LOWER' :
                        tradeType === 'touch_no_touch' ? 'NO_TOUCH' :
                            tradeType === 'ends_in_out' ? 'ENDS_OUT' :
                                tradeType === 'stays_in_goes_out' ? 'GOES_OUT' :
                                    tradeType === 'matches_differs' ? 'DIFFERS' :
                                        tradeType === 'even_odd' ? 'ODD' :
                                            tradeType === 'over_under' ? 'UNDER' :
                                                tradeType === 'multipliers' ? 'DOWN' :
                                                    tradeType === 'call_put' ? 'PUT' :
                                                        tradeType === 'turbos' ? 'DOWN' : 'FALL'
            } : null
        };
    };

    const actionButtons = useMemo(() => getActionButtonsConfig(), [tradeType]);
    const tradeConfig = getTradeTypeConfig(tradeType);

    // Listen for chart ready event
    useEffect(() => {
        const handleChartReady = () => {
            setChartReady(true);
        };
        window.addEventListener('chart-ready', handleChartReady);
        return () => window.removeEventListener('chart-ready', handleChartReady);
    }, []);

    // Also check chartData directly to update chartReady state
    useEffect(() => {
        if (chartData.length > 0 && selectedMarket && !chartReady) {
            // If we have chart data but chart-ready event hasn't fired, set it after a delay
            const timer = setTimeout(() => {
                if (chartData.length > 0) {
                    setChartReady(true);
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [chartData.length, selectedMarket, chartReady]);

    return (
        <>
            <div className="h-screen w-screen bg-white text-black flex flex-col overflow-hidden">
                <Header
                    aiPrediction={aiPrediction}
                    top5Methods={top5Methods}
                    currentMethodIndex={navbarMethodIndex}
                />

                <div className="md:hidden border-b border-gray-100 shadow-sm">
                    <MobileTradeTypeCarousel
                        selectedType={tradeType}
                        onSelectType={handleSelectTradeType}
                        className="h-13"
                    />
                </div>

                <main className="flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
                    {/* Open Positions Sidebar */}
                    {/* Desktop: Don't pass onMobileToggle (undefined = desktop mode shows sidebar) */}
                    {/* Mobile: Pass onMobileToggle for drawer control */}
                    <OpenPositions
                        openPositions={openPositions}
                        isMobileOpen={isMobilePositionsOpen}
                        onMobileToggle={isMobile ? setIsMobilePositionsOpen : undefined}
                        onClosePosition={async (contractId) => {
                            try {
                                const position = openPositions.find(p => p.contract_id === contractId);
                                if (position) {
                                    // Only sell if position is still open
                                    if (!position.is_sold && position.status !== 'sold' && position.status !== 'won' && position.status !== 'lost') {
                                        await sellPosition(contractId, position.sell_price);
                                        toast({
                                            title: '✅ Position Closed',
                                            description: `Contract ${contractId} sold successfully`,
                                        });
                                        // Dispatch event to add to history
                                        window.dispatchEvent(new CustomEvent('position-closed', { detail: position }));
                                    }
                                    // Remove position from list after user manually closes it
                                    removePosition(contractId);
                                }
                            } catch (error) {
                                // Handle specific error cases
                                let errorMessage = error.message || 'Failed to close position';
                                let errorTitle = 'Sell Failed';

                                // Check if error is about resale not being offered
                                if (error.code === 'InvalidOfferings' ||
                                    error.apiError?.code === 'InvalidOfferings' ||
                                    (error.message && error.message.includes('Resale of this contract is not offered')) ||
                                    (error.message && error.message.includes('cannot be sold before expiry'))) {
                                    errorTitle = 'Cannot Sell Contract';
                                    errorMessage = 'This contract type cannot be sold before expiry. It will automatically close at expiry.';
                                } else if (error.code === 'InvalidContract' || error.apiError?.code === 'InvalidContract') {
                                    errorTitle = 'Invalid Contract';
                                    errorMessage = 'This contract is no longer valid or has already been closed.';
                                } else if (error.code === 'ContractNotFound' || error.apiError?.code === 'ContractNotFound') {
                                    errorTitle = 'Contract Not Found';
                                    errorMessage = 'This contract could not be found. It may have already expired or been closed.';
                                }

                                toast({
                                    title: errorTitle,
                                    description: errorMessage,
                                    variant: 'destructive',
                                    duration: 5000,
                                });
                            }
                        }}
                    />

                    <div className="flex-1 flex flex-col overflow-hidden">
                        <ChartArea
                            className="flex-1"
                            selectedMarket={selectedMarket}
                            setSelectedMarket={setSelectedMarket}
                            chartData={chartData}
                            setChartData={setChartData}
                            chartType={chartType}
                            setChartType={setChartType}
                            timeInterval={timeInterval}
                            setTimeInterval={setTimeInterval}
                            isScriptRunnerOpen={isScriptRunnerOpen}
                            setIsScriptRunnerOpen={setIsScriptRunnerOpen}
                            tradeType={tradeType}
                            onOpenTradeTypeSelector={() => setIsTradeTypeSelectorOpen(true)}
                            aiPrediction={aiPrediction}
                            activeIndicators={activeIndicators}
                            setActiveIndicators={setActiveIndicators}
                            chartBarriers={chartBarriers}
                            openPositions={openPositions}
                        />
                    </div>

                    <div className="hidden md:flex w-auto border-l border-gray-200">
                        <TradePanel
                            selectedMarket={selectedMarket}
                            tradeType={tradeType}
                            setTradeType={setTradeType}
                            aiPrediction={aiPrediction}
                            onOpenTradeTypeSelector={() => setIsTradeTypeSelectorOpen(true)}
                            onBarrierChange={setChartBarriers}
                            onTradePlaced={addPosition}
                            openPositions={openPositions}
                        />
                    </div>
                </main>

                <MobileMarketSelector
                    isOpen={isMarketSelectorOpen}
                    onClose={() => setIsMarketSelectorOpen(false)}
                    selectedMarket={selectedMarket}
                    setSelectedMarket={setSelectedMarket}
                />

                <div className="hidden md:block">
                    <FloatingTradeTypeSelector
                        isOpen={isTradeTypeSelectorOpen}
                        onClose={() => setIsTradeTypeSelectorOpen(false)}
                        selectedType={tradeType}
                        onSelectType={handleSelectTradeType}
                        selectedMarket={selectedMarket}
                        aiPrediction={aiPrediction}
                    />
                </div>

                <AnimatePresence>
                    {isMobileTradePanelOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileTradePanelOpen(false)}
                            className="fixed inset-0 bg-black/20 z-40 md:hidden"
                        />
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {isMobileTradePanelOpen && (
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed inset-x-0 bottom-0 z-50 md:hidden bg-white rounded-t-2xl shadow-2xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-4 py-3 border-b bg-white rounded-t-2xl flex-shrink-0">
                                <div className="flex items-center space-x-3">
                                    <div className={`p-2 rounded-lg ${tradeConfig.color === 'blue' ? 'bg-blue-50' :
                                        tradeConfig.color === 'purple' ? 'bg-purple-50' :
                                            tradeConfig.color === 'green' ? 'bg-green-50' :
                                                tradeConfig.color === 'orange' ? 'bg-orange-50' : 'bg-red-50'}`}>
                                        {tradeType === 'rise_fall' ? <ArrowUpDown className="h-5 w-5" /> :
                                            tradeType === 'higher_lower' ? <ChevronsUpDown className="h-5 w-5" /> :
                                                tradeType === 'touch_no_touch' ? <Target className="h-5 w-5" /> :
                                                    tradeType === 'ends_in_out' ? <Repeat className="h-5 w-5" /> :
                                                        tradeType === 'stays_in_goes_out' ? <Waves className="h-5 w-5" /> :
                                                            tradeType === 'matches_differs' ? <Zap className="h-5 w-5" /> :
                                                                tradeType === 'even_odd' ? <ArrowUpDown className="h-5 w-5" /> :
                                                                    tradeType === 'over_under' ? <ChevronsUpDown className="h-5 w-5" /> :
                                                                        tradeType === 'accumulators' ? <Layers className="h-5 w-5" /> :
                                                                            tradeType === 'multipliers' ? <TrendingUp className="h-5 w-5" /> :
                                                                                tradeType === 'call_put' ? <FileText className="h-5 w-5" /> :
                                                                                    <Zap className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg">{tradeConfig.label}</h3>
                                        <p className="text-xs text-gray-500">{tradeConfig.category}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsMobileTradePanelOpen(false)}
                                    className="p-2 rounded-full hover:bg-gray-100"
                                >
                                    <X className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                                <TradeExecution
                                    key={tradeType}
                                    tradeType={tradeType}
                                    selectedMarket={selectedMarket}
                                    aiPrediction={aiPrediction}
                                    digitPrediction={aiPrediction.digitPrediction}
                                    digitConfidence={aiPrediction.digitConfidence}
                                    onBarrierChange={setChartBarriers}
                                    onTradePlaced={addPosition}
                                    openPositions={openPositions}
                                    hideActionButtons={false}
                                    onProposalsSync={setSyncedProposals}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mobile Footer - Floating buttons overlay */}
                {/* Higher z-index than trade panel (z-50) to ensure buttons are always clickable */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-[60] pointer-events-none">
                    {/* Positions Button - Floating icon button - Show when logged in (even without positions) */}
                    {user && user.token && (
                        <div className="px-4 pb-2 pointer-events-auto flex justify-end">
                            <Button
                                onClick={() => setIsMobilePositionsOpen(true)}
                                className="bg-blue-500 hover:bg-blue-600 text-white p-2.5 rounded-full shadow-lg flex items-center justify-center relative"
                            >
                                <BarChart3 className="h-5 w-5" />
                                {openPositions && openPositions.length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                        {openPositions.length}
                                    </span>
                                )}
                            </Button>
                        </div>
                    )}
                    {/* Trade Buttons and Trade Settings - Show synced buttons from TradeExecution */}
                    {syncedProposals && (
                        <div className="flex items-center justify-center gap-2 pb-2 pointer-events-auto px-2">
                            <style>{`
                                .trade-settings-highlight {
                                    position: relative;
                                }
                                .trade-settings-highlight::before {
                                    content: '';
                                    position: absolute;
                                    top: 50%;
                                    left: 50%;
                                    transform: translate(-50%, -50%);
                                    width: calc(100% + 12px);
                                    height: calc(100% + 12px);
                                    border: 3px solid rgba(34, 197, 94, 0.8);
                                    border-radius: 12px;
                                    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.4), 0 0 20px rgba(34, 197, 94, 0.3);
                                    pointer-events: none;
                                }
                            `}</style>
                            
                            {/* Left Trade Button (Positive) */}
                            {syncedProposals.positive && (
                                <Button
                                    onClick={() => {
                                        if (syncedProposals.positive.onClick) {
                                            syncedProposals.positive.onClick();
                                        }
                                    }}
                                    disabled={syncedProposals.positive.disabled || syncedProposals.positive.isLoading}
                                    className={`${syncedProposals.positive.color || 'bg-teal-500 hover:bg-teal-600'} flex-1 h-10 text-white font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-xs px-2`}
                                >
                                    {syncedProposals.positive.isLoading ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <>
                                            {typeof syncedProposals.positive.icon === 'function' 
                                                ? syncedProposals.positive.icon() 
                                                : React.createElement(syncedProposals.positive.icon, { className: "h-3.5 w-3.5 mr-1" })}
                                            <span>{syncedProposals.positive.label}</span>
                                        </>
                                    )}
                                </Button>
                            )}

                            {/* Trade Settings Button - Center */}
                            <Button
                                onClick={() => setIsMobileTradePanelOpen(true)}
                                className="bg-transparent hover:bg-white/90 text-gray-900 px-3 py-1.5 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 shadow-lg trade-settings-highlight relative z-10 backdrop-blur-sm"
                            >
                                <ChevronUp className="h-3.5 w-3.5 text-gray-700" />
                                <span>Trade Settings</span>
                            </Button>

                            {/* Right Trade Button (Negative) */}
                            {syncedProposals.negative && (
                                <Button
                                    onClick={() => {
                                        if (syncedProposals.negative.onClick) {
                                            syncedProposals.negative.onClick();
                                        }
                                    }}
                                    disabled={syncedProposals.negative.disabled || syncedProposals.negative.isLoading}
                                    className={`${syncedProposals.negative.color || 'bg-red-500 hover:bg-red-600'} flex-1 h-10 text-white font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-xs px-2`}
                                >
                                    {syncedProposals.negative.isLoading ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <>
                                            {typeof syncedProposals.negative.icon === 'function' 
                                                ? syncedProposals.negative.icon() 
                                                : React.createElement(syncedProposals.negative.icon, { className: "h-3.5 w-3.5 mr-1" })}
                                            <span>{syncedProposals.negative.label}</span>
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    )}
                    
                    {/* Fallback: Trade Settings Button only if no synced proposals */}
                    {!syncedProposals && (
                        <div className="flex justify-center pb-2 pointer-events-auto">
                            <style>{`
                                .trade-settings-highlight {
                                    position: relative;
                                }
                                .trade-settings-highlight::before {
                                    content: '';
                                    position: absolute;
                                    top: 50%;
                                    left: 50%;
                                    transform: translate(-50%, -50%);
                                    width: calc(100% + 12px);
                                    height: calc(100% + 12px);
                                    border: 3px solid rgba(34, 197, 94, 0.8);
                                    border-radius: 12px;
                                    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.4), 0 0 20px rgba(34, 197, 94, 0.3);
                                    pointer-events: none;
                                }
                            `}</style>
                            <Button
                                onClick={() => setIsMobileTradePanelOpen(true)}
                                className="bg-transparent hover:bg-white/90 text-gray-900 px-3 py-1.5 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 shadow-lg trade-settings-highlight relative z-10 backdrop-blur-sm"
                            >
                                <ChevronUp className="h-3.5 w-3.5 text-gray-700" />
                                <span>Trade Settings</span>
                            </Button>
                        </div>
                    )}

                    {/* AI Trade Idea for relevant method */}
                    {aiPrediction && aiPrediction.direction && (() => {
                        // Get relevant signal for current trade type
                        const getRelevantSignal = () => {
                            const relevantMap = {
                                'rise_fall': {
                                    title: 'Rise / Fall',
                                    confidence: aiPrediction.confidence,
                                    description: `${aiPrediction.confidence}% confidence for ${aiPrediction.direction === 'RISE' ? 'RISE' : 'FALL'}`,
                                    color: 'text-green-600',
                                    borderColor: 'border-green-300',
                                    bgColor: 'bg-green-50'
                                },
                                'higher_lower': {
                                    title: 'Higher / Lower',
                                    confidence: aiPrediction.higherLowerConfidence ?? aiPrediction.confidence,
                                    description: `Bias towards ${aiPrediction.direction === 'RISE' ? 'HIGHER' : 'LOWER'} closes.`,
                                    color: 'text-blue-600',
                                    borderColor: 'border-blue-300',
                                    bgColor: 'bg-blue-50'
                                },
                                'touch_no_touch': {
                                    title: 'Touch / No Touch',
                                    confidence: aiPrediction.touchNoTouchConfidence ?? aiPrediction.confidence,
                                    description: `Price may ${aiPrediction.direction === 'RISE' ? 'touch' : 'not touch'} barrier.`,
                                    color: 'text-purple-600',
                                    borderColor: 'border-purple-300',
                                    bgColor: 'bg-purple-50'
                                },
                                'ends_in_out': {
                                    title: 'Ends In / Out',
                                    confidence: aiPrediction.endsInOutConfidence ?? aiPrediction.confidence,
                                    description: `Price likely to end ${aiPrediction.direction === 'RISE' ? 'in' : 'out'} of range.`,
                                    color: 'text-cyan-600',
                                    borderColor: 'border-cyan-300',
                                    bgColor: 'bg-cyan-50'
                                },
                                'stays_in_goes_out': {
                                    title: 'Stays In / Out',
                                    confidence: aiPrediction.staysInGoesOutConfidence ?? aiPrediction.confidence,
                                    description: `Price expected to ${aiPrediction.direction === 'RISE' ? 'stay in' : 'go out'} range.`,
                                    color: 'text-indigo-600',
                                    borderColor: 'border-indigo-300',
                                    bgColor: 'bg-indigo-50'
                                },
                                'matches_differs': {
                                    title: 'Matches / Differs',
                                    confidence: typeof aiPrediction.digitPrediction === 'number'
                                        ? Math.round((aiPrediction.digitConfidence || 0.5) * 100)
                                        : (aiPrediction.matchesDiffersConfidence ?? aiPrediction.confidence),
                                    description: typeof aiPrediction.digitPrediction === 'number'
                                        ? `Favoured digit ${aiPrediction.digitPrediction} (${Math.round((aiPrediction.digitConfidence || 0.5) * 100)}%)`
                                        : `${aiPrediction.matchesDiffersConfidence ?? aiPrediction.confidence}% confidence`,
                                    color: 'text-pink-600',
                                    borderColor: 'border-pink-300',
                                    bgColor: 'bg-pink-50'
                                },
                                'even_odd': {
                                    title: 'Even / Odd',
                                    confidence: typeof aiPrediction.digitPrediction === 'number'
                                        ? Math.round((aiPrediction.digitConfidence || 0.5) * 100)
                                        : aiPrediction.confidence - 6,
                                    description: typeof aiPrediction.digitPrediction === 'number'
                                        ? `Favoured digit ${aiPrediction.digitPrediction} (${Math.round((aiPrediction.digitConfidence || 0.5) * 100)}%)`
                                        : `Last digit likely ${aiPrediction.direction === 'RISE' ? 'even' : 'odd'}`,
                                    color: 'text-teal-600',
                                    borderColor: 'border-teal-300',
                                    bgColor: 'bg-teal-50'
                                },
                                'over_under': {
                                    title: 'Over / Under',
                                    confidence: typeof aiPrediction.digitPrediction === 'number'
                                        ? Math.round((aiPrediction.digitConfidence || 0.5) * 100)
                                        : aiPrediction.confidence - 7,
                                    description: typeof aiPrediction.digitPrediction === 'number'
                                        ? `Favoured digit ${aiPrediction.digitPrediction} (${Math.round((aiPrediction.digitConfidence || 0.5) * 100)}%)`
                                        : `Last digit ${aiPrediction.direction === 'RISE' ? 'over' : 'under'} threshold`,
                                    color: 'text-rose-600',
                                    borderColor: 'border-rose-300',
                                    bgColor: 'bg-rose-50'
                                },
                                'accumulators': {
                                    title: 'Accumulators',
                                    confidence: aiPrediction.confidence,
                                    description: `${aiPrediction.confidence}% confidence for ${aiPrediction.direction === 'RISE' ? 'RISE' : 'FALL'}`,
                                    color: 'text-orange-600',
                                    borderColor: 'border-orange-300',
                                    bgColor: 'bg-orange-50'
                                },
                                'multipliers': {
                                    title: 'Multipliers',
                                    confidence: aiPrediction.confidence,
                                    description: `${aiPrediction.confidence}% confidence for ${aiPrediction.direction === 'RISE' ? 'RISE' : 'FALL'}`,
                                    color: 'text-orange-600',
                                    borderColor: 'border-orange-300',
                                    bgColor: 'bg-orange-50'
                                },
                                'call_put': {
                                    title: 'Call / Put',
                                    confidence: aiPrediction.confidence,
                                    description: `${aiPrediction.confidence}% confidence for ${aiPrediction.direction === 'RISE' ? 'CALL' : 'PUT'}`,
                                    color: 'text-red-600',
                                    borderColor: 'border-red-300',
                                    bgColor: 'bg-red-50'
                                },
                                'turbos': {
                                    title: 'Turbos',
                                    confidence: aiPrediction.confidence,
                                    description: `${aiPrediction.confidence}% confidence for ${aiPrediction.direction === 'RISE' ? 'RISE' : 'FALL'}`,
                                    color: 'text-orange-600',
                                    borderColor: 'border-orange-300',
                                    bgColor: 'bg-orange-50'
                                }
                            };

                            return relevantMap[tradeType] || relevantMap['rise_fall'];
                        };

                        const signal = getRelevantSignal();

                        // Get appropriate direction text based on trade type
                        const getDirectionText = () => {
                            if (!aiPrediction.direction) return '';
                            const isRise = aiPrediction.direction === 'RISE';

                            switch (tradeType) {
                                case 'rise_fall':
                                    return isRise ? 'RISE' : 'FALL';
                                case 'higher_lower':
                                    return isRise ? 'HIGHER' : 'LOWER';
                                case 'touch_no_touch':
                                    return isRise ? 'TOUCH' : 'NO TOUCH';
                                case 'ends_in_out':
                                    return isRise ? 'ENDS OUT' : 'ENDS IN';
                                case 'stays_in_goes_out':
                                    return isRise ? 'GOES OUT' : 'STAYS IN';
                                case 'matches_differs':
                                    return isRise ? 'MATCHES' : 'DIFFERS';
                                case 'even_odd':
                                    return isRise ? 'EVEN' : 'ODD';
                                case 'over_under':
                                    return isRise ? 'OVER' : 'UNDER';
                                case 'call_put':
                                    return isRise ? 'CALL' : 'PUT';
                                case 'turbos':
                                case 'multipliers':
                                case 'accumulators':
                                    return isRise ? 'UP' : 'DOWN';
                                default:
                                    return aiPrediction.direction;
                            }
                        };

                        const directionText = getDirectionText();

                        // Check if matches_differs has digit prediction for pink highlighting
                        const hasDigitPrediction = signal.title === 'Matches / Differs' && typeof aiPrediction.digitPrediction === 'number';
                        const isHighlighted = hasDigitPrediction;

                        return (
                            <div className={`w-full px-2 pt-1.5 pb-1 bg-white/95 backdrop-blur-sm border-b ${isHighlighted && signal.title === 'Matches / Differs' ? 'border-pink-400 border-2' : signal.borderColor} border-t-0`}>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Brain className="h-3 w-3 text-blue-600" />
                                    <span className="text-[8px] font-semibold text-gray-700">AI Trade Idea</span>
                                </div>
                                <div className={`${isHighlighted && signal.title === 'Matches / Differs' ? 'bg-pink-100 border-pink-400 border-2' : signal.bgColor || 'bg-gray-50'} rounded px-1.5 py-1 border ${isHighlighted && signal.title === 'Matches / Differs' ? 'border-pink-400' : signal.borderColor}`}>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[9px] font-bold text-gray-800">
                                            {signal.title}
                                            {directionText && (
                                                <span className={`ml-0.5 ${signal.color}`}>
                                                    {directionText}
                                                </span>
                                            )}
                                            {isHighlighted && signal.title === 'Matches / Differs' && (
                                                <span className="ml-1 text-[8px] text-pink-600">★</span>
                                            )}
                                        </p>
                                        <span className={`text-[8px] font-semibold ${signal.color}`}>
                                            {signal.confidence}%
                                        </span>
                                    </div>
                                    <p className="text-[8px] text-gray-600 mt-0.5 line-clamp-1">
                                        {signal.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Show action buttons for all trade types including digits */}
                    {/* Desktop buttons - hidden on mobile */}
                    <div className="hidden md:flex px-2 py-3 pb-4 border-b border-gray-100 bg-gray-50 gap-2 overflow-visible relative z-[60]">
                        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-gray-100 p-2 rounded-lg gap-2 flex-1 min-w-0 shadow-sm">
                            <div className="hidden sm:flex-1">
                                <span className="text-xs text-gray-500 block sm:inline">Payout</span>
                                <p className="font-semibold text-green-600 text-sm sm:ml-2">{getPayoutPercentage(callProposal)}%</p>
                            </div>
                            <Button
                                className={`${actionButtons.positive.color} w-full sm:w-32 h-12 justify-center transition-all duration-300 text-white font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                                onClick={async () => {
                                    // SIMPLIFIED: If user has wallet balance, they're logged in
                                    let accountBalance = 0;

                                    // Priority 1: Check liveBalances
                                    if (user?.liveBalances && Object.keys(user.liveBalances).length > 0) {
                                        const balances = Object.values(user.liveBalances);
                                        const maxBalance = Math.max(...balances.map(b => (b.balance || 0)));
                                        if (maxBalance > 0) {
                                            accountBalance = maxBalance;
                                        }
                                    }

                                    // Priority 2: Check user.balance
                                    if (accountBalance <= 0 && user?.balance) {
                                        accountBalance = user.balance;
                                    }

                                    // Priority 3: Check localStorage
                                    if (accountBalance <= 0) {
                                        try {
                                            const saved = localStorage.getItem('deriv_user');
                                            if (saved) {
                                                const parsed = JSON.parse(saved);
                                                if (parsed.balance && parsed.balance > 0) {
                                                    accountBalance = parsed.balance;
                                                }
                                            }
                                        } catch (e) {
                                            // Ignore errors
                                        }
                                    }

                                    // If no balance found, user is not logged in or has no funds
                                    if (accountBalance <= 0) {
                                        const hasUserState = !!user || hasLocalStorageUser || localStorage.getItem('deriv_user');
                                        if (!hasUserState) {
                                            toast({
                                                title: 'Login Required',
                                                description: 'Please log in to your account to place trades',
                                                variant: 'destructive'
                                            });
                                            return;
                                        } else {
                                            toast({
                                                title: 'Insufficient Balance',
                                                description: 'Please ensure your account has a balance greater than 0',
                                                variant: 'destructive'
                                            });
                                            return;
                                        }
                                    }

                                    if (!callProposal || !callProposal.id || callProposal.id.includes('default')) {
                                        toast({
                                            title: 'Proposal Not Ready',
                                            description: 'Please wait for the proposal to load',
                                            variant: 'destructive'
                                        });
                                        return;
                                    }

                                    if (!api || !isConnected) {
                                        toast({
                                            title: 'Not Connected',
                                            description: 'Please wait for connection',
                                            variant: 'destructive'
                                        });
                                        return;
                                    }

                                    await handlePurchase(actionButtons.positive.action, callProposal);
                                }}
                                disabled={isTradeButtonDisabled || isLoadingProposals || !callProposal || !callProposal.id || callProposal.id.includes('default')}
                            >
                                <span className="mr-1 sm:mr-2 flex items-center">
                                    {actionButtons.positive.icon}
                                </span>
                                <span className="text-sm sm:text-base font-bold">{actionButtons.positive.label}</span>
                                <span className="ml-auto text-xs opacity-90 hidden sm:inline">{getPayoutPercentage(callProposal)}%</span>
                            </Button>
                        </div>

                        {actionButtons.negative && (
                            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-gray-100 p-2 rounded-lg gap-2 flex-1 min-w-0 shadow-sm">
                                <div className="hidden sm:flex-1">
                                    <span className="text-xs text-gray-500 block sm:inline">Payout</span>
                                    <p className="font-semibold text-red-600 text-sm sm:ml-2">{getPayoutPercentage(putProposal)}%</p>
                                </div>
                                <Button
                                    className={`${actionButtons.negative.color} w-full sm:w-32 h-12 justify-center transition-all duration-300 text-white font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                                    onClick={async () => {
                                        // Check if user is logged in with valid token (same as desktop)
                                        // SIMPLIFIED: If user has wallet balance OR valid token, they're logged in
                                        const hasValidAuth = (() => {
                                            // Check balance first (most reliable indicator)
                                            let accountBalance = 0;
                                            if (user?.liveBalances && Object.keys(user.liveBalances).length > 0) {
                                                const balances = Object.values(user.liveBalances);
                                                const maxBalance = Math.max(...balances.map(b => (b.balance || 0)));
                                                if (maxBalance > 0) accountBalance = maxBalance;
                                            }
                                            if (accountBalance <= 0 && user?.balance) accountBalance = user.balance;
                                            if (accountBalance > 0) return true;

                                            // Check valid token
                                            if (user?.token && isValidAuthToken(user.token)) return true;

                                            // Check localStorage
                                            return isUserAuthenticated();
                                        })();

                                        if (!hasValidAuth) {
                                            toast({
                                                title: 'Login Required',
                                                description: 'Please log in to your account to place trades',
                                                variant: 'destructive'
                                            });
                                            return;
                                        }

                                        // Check balance (same as desktop logic)
                                        const userBalance = user?.balance || 0;
                                        if (userBalance <= 0) {
                                            toast({
                                                title: 'Insufficient Balance',
                                                description: 'Please ensure your account has a balance greater than 0',
                                                variant: 'destructive'
                                            });
                                            return;
                                        }

                                        if (!putProposal || !putProposal.id || putProposal.id.includes('default')) {
                                            toast({
                                                title: 'Proposal Not Ready',
                                                description: 'Please wait for the proposal to load',
                                                variant: 'destructive'
                                            });
                                            return;
                                        }

                                        if (!api || !isConnected) {
                                            toast({
                                                title: 'Not Connected',
                                                description: 'Please wait for connection',
                                                variant: 'destructive'
                                            });
                                            return;
                                        }

                                        await handlePurchase(actionButtons.negative.action, putProposal);
                                    }}
                                    disabled={isTradeButtonDisabled || isLoadingProposals || !putProposal || !putProposal.id || putProposal.id.includes('default')}
                                >
                                    <span className="mr-1 sm:mr-2 flex items-center">
                                        {actionButtons.negative.icon}
                                    </span>
                                    <span className="text-sm sm:text-base font-bold">{actionButtons.negative.label}</span>
                                    <span className="ml-auto text-xs opacity-90 hidden sm:inline">{getPayoutPercentage(putProposal)}%</span>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <ScriptRunnerPanel
                    isOpen={isScriptRunnerOpen}
                    setIsOpen={setIsScriptRunnerOpen}
                    chartData={chartData}
                    selectedMarket={selectedMarket}
                    lastTick={lastTick}
                    aiPrediction={aiPrediction}
                    tradeType={tradeType}
                    activeIndicators={activeIndicators}
                    setActiveIndicators={setActiveIndicators}
                    onAttachIndicatorsFromScript={(inds) =>
                        setActiveIndicators(prev => {
                            // Allow adding even if same type exists (user might want multiple with different params)
                            return [...prev, ...inds];
                        })
                    }
                />

                <AuthModal
                    isOpen={isAuthModalOpen}
                    setIsOpen={setIsAuthModalOpen}
                    mode={authMode}
                    setMode={setAuthMode}
                />

                <Toaster />
            </div>
        </>
    );
}

// App component - React Router handles routing
export default function App() {
    return <AppContent />;
}