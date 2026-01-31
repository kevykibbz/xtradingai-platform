/**
 * Environment configuration for local testing vs production
 * Handles WebSocket endpoint and OAuth redirect URLs
 */

// Determine if we're running locally or in production
const getEnvironment = () => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
  const isProduction = hostname === 'app.xtradingai.com';
  
  return {
    isLocalhost,
    isProduction,
    hostname,
    port: window.location.port,
    protocol: window.location.protocol,
  };
};

// Get the appropriate WebSocket endpoint based on environment
let _cachedEndpoint = null;
const getWebSocketEndpoint = () => {
  if (_cachedEndpoint) return _cachedEndpoint;
  
  const appId = getAppId();
  _cachedEndpoint = `wss://ws.derivws.com/websockets/v3?app_id=${appId}`;
  return _cachedEndpoint;
};

// Get the appropriate OAuth redirect URL based on environment
const getOAuthRedirectUrl = () => {
  const env = getEnvironment();
  
  if (env.isLocalhost) {
    // For local testing
    const port = env.port || '3001';
    const redirectUrl = `http://localhost:${port}/`;
    console.log(`[Config] OAuth redirect URL (local): ${redirectUrl}`);
    return redirectUrl;
  } else if (env.isProduction) {
    // For production
    const redirectUrl = `https://app.xtradingai.com/`;
    console.log(`[Config] OAuth redirect URL (production): ${redirectUrl}`);
    return redirectUrl;
  } else {
    // For other environments, construct from current URL
    const redirectUrl = `${env.protocol}//${env.hostname}${env.port ? ':' + env.port : ''}/`;
    console.log(`[Config] OAuth redirect URL (auto): ${redirectUrl}`);
    return redirectUrl;
  }
};

// Get the APP_ID from environment variable (or fallback to default)
let _cachedAppId = null;
const getAppId = () => {
  if (_cachedAppId) return _cachedAppId;
  
  // Read from environment variable (Vite uses VITE_ prefix)
  _cachedAppId = import.meta.env.VITE_APP_ID || '106085';
  return _cachedAppId;
};

// Get the API base URL (useful for other API calls if needed)
const getApiBaseUrl = () => {
  const env = getEnvironment();
  
  if (env.isLocalhost) {
    // For local testing with a local API proxy (if you set one up)
    return `http://localhost:${env.port || '3001'}`;
  } else if (env.isProduction) {
    // For production
    return 'https://app.xtradingai.com';
  } else {
    // For other environments
    return `${env.protocol}//${env.hostname}${env.port ? ':' + env.port : ''}`;
  }
};

// Log configuration on load
const logConfig = () => {
  const env = getEnvironment();
  console.log('[Config] Environment Configuration:', {
    hostname: env.hostname,
    isLocalhost: env.isLocalhost,
    isProduction: env.isProduction,
    protocol: env.protocol,
    port: env.port,
    websocketEndpoint: getWebSocketEndpoint(),
    oauthRedirectUrl: getOAuthRedirectUrl(),
    appId: getAppId(),
    apiBaseUrl: getApiBaseUrl(),
  });
};

export {
  getEnvironment,
  getWebSocketEndpoint,
  getOAuthRedirectUrl,
  getAppId,
  getApiBaseUrl,
  logConfig,
};
