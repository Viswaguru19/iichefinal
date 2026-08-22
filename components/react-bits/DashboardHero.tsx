'use client';

import GradientText from '@/components/react-bits/GradientText';
import GsapText from '@/components/react-bits/GsapText';
import type { ReactNode } from 'react';

interface DashboardHeroProps {
  firstName: string;
  roleLine?: string | null;
  welcome?: string;
  children?: ReactNode;
}

/** Home dashboard greeting — gradient name + GSAP welcome (no mesh backdrop). */
export default function DashboardHero({
  firstName,
  roleLine,
  welcome = 'Welcome to your dashboard',
  children,
}: DashboardHeroProps) {
  return (
    <div className="relative mb-6 sm:mb-8">
      <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
        <span className="dashboard-hero-hi">Hi </span>
        <GradientText
          className="!mx-0 !inline-flex text-2xl sm:text-3xl font-bold"
          colors={['#5eead4', '#38bdf8', '#67e8f9', '#5eead4']}
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
  );
}
