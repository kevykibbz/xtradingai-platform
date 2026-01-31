
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Default demo token - not valid for real trading
const DEFAULT_DEMO_TOKEN = 'Pf8yDrMlqphN6ei';

// Demo account token (VRTC)
export const DEMO_ACCOUNT_TOKEN = 'R2Si4kFJb57ae1A';

// Real account tokens for different currencies
export const REAL_ACCOUNT_TOKENS = {
  USD: '4MM7TFExvt5JZfU',  // xtradingai real usd
  BTC: 'DDXWBuDPNfYrFMD',  // xtradingaireal bitcoin
  USDT: 'Z6Ek6NSFiZZNIm1', // xtradingaireal Tether ERC20
  LTC: 'ndJUfIk00MoJAkv',  // xtradingaireal Litecoin
};

// Default API token (USD) - for backward compatibility
export const API_TOKEN = REAL_ACCOUNT_TOKENS.USD;

// Legacy exports for backward compatibility
export const REAL_ACCOUNT_TOKEN = REAL_ACCOUNT_TOKENS.USD;

/**
 * Validates if a token is a real authenticated token (not the default demo token)
 * @param {string} token - The token to validate
 * @returns {boolean} - True if token is valid and not the default demo token
 */
export function isValidAuthToken(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Check if it's the default demo token
  if (token.trim() === DEFAULT_DEMO_TOKEN) {
    return false;
  }
  
  // Check if token is too short (likely invalid)
  if (token.trim().length <= 10) {
    return false;
  }
  
  // Check for other invalid tokens
  if (token.trim() === 'default' || token.trim() === '') {
    return false;
  }
  
  return true;
}

/**
 * Checks if user is logged in with a valid authenticated token
 * @returns {boolean} - True if user has a valid authenticated token
 */
export function isUserAuthenticated() {
  try {
    const stored = localStorage.getItem('deriv_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      return isValidAuthToken(parsed?.token);
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Gets the authenticated token from localStorage if valid
 * @returns {string|null} - Valid token or null
 */
export function getAuthToken() {
  try {
    const stored = localStorage.getItem('deriv_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (isValidAuthToken(parsed?.token)) {
        return parsed.token;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Gets the appropriate trading token based on account type and currency
 * @param {boolean} isVirtual - Whether the account is a virtual/demo account
 * @param {string} currency - The account currency (USD, BTC, USDT, LTC, etc.)
 * @returns {string} - Returns the appropriate token for the account type and currency
 */
export function getTradingToken(isVirtual, currency = 'USD') {
  // Use demo token for virtual accounts
  if (isVirtual) {
    return DEMO_ACCOUNT_TOKEN;
  }
  
  // Use currency-specific token for real accounts
  const currencyUpper = currency?.toUpperCase() || 'USD';
  return REAL_ACCOUNT_TOKENS[currencyUpper] || REAL_ACCOUNT_TOKENS.USD;
}

/**
 * Checks if a token is an API token (not a user OAuth token)
 * @param {string} token - The token to check
 * @returns {boolean} - True if token is an API token
 */
export function isAPIToken(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }
  const tokenTrimmed = token.trim();
  
  // Check if it matches the demo token
  if (tokenTrimmed === DEMO_ACCOUNT_TOKEN) {
    return true;
  }
  
  // Check if it matches any real account token
  const allTokens = Object.values(REAL_ACCOUNT_TOKENS);
  return allTokens.includes(tokenTrimmed);
}

/**
 * Gets the user's OAuth token from localStorage if available
 * @returns {string|null} - User's OAuth token or null
 */
export function getUserOAuthToken() {
  try {
    const stored = localStorage.getItem('deriv_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      const token = parsed?.token;
      // Return token only if it's NOT an API token (i.e., it's a user OAuth token)
      if (token && typeof token === 'string' && !isAPIToken(token)) {
        return token;
      }
    }
  } catch {
    return null;
  }
  return null;
}
