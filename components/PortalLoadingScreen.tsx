'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getCurrentLogoClient } from '@/lib/logo-utils-client';

interface PortalLoadingScreenProps {
  message?: string;
  fullPage?: boolean;
  className?: string;
}

export default function PortalLoadingScreen({
  message = 'Loading portal…',
  fullPage = true,
  className = '',
}: PortalLoadingScreenProps) {
  const [logoUrl, setLogoUrl] = useState('/icons/iiche-app-icon.svg');

  useEffect(() => {
    void getCurrentLogoClient().then((url) => {
      if (url) setLogoUrl(url);
    });
  }, []);

  const card = (
    <div className={`portal-loader-shell ${className}`.trim()}>
      <div className="portal-loader-glow" aria-hidden />
      <div className="portal-loader-logo-stage">
        <img
          src={logoUrl}
          alt="IIChE AVVU SC"
          className="portal-loader-brand-logo"
          width={120}
          height={120}
          onError={(e) => {
            e.currentTarget.src = '/icons/iiche-app-icon.svg';
          }}
        />
      </div>
      <p className="portal-loader-brand-text">IIChE AVVU SC</p>
      <p className="portal-loader-message">{message}</p>
      <div className="portal-loader-track" aria-hidden>
        <div className="portal-loader-track-fill" />
      </div>
    </div>
  );

  if (!fullPage) return card;

  return (
    <div className="portal-loader-page">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {card}
      </motion.div>
    </div>
  );
}
