import { createClient } from '@/lib/supabase/client';
import { DEFAULT_PORTAL_LOGO, resolveLogoPublicUrl } from '@/lib/logo-utils';

export async function getCurrentLogoClient(): Promise<string> {
  try {
    const supabase = createClient();

    const { data } = await supabase
      .from('logo_settings')
      .select('logo_url')
      .eq('is_active', true)
      .single();

    if (data?.logo_url) {
      return resolveLogoPublicUrl(data.logo_url, (path) => {
        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
        return urlData.publicUrl;
      });
    }
  } catch (error) {
    console.error('Error fetching logo:', error);
  }

  return DEFAULT_PORTAL_LOGO;
}
