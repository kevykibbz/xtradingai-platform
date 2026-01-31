import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const AuthModal = ({ isOpen, setIsOpen, mode, setMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const APP_ID = '106085';
  const REDIRECT_URI = `${window.location.origin}/oauth/callback`;
  const SIGNUP_URL = 'https://deriv.com/signup/';

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setEmail('');
      setPassword('');
      setIsLoading(false);
    }, 300);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
      window.location.href = oauthUrl;
    } catch (error) {
      toast({ title: 'Login Failed', description: 'Failed to initiate login.', variant: 'destructive' });
      setIsLoading(false);
    }
  };

  const handleSignup = (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      window.location.href = SIGNUP_URL;
    } catch (error) {
      toast({ title: 'Signup Failed', description: 'Failed to redirect to signup page.', variant: 'destructive' });
      setIsLoading(false);
    }
  };

  const renderLoginForm = () => (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Log In
      </Button>
    </form>
  );

  const renderSignupForm = () => (
    <form onSubmit={handleSignup} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign Up
      </Button>
    </form>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'signup' ? 'Sign Up' : 'Log In'}</DialogTitle>
          <DialogDescription>
            {mode === 'signup'
              ? 'Create a Deriv account to start trading.'
              : 'Log in with your Deriv account credentials.'}
          </DialogDescription>
        </DialogHeader>
        {mode === 'signup' ? renderSignupForm() : renderLoginForm()}
        <div className="mt-4 text-center text-sm">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <Button variant="link" className="p-0 h-auto" onClick={() => setMode('login')}>
                Log in
              </Button>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <Button variant="link" className="p-0 h-auto" onClick={() => setMode('signup')}>
                Sign up
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;