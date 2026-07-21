import { createClient } from '@/lib/supabase/server';
import { DEFAULT_PORTAL_LOGO } from '@/lib/logo-utils';
import { resolveActiveLogoUrl } from '@/lib/logo-resolve';

export async function getCurrentLogo(): Promise<string> {
  try {
    const supabase = await createClient();
    return await resolveActiveLogoUrl(supabase);
  } catch (error) {
    console.error('Error fetching logo:', error);
    return DEFAULT_PORTAL_LOGO;
  }
}
