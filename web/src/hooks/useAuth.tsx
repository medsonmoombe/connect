'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import { User, UserRole } from '@/types';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      
      if (fbUser) {
        // Fetch user data from Supabase
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', fbUser.uid)
          .single();
        
        if (userData) {
          setUser(userData as User);
        }
      } else {
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, fullName: string, role: UserRole) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    if (result.user) {
      await updateProfile(result.user, { displayName: fullName });
      
      // Create user record in Supabase
      await supabase.from('users').insert({
        id: result.user.uid,
        email,
        role,
        verification_status: 'PENDING',
        created_at: new Date().toISOString()
      });
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    
    if (result.user) {
      // Check if user exists in Supabase
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', result.user.uid)
        .single();
      
      if (!existingUser) {
        // Create user record in Supabase
        await supabase.from('users').insert({
          id: result.user.uid,
          email: result.user.email,
          role: 'DEVELOPER', // Default role for Google sign-in
          verification_status: 'PENDING',
          created_at: new Date().toISOString()
        });
      }
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      firebaseUser, 
      user, 
      loading, 
      signIn, 
      signUp, 
      signInWithGoogle, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
