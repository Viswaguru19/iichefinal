'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Upload, User } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';

interface UserProfilePhotoModalProps {
    user: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function UserProfilePhotoModal({ user, onClose, onSuccess }: UserProfilePhotoModalProps) {
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(user.profile_photo || '');
    const supabase = createClient();

    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be less than 5MB');
            return;
        }

        setUploading(true);
        try {
            // Create unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `profile-photos/${fileName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('profile-photos')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('profile-photos')
                .getPublicUrl(filePath);

            // Update user profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ profile_photo: publicUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;

            setPreviewUrl(publicUrl);
            toast.success('Profile photo updated successfully!');
            onSuccess();
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.message || 'Failed to upload photo');
        } finally {
            setUploading(false);
        }
    }

    async function handleRemovePhoto() {
        setUploading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ profile_photo: null })
                .eq('id', user.id);

            if (error) throw error;

            setPreviewUrl('');
            toast.success('Profile photo removed');
            onSuccess();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Update Profile Photo</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">User: {user.name}</p>
                    <p className="text-xs text-gray-500">Email: {user.email}</p>
                </div>

                {/* Current Photo Preview */}
                <div className="mb-6 flex justify-center">
                    {previewUrl ? (
                        <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-gray-200">
                            <Image
                                src={previewUrl}
                                alt={user.name}
                                fill
                                className="object-cover"
                            />
                        </div>
                    ) : (
                        <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="w-16 h-16 text-gray-400" />
                        </div>
                    )}
                </div>

                {/* Upload Button */}
                <div className="space-y-3">
                    <label className="block">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            disabled={uploading}
                            className="hidden"
                        />
                        <div className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                            <Upload className="w-5 h-5" />
                            {uploading ? 'Uploading...' : 'Upload New Photo'}
                        </div>
                    </label>

                    {previewUrl && (
                        <button
                            onClick={handleRemovePhoto}
                            disabled={uploading}
                            className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                            Remove Photo
                        </button>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full bg-gray-200 text-gray-900 px-4 py-3 rounded-lg hover:bg-gray-300"
                    >
                        Close
                    </button>
                </div>

                <p className="text-xs text-gray-500 mt-4 text-center">
                    Supported formats: JPG, PNG, GIF (max 5MB)
                </p>
            </div>
        </div>
    );
}
