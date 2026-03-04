'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Upload, Image as ImageIcon, Check, Trash2, RefreshCw, History } from 'lucide-react';
import toast from 'react-hot-toast';

interface LogoRecord {
    id: string;
    logo_url: string;
    uploaded_at: string;
    uploaded_by: string;
    is_active: boolean;
}

export default function LogoManagementPage() {
    const [currentLogo, setCurrentLogo] = useState<LogoRecord | null>(null);
    const [logoHistory, setLogoHistory] = useState<LogoRecord[]>([]);
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        checkAuth();
        loadCurrentLogo();
        loadLogoHistory();
    }, []);

    async function checkAuth() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push('/login');
            return;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || !['super_admin', 'secretary'].includes(profile.role)) {
            toast.error('Access denied');
            router.push('/dashboard');
        }
    }

    async function loadCurrentLogo() {
        const { data } = await supabase
            .from('logo_settings')
            .select('*')
            .eq('is_active', true)
            .single();

        if (data) {
            setCurrentLogo(data);
            // Get public URL for the logo
            if (data.logo_url.startsWith('logos/')) {
                const { data: urlData } = supabase.storage
                    .from('logos')
                    .getPublicUrl(data.logo_url.replace('logos/', ''));
                setPreview(urlData.publicUrl);
            } else {
                setPreview(`/${data.logo_url}`);
            }
        }
    }

    async function loadLogoHistory() {
        const { data } = await supabase
            .from('logo_settings')
            .select('*')
            .order('uploaded_at', { ascending: false })
            .limit(10);

        if (data) {
            setLogoHistory(data);
        }
    }

    function getLogoPublicUrl(logoUrl: string): string {
        if (logoUrl.startsWith('logos/')) {
            const { data: urlData } = supabase.storage
                .from('logos')
                .getPublicUrl(logoUrl.replace('logos/', ''));
            return urlData.publicUrl;
        }
        return `/${logoUrl}`;
    }

    async function setAsActive(logoId: string) {
        try {
            // Deactivate all logos
            await supabase
                .from('logo_settings')
                .update({ is_active: false })
                .eq('is_active', true);

            // Activate selected logo
            const { error } = await supabase
                .from('logo_settings')
                .update({ is_active: true })
                .eq('id', logoId);

            if (error) throw error;

            toast.success('Logo activated successfully!');
            loadCurrentLogo();
            loadLogoHistory();
        } catch (error: any) {
            toast.error(error.message || 'Failed to activate logo');
        }
    }

    async function deleteLogo(logoId: string, logoUrl: string) {
        if (!confirm('Are you sure you want to delete this logo?')) return;

        try {
            // Delete from storage if it's a stored file
            if (logoUrl.startsWith('logos/')) {
                await supabase.storage
                    .from('logos')
                    .remove([logoUrl.replace('logos/', '')]);
            }

            // Delete from database
            const { error } = await supabase
                .from('logo_settings')
                .delete()
                .eq('id', logoId);

            if (error) throw error;

            toast.success('Logo deleted successfully!');
            loadCurrentLogo();
            loadLogoHistory();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete logo');
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast.error('File size must be less than 2MB');
            return;
        }

        setUploading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Upload to storage
            const fileExt = file.name.split('.').pop();
            const fileName = `logo-${Date.now()}.${fileExt}`;
            const filePath = fileName;

            const { error: uploadError } = await supabase.storage
                .from('logos')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Deactivate old logos
            await supabase
                .from('logo_settings')
                .update({ is_active: false })
                .eq('is_active', true);

            // Insert new logo record
            const { error: insertError } = await supabase
                .from('logo_settings')
                .insert({
                    logo_url: `logos/${filePath}`,
                    uploaded_by: user.id,
                    is_active: true
                });

            if (insertError) throw insertError;

            toast.success('Logo uploaded successfully!');
            loadCurrentLogo();
            loadLogoHistory();
        } catch (error: any) {
            toast.error(error.message || 'Failed to upload logo');
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <h1 className="text-2xl font-bold text-blue-600">Logo Management</h1>
                        <button
                            onClick={() => router.back()}
                            className="text-gray-600 hover:text-blue-600"
                        >
                            ← Back
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        Current Logo
                    </h2>

                    {/* Current Logo Preview */}
                    <div className="mb-8">
                        <div className="bg-gray-100 rounded-lg p-8 flex items-center justify-center min-h-[300px]">
                            {preview ? (
                                <img
                                    src={preview}
                                    alt="Current Logo"
                                    className="max-w-full max-h-[250px] object-contain"
                                />
                            ) : (
                                <div className="text-center text-gray-500">
                                    <ImageIcon className="w-16 h-16 mx-auto mb-4" />
                                    <p>No logo uploaded</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Upload New Logo */}
                    <div className="border-t pt-8">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">
                            Upload New Logo
                        </h3>
                        <p className="text-sm text-gray-600 mb-6">
                            This logo will be displayed across the entire portal including:
                            home page, dashboard, chat wallpaper, and login page.
                        </p>

                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <label className="flex-1">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        disabled={uploading}
                                        className="hidden"
                                        id="logo-upload"
                                    />
                                    <div className="flex items-center justify-center gap-3 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 cursor-pointer disabled:opacity-50">
                                        <Upload className="w-5 h-5" />
                                        <span>{uploading ? 'Uploading...' : 'Choose Logo File'}</span>
                                    </div>
                                </label>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                    <Check className="w-5 h-5" />
                                    Logo Guidelines
                                </h4>
                                <ul className="text-sm text-blue-800 space-y-1 ml-7">
                                    <li>• Recommended size: 512x512 pixels or larger</li>
                                    <li>• Supported formats: PNG, JPG, SVG</li>
                                    <li>• Maximum file size: 2MB</li>
                                    <li>• Transparent background recommended for PNG</li>
                                    <li>• Square aspect ratio works best</li>
                                </ul>
                            </div>

                            {currentLogo && (
                                <div className="text-sm text-gray-600">
                                    <p>
                                        Last updated:{' '}
                                        {new Date(currentLogo.uploaded_at).toLocaleString()}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Logo Usage Info */}
                    <div className="mt-8 border-t pt-8">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">
                            Where the Logo Appears
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="font-semibold text-gray-900 mb-2">
                                    🏠 Home Page
                                </h4>
                                <p className="text-sm text-gray-600">
                                    Navigation bar (40x40px)
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="font-semibold text-gray-900 mb-2">
                                    📊 Dashboard
                                </h4>
                                <p className="text-sm text-gray-600">
                                    Navigation bar (40x40px)
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="font-semibold text-gray-900 mb-2">
                                    💬 Chat Wallpaper
                                </h4>
                                <p className="text-sm text-gray-600">
                                    Background watermark (256x256px, 5% opacity)
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="font-semibold text-gray-900 mb-2">
                                    🔐 Login Page
                                </h4>
                                <p className="text-sm text-gray-600">
                                    Near organization name
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Logo History */}
                    <div className="mt-8 border-t pt-8">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <History className="w-6 h-6" />
                                Logo History
                            </h3>
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                            >
                                {showHistory ? 'Hide' : 'Show'} History
                            </button>
                        </div>

                        {showHistory && (
                            <div className="space-y-4">
                                {logoHistory.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">
                                        No logo history available
                                    </p>
                                ) : (
                                    logoHistory.map((logo) => (
                                        <div
                                            key={logo.id}
                                            className={`border rounded-lg p-4 ${logo.is_active
                                                    ? 'border-green-500 bg-green-50'
                                                    : 'border-gray-200 bg-white'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                {/* Logo Preview */}
                                                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <img
                                                        src={getLogoPublicUrl(logo.logo_url)}
                                                        alt="Logo"
                                                        className="max-w-full max-h-full object-contain"
                                                    />
                                                </div>

                                                {/* Logo Info */}
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-medium text-gray-900">
                                                            {logo.logo_url.split('/').pop()}
                                                        </p>
                                                        {logo.is_active && (
                                                            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                                                                Active
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-600">
                                                        Uploaded: {new Date(logo.uploaded_at).toLocaleString()}
                                                    </p>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-2">
                                                    {!logo.is_active && (
                                                        <button
                                                            onClick={() => setAsActive(logo.id)}
                                                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                                                        >
                                                            <RefreshCw className="w-4 h-4" />
                                                            Set Active
                                                        </button>
                                                    )}
                                                    {!logo.is_active && (
                                                        <button
                                                            onClick={() => deleteLogo(logo.id, logo.logo_url)}
                                                            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
