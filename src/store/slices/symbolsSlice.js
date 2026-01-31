import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeSymbols: [],
  tickData: {},
  marketHistory: {},
};

const symbolsSlice = createSlice({
  name: 'symbols',
  initialState,
  reducers: {
    setActiveSymbols: (state, action) => {
      state.activeSymbols = action.payload;
    },
    setTickData: (state, action) => {
      const { symbol, data } = action.payload;
      state.tickData[symbol] = data;
    },
    updateTickData: (state, action) => {
      state.tickData = {
        ...state.tickData,
        ...action.payload
      };
    },
    setMarketHistory: (state, action) => {
      const { symbol, history } = action.payload;
      state.marketHistory[symbol] = history;
    },
    clearTickData: (state) => {
      state.tickData = {};
    },
  },
});

export const { setActiveSymbols, setTickData, updateTickData, setMarketHistory, clearTickData } = symbolsSlice.actions;
export default symbolsSlice.reducer;

