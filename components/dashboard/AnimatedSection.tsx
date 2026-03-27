'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { motionTokens } from '@/lib/ui/motion';

interface AnimatedSectionProps {
    children: ReactNode;
    delay?: number;
}

export default function AnimatedSection({ children, delay = 0 }: AnimatedSectionProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: motionTokens.section.duration,
                delay,
                ease: motionTokens.easing
            }}
        >
            {children}
        </motion.div>
    );
}
