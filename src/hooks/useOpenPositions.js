import { useState, useEffect, useRef, useCallback } from 'react';
import { useDerivAPI } from '@/contexts/DerivContext';

/**
 * Hook to manage open positions and subscribe to real-time updates via proposal_open_contract
 */
export const useOpenPositions = () => {
  const { api, connected: isConnected, user } = useDerivAPI();
  const [openPositions, setOpenPositions] = useState([]);
  const subscriptionsRef = useRef(new Map()); // contract_id -> subscription handler
  const nonSellableContractsRef = useRef(new Set()); // Track contracts that don't support resale

  /**
   * Update position from proposal_open_contract response
   */
  const updatePositionFromResponse = useCallback((contractData) => {
    if (!contractData.contract_id) return;

    setOpenPositions(prev => prev.map(pos => {
      if (pos.contract_id === contractData.contract_id) {
        return {
          ...pos,
          profit: contractData.profit || 0,
          sell_price: contractData.sell_price || contractData.buy_price || 0,
          current_spot: contractData.current_spot || contractData.spot || 0,
              status: contractData.status || 'open',
              is_sold: contractData.is_sold || false,
              is_sellable: pos.is_sellable !== false && !nonSellableContractsRef.current.has(contractData.contract_id),
              // Update other fields as needed
        };
      }
      return pos;
    }));
  }, []);

  /**
   * Remove a position (when sold or expired)
   */
  const removePosition = useCallback((contractId) => {
    // Clear polling interval
    if (subscriptionsRef.current.has(contractId)) {
      const subscription = subscriptionsRef.current.get(contractId);
      if (subscription.interval) {
        clearInterval(subscription.interval);
      }
      subscriptionsRef.current.delete(contractId);
    }

    // Remove from state
    setOpenPositions(prev => prev.filter(p => p.contract_id !== contractId));
  }, []);

  /**
   * Subscribe to proposal_open_contract for a specific contract
   * Uses polling for updates (simpler than WebSocket subscriptions)
   */
  const subscribeToPosition = useCallback((contractId) => {
    if (!api || !isConnected || subscriptionsRef.current.has(contractId)) {
      return;
    }


    // Poll for updates every 2 seconds
    const pollInterval = setInterval(async () => {
      try {
        const response = await api.send({
          proposal_open_contract: 1,
          contract_id: contractId,
        });

        if (response.error) {
          console.error('Error fetching contract:', response.error);
          // If contract not found or expired, stop polling but keep position visible
          // User will manually close it when they want to remove it
          if (response.error.code === 'ContractNotFound') {
            clearInterval(pollInterval);
            subscriptionsRef.current.delete(contractId);
            // Mark position as not found but keep it visible
            setOpenPositions(prev => prev.map(pos => {
              if (pos.contract_id === contractId) {
                return { ...pos, status: 'not_found', is_sold: true };
              }
              return pos;
            }));
          }
          return;
        }

        if (response.proposal_open_contract) {
          const contract = response.proposal_open_contract;
          updatePositionFromResponse(contract);

          // If contract is sold or expired, stop polling but keep position visible
          // Position will only be removed when user manually closes it via removePosition
          // This ensures positions remain visible for all trade types
          if (contract.is_sold || contract.status === 'sold' || contract.status === 'won' || contract.status === 'lost' || contract.status === 'expired') {
            clearInterval(pollInterval);
            subscriptionsRef.current.delete(contractId);
            // Update position status but keep it visible - user will manually close it
            setOpenPositions(prev => prev.map(pos => {
              if (pos.contract_id === contractId) {
                return {
                  ...pos,
                  status: contract.status || 'sold',
                  is_sold: true,
                  profit: contract.profit || pos.profit || 0,
                  sell_price: contract.sell_price || pos.sell_price || 0,
                };
              }
              return pos;
            }));
          }
        }
      } catch (error) {
        console.error('Error polling contract:', error);
      }
    }, 2000); // Poll every 2 seconds

    subscriptionsRef.current.set(contractId, { interval: pollInterval });
  }, [api, isConnected, updatePositionFromResponse, removePosition]);

  /**
   * Add a new position and subscribe to updates
   */
  const addPosition = useCallback((positionData) => {
    console.log('[OPEN POSITIONS] addPosition called:', {
      contract_id: positionData.contract_id,
      symbol: positionData.symbol,
      contract_type: positionData.contract_type,
      trade_type: positionData.trade_type,
      buy_price: positionData.buy_price,
      fullData: positionData
    });
    
    if (!positionData.contract_id) {
      console.error('[OPEN POSITIONS] Cannot add position: missing contract_id', positionData);
      return;
    }

    const contractId = positionData.contract_id;

    // Add position to state
    setOpenPositions(prev => {
      console.log('[OPEN POSITIONS] Current positions before add:', prev.length);
      
      // Check if position already exists
      if (prev.find(p => p.contract_id === contractId)) {
        console.log('[OPEN POSITIONS] Position already exists, skipping:', contractId);
        return prev;
      }
      
      const newPosition = {
        ...positionData,
        contract_id: contractId,
        start_time: positionData.start_time || Date.now() / 1000,
        profit: positionData.profit || 0,
        sell_price: positionData.sell_price || positionData.buy_price || positionData.stake || 0,
        buy_price: positionData.buy_price || positionData.stake || 0,
        stake: positionData.stake || positionData.buy_price || 0,
        is_sellable: !nonSellableContractsRef.current.has(contractId), // Default to true unless we know it's not sellable
        status: positionData.status || 'open',
        is_sold: positionData.is_sold || false,
      };
      
      console.log('[OPEN POSITIONS] Adding new position:', {
        contract_id: newPosition.contract_id,
        symbol: newPosition.symbol,
        contract_type: newPosition.contract_type,
        status: newPosition.status
      });
      
      const updated = [...prev, newPosition];
      console.log('[OPEN POSITIONS] Total positions after add:', updated.length);
      return updated;
    });

    // Subscribe to real-time updates
    if (api && isConnected) {
      console.log('[OPEN POSITIONS] Subscribing to position updates for:', contractId);
      subscribeToPosition(contractId);
    } else {
      console.warn('[OPEN POSITIONS] Cannot subscribe - API not available or not connected', {
        hasApi: !!api,
        isConnected
      });
    }
  }, [api, isConnected, subscribeToPosition]);

  /**
   * Sell a position (close contract)
   */
  const sellPosition = useCallback(async (contractId, price) => {
    if (!api || !isConnected) {
      throw new Error('Not connected to API');
    }

    try {
      const sellRequest = {
        sell: contractId,
        price: price || 0, // 0 means market price
      };

      const response = await api.send(sellRequest);

      if (response.error) {
        // Preserve error code and message for better error handling
        const error = new Error(response.error.message || 'Sell failed');
        error.code = response.error.code;
        error.apiError = response.error;
        
        // Provide user-friendly message for InvalidOfferings
        if (response.error.code === 'InvalidOfferings' || 
            (response.error.message && response.error.message.includes('Resale of this contract is not offered'))) {
          error.message = 'This contract type cannot be sold before expiry. It will automatically close at expiry.';
          // Mark this contract as non-sellable so we can disable the sell button
          nonSellableContractsRef.current.add(contractId);
          // Update the position to mark it as non-sellable
          setOpenPositions(prev => prev.map(pos => {
            if (pos.contract_id === contractId) {
              return { ...pos, is_sellable: false };
            }
            return pos;
          }));
        }
        
        throw error;
      }

      if (response.sell) {
        // Position will be updated via subscription
        // Don't automatically remove - let user close it manually via onClosePosition
        // The position status will be updated to 'sold' and polling will stop
        return response.sell;
      }

      throw new Error('Invalid sell response');
    } catch (error) {
      // Enhanced error logging for debugging
      console.error('Sell error:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack,
        fullError: error,
        apiError: error.apiError || null,
        contractId: contractId,
        price: price
      });
      throw error;
    }
  }, [api, isConnected, removePosition]);

  /**
   * Cleanup subscriptions on unmount
   */
  useEffect(() => {
    return () => {
      // Clear all polling intervals
      subscriptionsRef.current.forEach((subscription) => {
        if (subscription.interval) {
          clearInterval(subscription.interval);
        }
      });
      subscriptionsRef.current.clear();
    };
  }, []);

  /**
   * Fetch all open positions from Portfolio API
   * According to Deriv API docs: portfolio: 1 retrieves all open contracts
   */
  const fetchPortfolio = useCallback(async () => {
    if (!api || !isConnected) {
      return;
    }

    try {
      const response = await api.send({
        portfolio: 1,
      });

      if (response.error) {
        // Silently handle authorization errors - user might not be logged in yet
        if (response.error.code === 'AuthorizationRequired') {
          return; // Don't log - this is expected before authorization
        }
        console.error('Error fetching portfolio:', response.error);
        return;
      }

      // Portfolio API returns contracts array directly or nested in portfolio object
      const contracts = response.portfolio?.contracts || response.portfolio || [];
      
      if (Array.isArray(contracts) && contracts.length > 0) {

        // Add all positions from portfolio
        contracts.forEach((contract) => {
          if (contract.contract_id) {
            const positionData = {
              contract_id: contract.contract_id,
              buy_price: contract.buy_price || contract.purchase_price || 0,
              payout: contract.payout || 0,
              stake: contract.buy_price || contract.purchase_price || 0,
              contract_type: contract.contract_type || contract.contract_type_display || '',
              trade_type: contract.contract_type || '',
              symbol: contract.symbol || contract.underlying || '',
              display_name: contract.display_name || contract.symbol || '',
              duration: contract.duration || 0,
              duration_unit: contract.duration_unit || 't',
              start_time: contract.date_start || contract.start_time || Date.now() / 1000,
              profit: contract.profit || 0,
              sell_price: contract.sell_price || contract.buy_price || 0,
              current_spot: contract.current_spot || contract.spot || 0,
              status: contract.status || 'open',
              is_sold: contract.is_sold || false,
              is_sellable: !nonSellableContractsRef.current.has(contract.contract_id),
              barrier: contract.barrier || null,
              entry_spot: contract.entry_spot || contract.spot || 0,
              exit_spot: contract.exit_spot || null,
            };

            // Add position if it doesn't exist
            setOpenPositions(prev => {
              if (prev.find(p => p.contract_id === contract.contract_id)) {
                return prev;
              }
              return [...prev, positionData];
            });

            // Subscribe to updates for this position
            subscribeToPosition(contract.contract_id);
          }
        });
      }
    } catch (error) {
      // Silently handle expected errors
      const errorMessage = error?.message || error?.toString() || '';
      const errorCode = error?.code;
      
      if (errorCode === 'AuthorizationRequired' || errorMessage.includes('AuthorizationRequired') || 
          errorMessage.includes('WebSocket not connected')) {
        return; // Don't log expected errors
      }
      
      // Only log unexpected errors
      console.error('Error fetching portfolio:', error);
    }
  }, [api, isConnected, subscribeToPosition]);

  /**
   * Fetch portfolio on mount and when connection is restored
   * Only fetch after user is authorized (user state is set)
   */
  useEffect(() => {
    if (isConnected && api && user) {
      // User is authorized, fetch portfolio
      fetchPortfolio();
    }
  }, [isConnected, api, user, fetchPortfolio]);

  /**
   * Re-subscribe to all positions when connection is restored
   */
  useEffect(() => {
    if (isConnected && api && openPositions.length > 0) {
      openPositions.forEach(pos => {
        if (!subscriptionsRef.current.has(pos.contract_id)) {
          subscribeToPosition(pos.contract_id);
        }
      });
    }
  }, [isConnected, api, openPositions, subscribeToPosition]);

  // Debug: Log when openPositions changes
  useEffect(() => {
    console.log('[OPEN POSITIONS] State updated:', {
      count: openPositions.length,
      positions: openPositions.map(p => ({
        contract_id: p.contract_id,
        symbol: p.symbol,
        status: p.status,
        is_sold: p.is_sold,
        profit: p.profit
      }))
    });
  }, [openPositions]);

  return {
    openPositions,
    addPosition,
    removePosition,
    sellPosition,
    updatePositionFromResponse,
    fetchPortfolio, // Expose for manual refresh
  };
};
