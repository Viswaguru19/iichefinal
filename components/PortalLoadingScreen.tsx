'use client';

import { motion } from 'framer-motion';

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
  const card = (
    <div className={`portal-loader-card ${className}`.trim()}>
      <div className="portal-loader-orbit" aria-hidden>
        <div className="portal-loader-ring" />
        <div className="portal-loader-logo-wrap">
          <img src="/logo.svg" alt="" className="portal-loader-logo" width={72} height={72} />
        </div>
      </div>
      <p className="portal-loader-text">{message}</p>
      <div className="portal-loader-track" aria-hidden>
        <div className="portal-loader-track-fill" />
      </div>
      <div className="portal-loader-dots" aria-hidden>
        <span />
        <span />
        <span />
      </div>
    </div>
  );

  if (!fullPage) return card;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-mesh flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {card}
      </motion.div>
    </div>
  );
}
