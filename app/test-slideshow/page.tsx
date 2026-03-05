'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function TestSlideshowPage() {
    const [slides, setSlides] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [storageBuckets, setStorageBuckets] = useState<any[]>([]);

    useEffect(() => {
        async function checkSlideshow() {
            const supabase = await createClient();

            try {
                // Check storage buckets
                const { data: buckets } = await supabase
                    .storage
                    .listBuckets();
                setStorageBuckets(buckets || []);

                // Get slideshow photos
                const { data: photos, error: photosError } = await supabase
                    .from('homepage_slideshow')
                    .select('*')
                    .order('display_order');

                if (photosError) {
                    setError(`Database error: ${photosError.message}`);
                    setLoading(false);
                    return;
                }

                // Get all photos regardless of status
                const allPhotos = photos || [];

                // Get approved and active photos
                const { data: activePhotos } = await supabase
                    .from('homepage_slideshow')
                    .select('*')
                    .eq('is_active', true)
                    .eq('approval_status', 'approved')
                    .order('display_order');

                // Convert storage paths to public URLs for active photos
                const slidesWithUrls = activePhotos?.map((slide: any) => {
                    const { data } = supabase.storage
                        .from('slideshow-photos')
                        .getPublicUrl(slide.photo_url);
                    return {
                        ...slide,
                        photo_url: data.publicUrl
                    };
                }) || [];

                setSlides(slidesWithUrls);

                // Store all photos info for debugging
                (window as any).__slideshowDebug = {
                    allPhotos,
                    activePhotos,
                    slidesWithUrls
                };

            } catch (err: any) {
                setError(err.message);
            }

            setLoading(false);
        }

        checkSlideshow();
    }, []);

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <h1 className="text-3xl font-bold mb-8">Slideshow Debug Page</h1>

            {/* Storage Buckets */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-bold mb-4">Storage Buckets</h2>
                {storageBuckets.length === 0 ? (
                    <p className="text-red-500">No storage buckets found!</p>
                ) : (
                    <ul>
                        {storageBuckets.map((bucket) => (
                            <li key={bucket.id} className="mb-2">
                                <span className={bucket.public ? 'text-green-600' : 'text-red-600'}>
                                    {bucket.name}
                                </span>
                                {bucket.public ? ' (PUBLIC)' : ' (PRIVATE)'}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {/* Slides Info */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-bold mb-4">Slideshow Status</h2>
                <p><strong>Active/Approved Slides:</strong> {slides.length}</p>
                {slides.length === 0 && (
                    <p className="text-red-500 mt-2">
                        No photos are showing because none meet both criteria:
                        <br />- is_active = true
                        <br />- approval_status = 'approved'
                    </p>
                )}
            </div>

            {/* Preview Slides */}
            {slides.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-bold mb-4">Photo Previews</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {slides.map((slide) => (
                            <div key={slide.id} className="border rounded-lg overflow-hidden">
                                <img
                                    src={slide.photo_url}
                                    alt={slide.title || 'Slideshow photo'}
                                    className="w-full h-48 object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x200?text=Image+Load+Error';
                                    }}
                                />
                                <div className="p-2">
                                    <p className="font-bold">{slide.title || 'No title'}</p>
                                    <p className="text-sm text-gray-500 truncate">{slide.photo_url}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Quick Fix */}
            {slides.length === 0 && (
                <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mt-6">
                    <h3 className="font-bold">Quick Fix - Run this in Supabase SQL Editor:</h3>
                    <pre className="mt-2 bg-white p-4 rounded overflow-x-auto text-sm">
                        {`-- Fix 1: Make all photos active and approved
UPDATE homepage_slideshow 
SET is_active = true, approval_status = 'approved';

-- Fix 2: Check if storage bucket exists and is public
SELECT id, name, public FROM storage.buckets WHERE name = 'slideshow-photos';

-- Fix 3: If bucket doesn't exist, create it
INSERT INTO storage.buckets (id, name, public)
VALUES ('slideshow-photos', 'slideshow-photos', true)
ON CONFLICT (id) DO NOTHING;`}
                    </pre>
                </div>
            )}
        </div>
    );
}
