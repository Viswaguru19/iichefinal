'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SlideshowDebugPage() {
    const [photos, setPhotos] = useState<any[]>([]);
    const [bucketInfo, setBucketInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        loadDebugInfo();
    }, []);

    const loadDebugInfo = async () => {
        setLoading(true);

        // Get photos from database
        const { data: dbPhotos, error: dbError } = await supabase
            .from('homepage_slideshow')
            .select('*')
            .order('display_order');

        console.log('Database photos:', dbPhotos, dbError);

        // Get storage bucket info
        const { data: buckets } = await supabase
            .storage
            .listBuckets();

        console.log('All buckets:', buckets);

        const slideshowBucket = buckets?.find(b => b.id === 'slideshow-photos');
        setBucketInfo(slideshowBucket);

        // Generate URLs for each photo
        const photosWithUrls = dbPhotos?.map(photo => {
            const { data } = supabase.storage
                .from('slideshow-photos')
                .getPublicUrl(photo.photo_url);

            return {
                ...photo,
                generatedUrl: data.publicUrl
            };
        }) || [];

        setPhotos(photosWithUrls);
        setLoading(false);
    };

    const testImageLoad = (url: string) => {
        const img = new Image();
        img.onload = () => {
            console.log('✅ Image loaded successfully:', url);
            alert('Image loaded successfully!');
        };
        img.onerror = (e) => {
            console.error('❌ Image failed to load:', url, e);
            alert('Image failed to load! Check console for details.');
        };
        img.src = url;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading debug info...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Slideshow Debug Information</h1>

                {/* Bucket Info */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Storage Bucket Info</h2>
                    {bucketInfo ? (
                        <div className="space-y-2">
                            <p><strong>ID:</strong> {bucketInfo.id}</p>
                            <p><strong>Name:</strong> {bucketInfo.name}</p>
                            <p><strong>Public:</strong> {bucketInfo.public ? '✅ Yes' : '❌ No'}</p>
                            <p><strong>Created:</strong> {new Date(bucketInfo.created_at).toLocaleString()}</p>
                            {bucketInfo.file_size_limit && (
                                <p><strong>File Size Limit:</strong> {(bucketInfo.file_size_limit / 1024 / 1024).toFixed(2)} MB</p>
                            )}
                        </div>
                    ) : (
                        <p className="text-red-600">❌ Bucket 'slideshow-photos' not found!</p>
                    )}
                </div>

                {/* Photos Info */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                        Database Photos ({photos.length})
                    </h2>

                    {photos.length === 0 ? (
                        <p className="text-gray-600">No photos found in database</p>
                    ) : (
                        <div className="space-y-6">
                            {photos.map((photo, index) => (
                                <div key={photo.id} className="border border-gray-200 rounded-lg p-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <h3 className="font-bold text-lg mb-2">Photo #{index + 1}</h3>
                                            <div className="space-y-1 text-sm">
                                                <p><strong>ID:</strong> {photo.id}</p>
                                                <p><strong>Filename:</strong> {photo.photo_url}</p>
                                                <p><strong>Title:</strong> {photo.title || 'N/A'}</p>
                                                <p><strong>Active:</strong> {photo.is_active ? '✅ Yes' : '❌ No'}</p>
                                                <p><strong>Status:</strong> {photo.approval_status}</p>
                                                <p><strong>Order:</strong> {photo.display_order}</p>
                                            </div>
                                            <div className="mt-4">
                                                <p className="font-semibold mb-1">Generated URL:</p>
                                                <p className="text-xs text-gray-600 break-all bg-gray-50 p-2 rounded">
                                                    {photo.generatedUrl}
                                                </p>
                                                <button
                                                    onClick={() => testImageLoad(photo.generatedUrl)}
                                                    className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                                                >
                                                    Test Load
                                                </button>
                                                <a
                                                    href={photo.generatedUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="ml-2 inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
                                                >
                                                    Open in New Tab
                                                </a>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-semibold mb-2">Preview:</p>
                                            <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-100">
                                                <img
                                                    src={photo.generatedUrl}
                                                    alt={photo.title || 'Preview'}
                                                    className="w-full h-48 object-cover"
                                                    onLoad={() => console.log('✅ Loaded:', photo.photo_url)}
                                                    onError={(e) => {
                                                        console.error('❌ Failed:', photo.photo_url);
                                                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200"%3E%3Crect fill="%23fee" width="400" height="200"/%3E%3Ctext fill="%23c00" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="20"%3EFailed to Load%3C/text%3E%3C/svg%3E';
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h2 className="text-xl font-bold text-blue-900 mb-4">Troubleshooting Steps</h2>
                    <ol className="list-decimal list-inside space-y-2 text-blue-900">
                        <li>Check if bucket is marked as "Public" above</li>
                        <li>Click "Test Load" buttons to see if images load</li>
                        <li>Click "Open in New Tab" to test direct access</li>
                        <li>Check browser console (F12) for error messages</li>
                        <li>If bucket is not public, run FIX_SLIDESHOW_IMAGES.sql</li>
                        <li>If images still fail, check Supabase Storage → slideshow-photos for actual files</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
