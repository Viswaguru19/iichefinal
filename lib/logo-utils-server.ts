import { createClient } from '@/lib/supabase/server';
import { DEFAULT_PORTAL_LOGO, resolveLogoPublicUrl } from '@/lib/logo-utils';

export async function getCurrentLogo(): Promise<string> {
  try {
    const supabase = await createClient();

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
