'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
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
    alt = 'IIChE AVVU Logo'
}: DynamicLogoProps) {
    const [logoUrl, setLogoUrl] = useState('/logo.svg');

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
            className={className}
        />
    );
}
