import { createClient } from '@/lib/supabase/server';

export async function getCurrentLogo(): Promise<string> {
    try {
        const supabase = await createClient();

        const { data } = await supabase
            .from('logo_settings')
            .select('logo_url')
            .eq('is_active', true)
            .single();

        if (data && data.logo_url) {
            // If it's a storage path, get public URL
            if (data.logo_url.startsWith('logos/')) {
                const { data: urlData } = supabase.storage
                    .from('logos')
                    .getPublicUrl(data.logo_url.replace('logos/', ''));
                return urlData.publicUrl;
            }
            // Otherwise return as-is (for default logo.svg)
            return `/${data.logo_url}`;
        }
    } catch (error) {
        console.error('Error fetching logo:', error);
    }

    // Fallback to default logo
    return '/logo.svg';
}
