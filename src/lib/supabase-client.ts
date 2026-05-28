import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a Supabase client for use in the browser.
 * This client is intended for use in Client Components.
 */
export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Set' : '✗ Missing');
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
  }

  if (supabaseAnonKey.length < 20) {
    console.error('❌ Supabase anon key appears to be truncated or invalid');
    console.error('Current length:', supabaseAnonKey.length, 'characters');
    console.error('Current value (first 50 chars):', supabaseAnonKey.substring(0, 50) + '...');
    throw new Error('Supabase anon key appears to be truncated. Please verify your .env.local file contains the complete key from Supabase dashboard.');
  }

  try {
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
    throw new Error('Failed to initialize Supabase client. Please check your environment variables.');
  }
};
