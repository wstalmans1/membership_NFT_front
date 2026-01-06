import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.\n' +
    'Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

// Create Supabase client for database operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Storage bucket name (update this if you used a different name)
export const STORAGE_BUCKET = 'member_photos';

// Database table name (update this to match your Supabase table name)
export const METADATA_TABLE = 'member_metadata';

