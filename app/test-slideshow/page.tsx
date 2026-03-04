import { createClient } from '@/lib/supabase/server';

export default async function TestSlideshowPage() {
    const supabase = await createClient();

    // Get slideshow photos
    const { data: slideshowPhotos, error } = await supabase
        .from('homepage_slideshow')
        .select('*')
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .order('display_order');

    // Convert storage paths to public URLs
    const slidesWithUrls = slideshowPhotos?.map((slide: any) => {
        const { data } = supabase.storage
            .from('slideshow-photos')
            .getPublicUrl(slide.photo_url);
        return {
            ...slide,
            photo_url: slide.photo_url,
            public_url: data.publicUrl
        };
    }) || [];

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Slideshow Debug Page</h1>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        <strong>Error:</strong> {error.message}
                    </div>
                )}

                <div className="bg-white rounded-lg shadow p-6 mb-8">
                    <h2 className="text-xl font-bold mb-4">Database Query Result</h2>
                    <p className="mb-2">Total photos found: {slideshowPhotos?.length || 0}</p>
                    <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                        {JSON.stringify(slideshowPhotos, null, 2)}
                    </pre>
                </div>

                <div className="bg-white rounded-lg shadow p-6 mb-8">
                    <h2 className="text-xl font-bold mb-4">Photos with Public URLs</h2>
                    <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                        {JSON.stringify(slidesWithUrls, null, 2)}
                    </pre>
                </div>

                <div className="space-y-8">
                    <h2 className="text-2xl font-bold">Photo Preview</h2>
                    {slidesWithUrls.map((slide: any) => (
                        <div key={slide.id} className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-bold mb-2">{slide.title || 'Untitled'}</h3>

                            <div className="grid md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1"><strong>Database Path:</strong></p>
                                    <code className="text-xs bg-gray-100 p-2 rounded block break-all">
                                        {slide.photo_url}
                                    </code>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 mb-1"><strong>Public URL:</strong></p>
                                    <code className="text-xs bg-gray-100 p-2 rounded block break-all">
                                        {slide.public_url}
                                    </code>
                                </div>
                            </div>

                            <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-2"><strong>Image Preview:</strong></p>
                                <div className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
                                    <img
                                        src={slide.public_url}
                                        alt={slide.title || 'Slideshow photo'}
                                        className="max-w-full h-auto max-h-96 mx-auto"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            const errorDiv = document.createElement('div');
                                            errorDiv.className = 'text-red-600 text-center p-8';
                                            errorDiv.textContent = '❌ Image failed to load';
                                            target.parentElement?.appendChild(errorDiv);
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="text-xs text-gray-500">
                                <p>Active: {slide.is_active ? '✅' : '❌'}</p>
                                <p>Approval: {slide.approval_status}</p>
                                <p>Order: {slide.display_order}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {slidesWithUrls.length === 0 && (
                    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
                        <strong>No photos found!</strong> Make sure photos are:
                        <ul className="list-disc ml-6 mt-2">
                            <li>Marked as active (is_active = true)</li>
                            <li>Approved (approval_status = 'approved')</li>
                            <li>Uploaded to the slideshow-photos bucket</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
