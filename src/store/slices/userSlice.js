import { createSlice } from '@reduxjs/toolkit';
import { isAPIToken } from '@/lib/utils';
import { isValidAuthToken } from '@/lib/utils';

const initialState = {
  token: null,
  loginid: null,
  currency: 'USD',
  balance: 0,
  accounts: [],
  liveBalances: {},
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action) => {
      const userData = action.payload;
      
      // CRITICAL: Always preserve token - priority: userData.token > state.token > localStorage
      let tokenToUse = userData?.token;
      if (!tokenToUse) {
        tokenToUse = state.token;
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
      
      return {
        ...state,
        ...userData,
        token: tokenToUse || state.token || null,
        liveBalances: {
          ...state.liveBalances,
          ...(userData?.liveBalances || {})
        }
      };
    },
    updateUser: (state, action) => {
      const userData = action.payload;
      
      // CRITICAL: Always preserve token
      let tokenToUse = userData?.token;
      if (!tokenToUse) {
        tokenToUse = state.token;
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
        ...state,
        ...userData,
        token: tokenToUse || state.token || null,
        liveBalances: {
          ...state.liveBalances,
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
    },
    setToken: (state, action) => {
      state.token = action.payload;
      // Save to localStorage
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
          token: action.payload
        }));
      } catch (e) {
        // Ignore localStorage errors
      }
    },
    setAccounts: (state, action) => {
      state.accounts = action.payload;
    },
    updateBalance: (state, action) => {
      const { loginid, balance, currency } = action.payload;
      if (loginid) {
        state.liveBalances[loginid] = {
          balance,
          currency: currency || state.currency || 'USD'
        };
        // Update main balance if it's the current account
        if (loginid === state.loginid) {
          state.balance = balance;
        }
      }
    },
    deductBalance: (state, action) => {
      const { amount, loginid } = action.payload;
      const targetLoginid = loginid || state.loginid;
      
      // CRITICAL: Only deduct balance from user's own accounts, never from API owner accounts
      // Check if the target loginid belongs to one of the user's accounts
      const isUserAccount = state.accounts && state.accounts.some(acc => acc.loginid === targetLoginid);
      
      if (!isUserAccount && targetLoginid) {
        console.error('[Redux] CRITICAL: Attempted to deduct balance from non-user account! Blocking deduction.', {
          targetLoginid,
          userAccounts: state.accounts?.map(acc => acc.loginid) || []
        });
        return; // Don't deduct - this might be an API owner account
      }
      
      if (targetLoginid && state.liveBalances[targetLoginid]) {
        const currentBalance = state.liveBalances[targetLoginid].balance || 0;
        const newBalance = Math.max(0, currentBalance - amount);
        state.liveBalances[targetLoginid].balance = newBalance;
        // Update main balance if it's the current account
        if (targetLoginid === state.loginid) {
          state.balance = newBalance;
        }
      }
    },
    switchAccount: (state, action) => {
      const { loginid, balance, currency, token, accounts } = action.payload;
      // CRITICAL: Update loginid immediately so trades use the selected wallet
      state.loginid = loginid;
      state.currency = currency || state.currency || 'USD';
      if (balance !== undefined && balance !== null) {
        state.balance = parseFloat(balance) || 0;
        // Update liveBalances for this account
        if (loginid) {
          state.liveBalances[loginid] = {
            balance: parseFloat(balance) || 0,
            currency: currency || state.currency || 'USD'
          };
        }
      }
      // CRITICAL: Preserve accounts array when switching - don't clear it
      if (accounts && Array.isArray(accounts) && accounts.length > 0) {
        state.accounts = accounts;
      }
      if (token) {
        state.token = token;
        // Save to localStorage
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
            token: token,
            loginid: loginid,
            currency: currency || state.currency || 'USD'
          }));
        } catch (e) {
          // Ignore localStorage errors
        }
      }
    },
    clearUser: (state) => {
      return initialState;
    },
  },
});

export const { setUser, updateUser, setToken, setAccounts, updateBalance, deductBalance, switchAccount, clearUser } = userSlice.actions;
export default userSlice.reducer;

