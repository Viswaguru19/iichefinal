'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Upload, Trash2, Eye, EyeOff, GripVertical, Plus, Image as ImageIcon } from 'lucide-react';

interface SlideshowPhoto {
    id: string;
    photo_url: string;
    title: string | null;
    description: string | null;
    link_url: string | null;
    is_active: boolean;
    display_order: number;
    approval_status: string;
    uploaded_by: string;
    created_at: string;
}

export default function SlideshowManagementPage() {
    const [photos, setPhotos] = useState<SlideshowPhoto[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showUploadForm, setShowUploadForm] = useState(false);

    // Form state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [linkUrl, setLinkUrl] = useState('');

    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        checkPermissions();
        loadPhotos();
    }, []);

    const checkPermissions = async () => {
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
            toast.error('Access denied - Super Admin or Secretary role required');
            router.push('/dashboard');
        }
    };

    const loadPhotos = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('homepage_slideshow')
            .select('*')
            .order('display_order');

        if (error) {
            toast.error('Failed to load photos');
        } else {
            setPhotos(data || []);
        }
        setLoading(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be less than 5MB');
            return;
        }

        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error('Please select a photo');
            return;
        }

        setUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Upload to storage
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${crypto.randomUUID()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('slideshow-photos')
                .upload(fileName, selectedFile);

            if (uploadError) throw uploadError;

            // Get max display order
            const maxOrder = photos.length > 0
                ? Math.max(...photos.map(p => p.display_order))
                : 0;

            // Insert record (auto-approved for admin/EC)
            const { error: insertError } = await supabase
                .from('homepage_slideshow')
                .insert({
                    photo_url: fileName,
                    title: title || null,
                    description: description || null,
                    link_url: linkUrl || null,
                    uploaded_by: user.id,
                    approval_status: 'approved', // Auto-approve for admin/EC
                    is_active: true,
                    display_order: maxOrder + 1
                });

            if (insertError) throw insertError;

            toast.success('Photo uploaded successfully!');

            // Reset form
            setSelectedFile(null);
            setPreviewUrl(null);
            setTitle('');
            setDescription('');
            setLinkUrl('');
            setShowUploadForm(false);

            loadPhotos();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setUploading(false);
        }
    };

    const toggleActive = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('homepage_slideshow')
            .update({ is_active: !currentStatus })
            .eq('id', id);

        if (error) {
            toast.error('Failed to update status');
        } else {
            toast.success(currentStatus ? 'Photo hidden' : 'Photo activated');
            loadPhotos();
        }
    };

    const deletePhoto = async (id: string, photoUrl: string) => {
        if (!confirm('Are you sure you want to delete this photo?')) return;

        try {
            // Delete from storage
            await supabase.storage
                .from('slideshow-photos')
                .remove([photoUrl]);

            // Delete from database
            const { error } = await supabase
                .from('homepage_slideshow')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success('Photo deleted');
            loadPhotos();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const getPhotoUrl = (path: string) => {
        const { data } = supabase.storage
            .from('slideshow-photos')
            .getPublicUrl(path);
        console.log('Generated photo URL:', data.publicUrl);
        return data.publicUrl;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <h1 className="text-2xl font-bold text-blue-600">Homepage Slideshow Management</h1>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="text-gray-600 hover:text-blue-600"
                        >
                            ← Back to Dashboard
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Upload Button */}
                <div className="mb-6">
                    <button
                        onClick={() => setShowUploadForm(!showUploadForm)}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        {showUploadForm ? 'Cancel' : 'Upload New Photo'}
                    </button>
                </div>

                {/* Upload Form */}
                {showUploadForm && (
                    <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Upload Slideshow Photo</h2>

                        <div className="space-y-6">
                            {/* File Upload */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Photo (Max 5MB)
                                </label>
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                                    {previewUrl ? (
                                        <div className="space-y-4">
                                            <img
                                                src={previewUrl}
                                                alt="Preview"
                                                className="max-h-64 mx-auto rounded-lg"
                                            />
                                            <button
                                                onClick={() => {
                                                    setSelectedFile(null);
                                                    setPreviewUrl(null);
                                                }}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="cursor-pointer">
                                            <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                            <p className="text-gray-600 mb-2">Click to upload or drag and drop</p>
                                            <p className="text-sm text-gray-500">PNG, JPG, GIF up to 5MB</p>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileSelect}
                                                className="hidden"
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Title (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., Welcome to IIChE AVVU"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Brief description..."
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>

                            {/* Link URL */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Link URL (Optional)
                                </label>
                                <input
                                    type="url"
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Upload Button */}
                            <button
                                onClick={handleUpload}
                                disabled={uploading || !selectedFile}
                                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Upload className="w-5 h-5" />
                                {uploading ? 'Uploading...' : 'Upload Photo'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Photos Grid */}
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">
                        Current Slideshow Photos ({photos.length})
                    </h2>

                    {photos.length === 0 ? (
                        <div className="text-center py-12">
                            <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600">No photos uploaded yet</p>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {photos.map((photo) => (
                                <div
                                    key={photo.id}
                                    className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition"
                                >
                                    <div className="relative h-48 bg-gray-100">
                                        <img
                                            src={getPhotoUrl(photo.photo_url)}
                                            alt={photo.title || 'Slideshow photo'}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                console.error('Failed to load image:', photo.photo_url);
                                                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage Error%3C/text%3E%3C/svg%3E';
                                            }}
                                        />
                                        {!photo.is_active && (
                                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                                <span className="text-white font-semibold">Hidden</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4">
                                        {photo.title && (
                                            <h3 className="font-semibold text-gray-900 mb-1">{photo.title}</h3>
                                        )}
                                        {photo.description && (
                                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{photo.description}</p>
                                        )}

                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500">
                                                Order: {photo.display_order}
                                            </span>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => toggleActive(photo.id, photo.is_active)}
                                                    className={`p-2 rounded-lg ${photo.is_active
                                                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                    title={photo.is_active ? 'Hide' : 'Show'}
                                                >
                                                    {photo.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                </button>

                                                <button
                                                    onClick={() => deletePhoto(photo.id, photo.photo_url)}
                                                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
