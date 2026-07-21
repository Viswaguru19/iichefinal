import { createClient } from '@/lib/supabase/client';
import { DEFAULT_PORTAL_LOGO } from '@/lib/logo-utils';
import { resolveActiveLogoUrl } from '@/lib/logo-resolve';

export async function getCurrentLogoClient(): Promise<string> {
  try {
    const supabase = createClient();
    return await resolveActiveLogoUrl(supabase);
  } catch (error) {
    console.error('Error fetching logo:', error);
    return DEFAULT_PORTAL_LOGO;
  }
}
