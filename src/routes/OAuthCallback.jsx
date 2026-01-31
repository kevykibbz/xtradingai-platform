import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import dbStorage from '@/utils/indexedDB';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');

        if (errorParam) {
          setError(errorParam);
          setStatus('error');
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 3000);
          return;
        }

        if (!code) {
          setError('No authorization code received');
          setStatus('error');
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 3000);
          return;
        }

        // Exchange code for token
        // Since we don't have a backend API, we'll need to handle this differently
        // For now, we'll try to use the Deriv WebSocket API directly
        // The proper way would be to have a backend endpoint that exchanges the code
        
        // Alternative: Store the code and let Header component handle it
        // But first, let's try to exchange it via a proxy or direct API call
        
        try {
          // Exchange code for token via API endpoint
          const apiUrl = `/api/deriv/token?code=${code}`;
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(errorData.error || `Token exchange failed: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (data.authorize?.token) {
            const userData = {
              token: data.authorize.token,
              loginid: data.authorize.loginid || null, // Will be populated after WebSocket auth
              currency: data.authorize.currency || 'USD',
            };

            // Save to IndexedDB
            await dbStorage.init();
            await dbStorage.setUser(userData);

            // Also save to localStorage as backup
            localStorage.setItem('deriv_user', JSON.stringify(userData));

            setStatus('success');
            
            // Redirect to home after a brief delay
            setTimeout(() => {
              navigate('/', { replace: true });
            }, 1000);
          } else {
            throw new Error('No token received from server');
          }
        } catch (fetchError) {
          console.error('[OAuthCallback] Token exchange error:', fetchError);
          
          // Fallback: Store code in sessionStorage and let Header handle it
          // This is a workaround if API endpoint fails
          sessionStorage.setItem('oauth_code', code);
          sessionStorage.setItem('oauth_redirect_uri', window.location.origin + '/oauth/callback');
          
          // Redirect to home - Header component will handle the code exchange
          setStatus('redirecting');
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 500);
        }
      } catch (err) {
        console.error('[OAuthCallback] Error:', err);
        setError(err.message || 'An error occurred during authentication');
        setStatus('error');
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 3000);
      }
    };

    handleOAuthCallback();
  }, [searchParams, router]);

  if (status === 'processing' || status === 'redirecting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">
            {status === 'processing' ? 'Processing authentication...' : 'Redirecting...'}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-red-600 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
          <p className="text-gray-600 mb-6">{error || 'An error occurred during authentication'}</p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="text-center">
        <div className="text-green-600 mb-4">
          <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-gray-600">Authentication successful! Redirecting...</p>
      </div>
    </div>
  );
}

