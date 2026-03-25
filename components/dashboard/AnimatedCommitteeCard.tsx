'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const ACCENT_COLORS = [
    'from-blue-400 to-indigo-500',
    'from-violet-400 to-purple-500',
    'from-emerald-400 to-teal-500',
    'from-amber-400 to-orange-500',
    'from-rose-400 to-pink-500',
    'from-cyan-400 to-blue-500',
    'from-fuchsia-400 to-purple-500',
    'from-lime-400 to-green-500',
];

interface AnimatedCommitteeCardProps {
    committee: { id: string; name: string; description: string };
    index: number;
}

export default function AnimatedCommitteeCard({ committee, index }: AnimatedCommitteeCardProps) {
    const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
            whileHover={{ y: -5, scale: 1.03, transition: { duration: 0.2 } }}
        >
            <Link
                href={`/committees/${committee.id}`}
                className="group block glass rounded-2xl p-5 hover:shadow-xl transition-all duration-300 relative overflow-hidden h-full min-h-[120px]"
            >
                {/* Top gradient accent bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accent} rounded-t-2xl`} />
                {/* Hover orb */}
                <div className={`absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-15 blur-2xl transition-all duration-500`} />

                <h4 className="font-bold text-gray-900 mt-1 line-clamp-1">{committee.name}</h4>
                <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">{committee.description}</p>
            </Link>
        </motion.div>
    );
}
