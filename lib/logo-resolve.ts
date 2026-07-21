import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_PORTAL_LOGO,
  resolveLogoPublicUrl,
  type ActiveLogoRecord,
} from '@/lib/logo-utils';

async function fetchActiveLogoRecord(
  supabase: SupabaseClient,
): Promise<ActiveLogoRecord | null> {
  const { data, error } = await supabase
    .from('logo_settings')
    .select('id, logo_url, uploaded_at')
    .eq('is_active', true)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching active logo:', error.message);
    return null;
  }

  return data as ActiveLogoRecord | null;
}

export async function resolveActiveLogoUrl(supabase: SupabaseClient): Promise<string> {
  const record = await fetchActiveLogoRecord(supabase);
  if (!record?.logo_url) return DEFAULT_PORTAL_LOGO;

  return resolveLogoPublicUrl(record.logo_url, (path) => {
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
    return urlData.publicUrl;
  });
}
