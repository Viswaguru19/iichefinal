import { createClient } from '@/lib/supabase/client';

export async function getCurrentLogoClient(): Promise<string> {
    try {
        const supabase = createClient();

        const { data } = await supabase
            .from('logo_settings')
            .select('logo_url')
            .eq('is_active', true)
            .single();

        if (data && data.logo_url) {
            if (data.logo_url.startsWith('logos/')) {
                const { data: urlData } = supabase.storage
                    .from('logos')
                    .getPublicUrl(data.logo_url.replace('logos/', ''));
                return urlData.publicUrl;
            }
            return `/${data.logo_url}`;
        }
    } catch (error) {
        console.error('Error fetching logo:', error);
    }

    return '/logo.svg';
}
