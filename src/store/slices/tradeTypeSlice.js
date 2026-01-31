import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  currentTradeType: 'rise_fall',
  lastChanged: null,
};

const tradeTypeSlice = createSlice({
  name: 'tradeType',
  initialState,
  reducers: {
    setTradeType: (state, action) => {
      const newTradeType = action.payload;
      if (state.currentTradeType !== newTradeType) {
        state.currentTradeType = newTradeType;
        state.lastChanged = Date.now();
      }
    },
  },
});

export const { setTradeType } = tradeTypeSlice.actions;
export default tradeTypeSlice.reducer;

