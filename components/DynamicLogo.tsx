'use client';

import { useEffect, useState } from 'react';
import { getCurrentLogoClient } from '@/lib/logo-utils-client';

interface DynamicLogoProps {
    width?: number;
    height?: number;
    className?: string;
    alt?: string;
}

export default function DynamicLogo({
    width = 40,
    height = 40,
    className = '',
    alt = 'IIChE AVVU SC Logo'
}: DynamicLogoProps) {
    const [logoUrl, setLogoUrl] = useState('/icons/iiche-app-icon.svg');

    useEffect(() => {
        loadLogo();
    }, []);

    async function loadLogo() {
        const url = await getCurrentLogoClient();
        setLogoUrl(url);
    }

    return (
        <img
            src={logoUrl}
            alt={alt}
            width={width}
            height={height}
            className={`object-contain ${className}`}
            onError={(e) => {
                e.currentTarget.src = '/icons/iiche-app-icon.svg';
            }}
        />
    );
}
