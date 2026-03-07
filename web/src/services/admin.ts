import { supabase } from '@/lib/supabase';
import { createAdminAuth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { deleteApp } from 'firebase/app';
import { UserRole, ApiResponse } from '@/types';

/**
 * Admin service for managing users and platform settings
 */
export const adminApi = {
  /**
   * Provisions a new user by:
   * 1. Creating an account in a secondary Firebase instance (to avoid logging out the admin)
   * 2. Creating a corresponding profile in Supabase
   */
  async provisionUser(email: string, role: UserRole, password?: string): Promise<ApiResponse<any>> {
    const { adminAuth, adminApp } = await createAdminAuth();
    
    try {
      // 1. Create the user in Firebase Auth
      const actualPassword = password || (Math.random().toString(36).slice(-12) + "A1!");
      
      const userCredential = await createUserWithEmailAndPassword(adminAuth, email, actualPassword);
      const fbUser = userCredential.user;

      if (!fbUser) {
        return { error: 'Failed to create Firebase user.' };
      }

      // 2. Create/Update the user profile in the public.users table
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .upsert({
          id: fbUser.uid, // Map Firebase UID to Supabase ID
          email: email,
          role: role,
          verification_status: 'VERIFIED',
        })
        .select()
        .single();

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        return {
          data: fbUser,
          message: `Auth account created but profile setup failed: ${profileError.message}`
        };
      }

      return {
        data: profile,
        message: `User created successfully. ${password ? '' : `Generated password: ${actualPassword}`}`
      };
    } catch (error: any) {
      return { error: error.message || 'An unexpected error occurred during provisioning.' };
    } finally {
      // Clean up the secondary app instance
      await deleteApp(adminApp);
    }
  }
};
