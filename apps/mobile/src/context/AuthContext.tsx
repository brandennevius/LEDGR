import * as Linking from 'expo-linking';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

WebBrowser.maybeCompleteAuthSession();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (isMounted) {
          setSession(data.session ?? null);
          setInitializing(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setInitializing(false);
        }
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  }, []);

  const signInWithOAuth = useCallback(async (provider: 'google' | 'apple') => {
    if (Constants.appOwnership === 'expo') {
      return 'Google/Apple OAuth requires a development build. Run `npm run run:ios` (or `run:android`) and then `npm run dev-client`.';
    }

    const fallbackRedirect = AuthSession.makeRedirectUri({
      path: 'auth/callback',
      scheme: 'financialcoaching',
      native: 'financialcoaching://auth/callback',
    });
    const redirectTo =
      process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL ?? fallbackRedirect;

    console.log('[auth] starting oauth', {
      provider,
      appOwnership: Constants.appOwnership,
      redirectTo,
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      console.log('[auth] signInWithOAuth error', error);
      return error.message;
    }

    if (!data?.url) {
      console.log('[auth] missing oauth url from supabase response');
      return 'Unable to start OAuth flow.';
    }

    console.log('[auth] oauth url', data.url);

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    console.log('[auth] openAuthSession result', result);

    if (result.type !== 'success' || !result.url) {
      return 'OAuth cancelled.';
    }

    const parsed = Linking.parse(result.url);
    const params = parsed.queryParams;
    console.log('[auth] callback url parsed', {
      callbackUrl: result.url,
      path: parsed.path,
      queryParams: params,
    });

    const code = typeof params?.code === 'string' ? params.code : null;
    const errorDescription =
      typeof params?.error_description === 'string'
        ? params.error_description
        : null;
    const errorCode = typeof params?.error === 'string' ? params.error : null;

    if (!code) {
      return (
        'Missing OAuth response code.' +
        (errorCode ? ` error=${errorCode}` : '') +
        (errorDescription ? ` description=${errorDescription}` : '')
      );
    }

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.log('[auth] exchangeCodeForSession error', exchangeError);
    } else {
      console.log('[auth] exchangeCodeForSession success');
    }
    return exchangeError?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      signInWithPassword,
      signUp,
      signInWithOAuth,
      signOut,
    }),
    [
      session,
      initializing,
      signInWithPassword,
      signUp,
      signInWithOAuth,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
