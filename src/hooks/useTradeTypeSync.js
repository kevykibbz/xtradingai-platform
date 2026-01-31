import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setTradeType as setTradeTypeRedux } from '@/store/slices/tradeTypeSlice';

/**
 * Hook to sync trade type with Redux and trigger proposal fetching
 * Use this in all TradeExecution components to ensure proposals are fetched
 * when trade type changes from mobile carousel or other sources
 */
export const useTradeTypeSync = (tradeType, onTradeTypeChange) => {
  const reduxTradeType = useAppSelector(state => state.tradeType.currentTradeType);
  const dispatch = useAppDispatch();
  
  // Update Redux when trade type changes
  useEffect(() => {
    if (tradeType && tradeType !== reduxTradeType) {
      dispatch(setTradeTypeRedux(tradeType));
    }
  }, [tradeType, reduxTradeType, dispatch]);
  
  // Trigger proposal fetching when Redux trade type changes
  useEffect(() => {
    if (reduxTradeType && reduxTradeType !== tradeType && onTradeTypeChange) {
      onTradeTypeChange(reduxTradeType);
    }
  }, [reduxTradeType, tradeType, onTradeTypeChange]);
  
  return reduxTradeType;
};

