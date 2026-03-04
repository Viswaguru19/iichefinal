'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

interface Committee {
    id: string;
    name: string;
    description: string;
}

interface AnimatedCommitteeCardProps {
    committee: Committee;
    index: number;
}

export default function AnimatedCommitteeCard({ committee, index }: AnimatedCommitteeCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
                duration: 0.3,
                delay: index * 0.05,
                ease: [0.25, 0.1, 0.25, 1]
            }}
            whileHover={{
                y: -4,
                scale: 1.02,
                transition: { duration: 0.2 }
            }}
        >
            <Link
                href={`/committees/${committee.id}`}
                className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-all duration-300 block"
            >
                <h4 className="font-bold text-gray-900">{committee.name}</h4>
                <p className="text-sm text-gray-600 mt-1">{committee.description}</p>
            </Link>
        </motion.div>
    );
}
