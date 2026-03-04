'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

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
                duration: 0.5,
                delay,
                ease: [0.25, 0.1, 0.25, 1]
            }}
        >
            {children}
        </motion.div>
    );
}
