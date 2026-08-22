'use client';

import GradientMesh from '@/components/react-bits/GradientMesh';
import GradientText from '@/components/react-bits/GradientText';
import GsapText from '@/components/react-bits/GsapText';
import type { ReactNode } from 'react';

interface DashboardHeroProps {
  firstName: string;
  roleLine?: string | null;
  welcome?: string;
  children?: ReactNode;
}

/** Home dashboard hero — React Bits gradient name + GSAP welcome line. */
export default function DashboardHero({
  firstName,
  roleLine,
  welcome = 'Welcome to your dashboard',
  children,
}: DashboardHeroProps) {
  return (
    <div className="relative mb-6 sm:mb-8">
      <div className="pointer-events-none absolute -inset-x-4 -top-6 h-40 overflow-hidden sm:-inset-x-8">
        <GradientMesh className="opacity-50" />
      </div>
      <div className="relative z-10">
        <h2 className="text-2xl sm:text-3xl font-bold dashboard-hero-name">
          <span className="text-gray-800">Hi </span>
          <GradientText
            className="!mx-0 !inline-flex text-2xl sm:text-3xl font-bold"
            colors={['#0f766e', '#2563eb', '#0891b2', '#0f766e']}
            animationSpeed={7}
          >
            {firstName}
          </GradientText>
        </h2>
        {roleLine ? (
          <p className="mt-2 text-sm sm:text-base font-medium dashboard-hero-role">{roleLine}</p>
        ) : null}
        {children}
        <GsapText
          text={welcome}
          as="p"
          className="dashboard-hero-welcome mt-3"
          split="words"
          delay={0.18}
          stagger={0.04}
        />
      </div>
    </div>
  );
}
