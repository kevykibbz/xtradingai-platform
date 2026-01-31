/**
 * Utility to set Deriv API token in localStorage
 * 
 * SECURITY WARNING: This token provides access to your Deriv account.
 * Never commit tokens to version control or share them publicly.
 * 
 * Usage:
 *   import { setDerivToken } from '@/utils/setDerivToken';
 *   setDerivToken('your-token-here');
 * 
 * Or run in browser console:
 *   localStorage.setItem('deriv_user', JSON.stringify({ token: 'your-token-here' }));
 *   window.location.reload();
 */

export const setDerivToken = (token) => {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }

  // Store token in localStorage
  // The app will authorize with this token and populate loginid/currency automatically
  const userData = {
    token: token,
    // loginid and currency will be populated after authorization
    loginid: null,
    currency: 'USD' // Default, will be updated after auth
  };

  localStorage.setItem('deriv_user', JSON.stringify(userData));
  
  return userData;
};

/**
 * Remove Deriv token from localStorage
 */
export const removeDerivToken = () => {
  localStorage.removeItem('deriv_user');
  localStorage.removeItem('deriv_all_accounts');
};

/**
 * Get current token from localStorage
 */
export const getDerivToken = () => {
  try {
    const stored = localStorage.getItem('deriv_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.token || null;
    }
  } catch (e) {
    console.error('Error reading token:', e);
  }
  return null;
};

