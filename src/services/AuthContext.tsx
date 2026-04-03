import React, { createContext, useContext, useEffect, useState } from 'react';
import AuthAdapter from '../services/AuthAdapter';
import supabaseClient from '../services/supabaseClient';

interface AuthUser {
  id: string | null;
  email: string | null;
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, setUser: () => {}, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(AuthAdapter.getUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to Auth changes (Supabase only)
    let unsub: (() => void) | undefined;
    setLoading(true);
    if (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled()) {
      unsub = supabaseClient.onAuthChanged(async (supabaseUser: any) => {
        if (supabaseUser) {
          // Verify the user still exists server-side (catches deleted accounts whose
          // JWT hasn't expired yet but no longer exist in Supabase Auth).
          try {
            const serverCheck = await supabaseClient.getServerUser();
            if (!serverCheck) {
              // User was deleted — clear local session and sign out
              await supabaseClient.firebaseSignOut();
              setUser(null);
              setLoading(false);
              return;
            }
          } catch (_) {
            // If the network call fails, fall through and use cached data
          }
          const cached = (AuthAdapter.getUser() || {})
          const mergedBase = { id: supabaseUser.id || supabaseUser.uid, email: supabaseUser.email, ...cached };
          try {
            const claims = await supabaseClient.getCurrentUserClaims(true)
            const withRole = { ...mergedBase, role: (claims && claims.role) ? claims.role : mergedBase.role }
            console.log('AuthContext: supabaseUser', supabaseUser && supabaseUser.id, 'mergedBase', mergedBase, 'claims', claims, 'withRole', withRole)
            setUser(withRole)
          } catch (e) {
            console.error('AuthContext: error fetching claims', e)
            setUser(mergedBase)
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
    // Listen to custom auth:changed events (for legacy/role changes)
    const handler = (e: any) => {
      setUser(e.detail.user || null);
    };
    window.addEventListener('auth:changed', handler);
    return () => {
      if (unsub) unsub();
      window.removeEventListener('auth:changed', handler);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
