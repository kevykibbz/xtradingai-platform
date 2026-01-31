import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  balances: {},
  lastUpdate: null,
};

const balancesSlice = createSlice({
  name: 'balances',
  initialState,
  reducers: {
    setBalance: (state, action) => {
      const { loginid, balance, currency } = action.payload;
      state.balances[loginid] = {
        balance,
        currency: currency || 'USD',
        lastUpdate: Date.now()
      };
      state.lastUpdate = Date.now();
    },
    updateBalances: (state, action) => {
      state.balances = {
        ...state.balances,
        ...action.payload
      };
      state.lastUpdate = Date.now();
    },
    clearBalances: (state) => {
      state.balances = {};
      state.lastUpdate = null;
    },
  },
});

export const { setBalance, updateBalances, clearBalances } = balancesSlice.actions;
export default balancesSlice.reducer;

