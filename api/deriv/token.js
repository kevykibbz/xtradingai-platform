// Vercel serverless function to exchange OAuth code for token
// This endpoint exchanges the OAuth authorization code for an access token

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    // Exchange code for token using Deriv OAuth API
    // Note: This requires the app_id and redirect_uri to match the OAuth request
    const APP_ID = '106085';
    const REDIRECT_URI = `${req.headers.origin || req.headers.referer || ''}/oauth/callback`;
    
    // Deriv OAuth token endpoint
    const tokenResponse = await fetch('https://oauth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: APP_ID,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Token Exchange] Error:', errorText);
      return res.status(tokenResponse.status).json({ 
        error: 'Failed to exchange code for token',
        details: errorText 
      });
    }

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      return res.status(400).json({ error: 'No access token received' });
    }

    // Now authorize with the token to get user info
    // We need to use WebSocket API to authorize, but we can't do that in a serverless function
    // Instead, we'll return the token and let the client authorize via WebSocket
    
    // For now, return the token - the client will authorize via WebSocket
    return res.status(200).json({
      authorize: {
        token: tokenData.access_token,
        // Note: loginid and currency will be populated after WebSocket authorization
        loginid: null,
        currency: 'USD'
      }
    });
  } catch (error) {
    console.error('[Token Exchange] Exception:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

