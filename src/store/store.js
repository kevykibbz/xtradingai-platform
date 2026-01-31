import { configureStore } from '@reduxjs/toolkit';
import userSlice from './slices/userSlice';
import connectionSlice from './slices/connectionSlice';
import symbolsSlice from './slices/symbolsSlice';
import balancesSlice from './slices/balancesSlice';
import tradeTypeSlice from './slices/tradeTypeSlice';

export const store = configureStore({
  reducer: {
    user: userSlice,
    connection: connectionSlice,
    symbols: symbolsSlice,
    balances: balancesSlice,
    tradeType: tradeTypeSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['connection/setApi', 'connection/setWebSocket'],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['payload.ws', 'payload.api'],
        // Ignore these paths in the state
        ignoredPaths: ['connection.ws', 'connection.api'],
      },
    }),
});

