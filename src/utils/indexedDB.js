// IndexedDB utility for persistent storage
// This replaces localStorage to ensure data persists across refreshes

const DB_NAME = 'tradingAppDB';
const DB_VERSION = 1;
const STORE_NAMES = {
  USER: 'user',
  ACCOUNTS: 'accounts',
  SELECTED_ACCOUNT: 'selectedAccount',
  LIVE_BALANCES: 'liveBalances'
};

let dbInstance = null;

// Initialize IndexedDB
const initDB = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[IndexedDB] Failed to open database');
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORE_NAMES.USER)) {
        db.createObjectStore(STORE_NAMES.USER);
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.ACCOUNTS)) {
        db.createObjectStore(STORE_NAMES.ACCOUNTS);
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.SELECTED_ACCOUNT)) {
        db.createObjectStore(STORE_NAMES.SELECTED_ACCOUNT);
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.LIVE_BALANCES)) {
        db.createObjectStore(STORE_NAMES.LIVE_BALANCES);
      }
      
    };
  });
};

// Get database instance
const getDB = async () => {
  if (!dbInstance) {
    await initDB();
  }
  return dbInstance;
};

// Generic get operation
const get = async (storeName, key = 'default') => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
        }
        resolve(result || null);
      };

      request.onerror = () => {
        console.error(`[IndexedDB] Error getting ${storeName}/${key}:`, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error(`[IndexedDB] Failed to get ${storeName}/${key}:`, error);
    // Fallback to localStorage if IndexedDB fails
    try {
      const fallback = localStorage.getItem(`deriv_${storeName}`);
      return fallback ? JSON.parse(fallback) : null;
    } catch (e) {
      return null;
    }
  }
};

// Generic set operation
const set = async (storeName, value, key = 'default') => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value, key);

      request.onsuccess = () => {
        // Also update localStorage as backup
        try {
          localStorage.setItem(`deriv_${storeName}`, JSON.stringify(value));
        } catch (e) {
          console.error(`[IndexedDB] Error saving to localStorage backup:`, e);
        }
        resolve();
      };

      request.onerror = () => {
        console.error(`[IndexedDB] Error setting ${storeName}/${key}:`, request.error);
        // Fallback to localStorage
        try {
          localStorage.setItem(`deriv_${storeName}`, JSON.stringify(value));
        } catch (e) {
          reject(request.error);
          return;
        }
        resolve();
      };
    });
  } catch (error) {
    console.error(`[IndexedDB] Failed to set ${storeName}/${key}:`, error);
    // Fallback to localStorage
    try {
      localStorage.setItem(`deriv_${storeName}`, JSON.stringify(value));
    } catch (e) {
      throw error;
    }
  }
};

// Generic remove operation
const remove = async (storeName, key = 'default') => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        // Also remove from localStorage
        try {
          localStorage.removeItem(`deriv_${storeName}`);
        } catch (e) {
          // Ignore localStorage errors
        }
        resolve();
      };

      request.onerror = () => {
        console.error(`[IndexedDB] Error removing ${storeName}/${key}:`, request.error);
        // Fallback to localStorage
        try {
          localStorage.removeItem(`deriv_${storeName}`);
        } catch (e) {
          reject(request.error);
          return;
        }
        resolve();
      };
    });
  } catch (error) {
    console.error(`[IndexedDB] Failed to remove ${storeName}/${key}:`, error);
    // Fallback to localStorage
    try {
      localStorage.removeItem(`deriv_${storeName}`);
    } catch (e) {
      throw error;
    }
  }
};

// Clear all data (only on explicit logout)
const clearAll = async () => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(Object.values(STORE_NAMES), 'readwrite');
      let completed = 0;
      const total = Object.values(STORE_NAMES).length;

      Object.values(STORE_NAMES).forEach(storeName => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            // Also clear localStorage
            try {
              Object.values(STORE_NAMES).forEach(name => {
                localStorage.removeItem(`deriv_${name}`);
              });
              localStorage.removeItem('deriv_user');
              localStorage.removeItem('deriv_all_accounts');
            } catch (e) {
              // Ignore localStorage errors
            }
            resolve();
          }
        };

        request.onerror = () => {
          console.error(`[IndexedDB] Error clearing ${storeName}:`, request.error);
          completed++;
          if (completed === total) {
            // Still clear localStorage
            try {
              Object.values(STORE_NAMES).forEach(name => {
                localStorage.removeItem(`deriv_${name}`);
              });
              localStorage.removeItem('deriv_user');
              localStorage.removeItem('deriv_all_accounts');
            } catch (e) {
              // Ignore localStorage errors
            }
            resolve();
          }
        };
      });
    });
  } catch (error) {
    console.error('[IndexedDB] Failed to clear all:', error);
    // Fallback to localStorage
    try {
      Object.values(STORE_NAMES).forEach(name => {
        localStorage.removeItem(`deriv_${name}`);
      });
      localStorage.removeItem('deriv_user');
      localStorage.removeItem('deriv_all_accounts');
    } catch (e) {
      throw error;
    }
  }
};

// Specific helper functions for user data
export const dbStorage = {
  // User data
  getUser: () => get(STORE_NAMES.USER),
  setUser: (user) => set(STORE_NAMES.USER, user),
  removeUser: () => remove(STORE_NAMES.USER),

  // Accounts
  getAccounts: () => get(STORE_NAMES.ACCOUNTS),
  setAccounts: (accounts) => set(STORE_NAMES.ACCOUNTS, accounts),
  removeAccounts: () => remove(STORE_NAMES.ACCOUNTS),

  // Selected account
  getSelectedAccount: () => get(STORE_NAMES.SELECTED_ACCOUNT),
  setSelectedAccount: (account) => set(STORE_NAMES.SELECTED_ACCOUNT, account),
  removeSelectedAccount: () => remove(STORE_NAMES.SELECTED_ACCOUNT),

  // Live balances
  getLiveBalances: () => get(STORE_NAMES.LIVE_BALANCES),
  setLiveBalances: (balances) => set(STORE_NAMES.LIVE_BALANCES, balances),
  removeLiveBalances: () => remove(STORE_NAMES.LIVE_BALANCES),

  // Clear all (logout)
  clearAll: clearAll,

  // Initialize
  init: initDB
};

export default dbStorage;

