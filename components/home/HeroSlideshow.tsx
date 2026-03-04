'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Slide {
    id: string;
    photo_url: string;
    title?: string;
    description?: string;
    link_url?: string;
    display_order: number;
}

interface HeroSlideshowProps {
    slides: Slide[];
    autoPlayInterval?: number;
}

export default function HeroSlideshow({ slides, autoPlayInterval = 5000 }: HeroSlideshowProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (slides.length <= 1 || isPaused) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % slides.length);
        }, autoPlayInterval);

        return () => clearInterval(interval);
    }, [slides.length, autoPlayInterval, isPaused]);

    const goToSlide = (index: number) => {
        setCurrentIndex(index);
    };

    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
    };

    const goToNext = () => {
        setCurrentIndex((prev) => (prev + 1) % slides.length);
    };

    if (slides.length === 0) {
        return (
            <div className="relative w-full h-[500px] bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center">
                <div className="text-center text-white px-4">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-5xl md:text-7xl font-bold mb-4"
                    >
                        IIChE AVVU
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-xl md:text-2xl"
                    >
                        Indian Institute of Chemical Engineers - Student Chapter
                    </motion.p>
                </div>
            </div>
        );
    }

    const currentSlide = slides[currentIndex];

    return (
        <div
            className="relative w-full h-[500px] md:h-[600px] overflow-hidden bg-gray-900"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Slides */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7 }}
                    className="absolute inset-0"
                >
                    {/* Background Image */}
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{
                            backgroundImage: `url(${currentSlide.photo_url})`,
                        }}
                    >
                        {/* Overlay - Only if there's text content */}
                        {(currentSlide.title || currentSlide.description) && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
                        )}
                    </div>

                    {/* Content */}
                    {(currentSlide.title || currentSlide.description) && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center text-white px-4 max-w-4xl">
                                {currentSlide.title && (
                                    <motion.h2
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3, duration: 0.6 }}
                                        className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-2xl"
                                        style={{ textShadow: '0 4px 12px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.6)' }}
                                    >
                                        {currentSlide.title}
                                    </motion.h2>
                                )}
                                {currentSlide.description && (
                                    <motion.p
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5, duration: 0.6 }}
                                        className="text-lg md:text-2xl mb-6 drop-shadow-2xl"
                                        style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.6)' }}
                                    >
                                        {currentSlide.description}
                                    </motion.p>
                                )}
                                {currentSlide.link_url && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.7, duration: 0.6 }}
                                    >
                                        <Link
                                            href={currentSlide.link_url}
                                            className="inline-block bg-white text-blue-600 px-8 py-3 rounded-full font-bold text-lg hover:bg-blue-50 transition-colors shadow-xl"
                                        >
                                            Learn More
                                        </Link>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Navigation Arrows */}
            {slides.length > 1 && (
                <>
                    <button
                        onClick={goToPrevious}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition-all z-10"
                        aria-label="Previous slide"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                        onClick={goToNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition-all z-10"
                        aria-label="Next slide"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </>
            )}

            {/* Dots Navigation */}
            {slides.length > 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {slides.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`transition-all ${index === currentIndex
                                ? 'w-8 h-3 bg-white'
                                : 'w-3 h-3 bg-white/50 hover:bg-white/75'
                                } rounded-full`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Pause Indicator */}
            {isPaused && slides.length > 1 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm z-10"
                >
                    Paused
                </motion.div>
            )}
        </div>
    );
}
