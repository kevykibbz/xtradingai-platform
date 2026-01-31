import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  connected: false,
  api: null,
  ws: null,
  isReconnecting: false,
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setConnected: (state, action) => {
      state.connected = action.payload;
    },
    setApi: (state, action) => {
      state.api = action.payload;
    },
    setWebSocket: (state, action) => {
      state.ws = action.payload;
    },
    setIsReconnecting: (state, action) => {
      state.isReconnecting = action.payload;
    },
    resetConnection: (state) => {
      return initialState;
    },
  },
});

export const { setConnected, setApi, setWebSocket, setIsReconnecting, resetConnection } = connectionSlice.actions;
export default connectionSlice.reducer;

