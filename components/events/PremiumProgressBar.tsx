'use client';

import { CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface Stage {
    name: string;
    status: 'completed' | 'current' | 'pending' | 'rejected';
    approver?: string;
    approvedAt?: string;
    icon?: React.ReactNode;
}

interface PremiumProgressBarProps {
    stages: Stage[];
    currentStage: number;
}

export default function PremiumProgressBar({ stages, currentStage }: PremiumProgressBarProps) {
    const getStageColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-green-500';
            case 'current':
                return 'bg-blue-500';
            case 'rejected':
                return 'bg-red-500';
            default:
                return 'bg-gray-300';
        }
    };

    const getStageIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-6 h-6 text-white" />;
            case 'current':
                return <Clock className="w-6 h-6 text-white animate-pulse" />;
            case 'rejected':
                return <XCircle className="w-6 h-6 text-white" />;
            default:
                return <AlertCircle className="w-6 h-6 text-white opacity-50" />;
        }
    };

    const progressPercentage = ((currentStage + 1) / stages.length) * 100;

    return (
        <div className="w-full py-8">
            {/* Progress Bar */}
            <div className="relative mb-12">
                {/* Background Line */}
                <div className="absolute top-1/2 left-0 right-0 h-2 bg-gray-200 rounded-full -translate-y-1/2" />

                {/* Animated Progress Line */}
                <motion.div
                    className="absolute top-1/2 left-0 h-2 rounded-full -translate-y-1/2"
                    style={{
                        background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 1, ease: 'easeInOut' }}
                />

                {/* Stage Nodes */}
                <div className="relative flex justify-between">
                    {stages.map((stage, index) => (
                        <motion.div
                            key={index}
                            className="flex flex-col items-center"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: index * 0.2, duration: 0.5 }}
                        >
                            {/* Node Circle */}
                            <motion.div
                                className={`w-12 h-12 rounded-full flex items-center justify-center ${getStageColor(stage.status)} shadow-lg relative z-10`}
                                whileHover={{ scale: 1.1 }}
                                animate={
                                    stage.status === 'current'
                                        ? {
                                            boxShadow: [
                                                '0 0 0 0 rgba(59, 130, 246, 0.7)',
                                                '0 0 0 10px rgba(59, 130, 246, 0)',
                                            ],
                                        }
                                        : {}
                                }
                                transition={
                                    stage.status === 'current'
                                        ? {
                                            duration: 1.5,
                                            repeat: Infinity,
                                            repeatType: 'loop',
                                        }
                                        : {}
                                }
                            >
                                {getStageIcon(stage.status)}
                            </motion.div>

                            {/* Stage Name */}
                            <div className="mt-4 text-center max-w-[120px]">
                                <p
                                    className={`text-sm font-semibold ${stage.status === 'current'
                                            ? 'text-blue-600'
                                            : stage.status === 'completed'
                                                ? 'text-green-600'
                                                : stage.status === 'rejected'
                                                    ? 'text-red-600'
                                                    : 'text-gray-500'
                                        }`}
                                >
                                    {stage.name}
                                </p>

                                {/* Approver Info */}
                                {stage.approver && (
                                    <p className="text-xs text-gray-500 mt-1">{stage.approver}</p>
                                )}

                                {/* Approved Date */}
                                {stage.approvedAt && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        {new Date(stage.approvedAt).toLocaleDateString()}
                                    </p>
                                )}

                                {/* Status Badge */}
                                {stage.status === 'current' && (
                                    <motion.span
                                        className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full font-medium"
                                        animate={{ opacity: [1, 0.5, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    >
                                        In Progress
                                    </motion.span>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Timeline View */}
            <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Approval Timeline</h3>
                <div className="space-y-3">
                    {stages.map((stage, index) => (
                        <motion.div
                            key={index}
                            className="flex items-start gap-4"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStageColor(stage.status)} flex-shrink-0`}>
                                {index === currentStage && stage.status === 'current' ? (
                                    <Clock className="w-4 h-4 text-white animate-spin" />
                                ) : stage.status === 'completed' ? (
                                    <CheckCircle className="w-4 h-4 text-white" />
                                ) : stage.status === 'rejected' ? (
                                    <XCircle className="w-4 h-4 text-white" />
                                ) : (
                                    <div className="w-2 h-2 bg-white rounded-full" />
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-gray-900">{stage.name}</p>
                                {stage.approver && (
                                    <p className="text-sm text-gray-600">Approved by: {stage.approver}</p>
                                )}
                                {stage.approvedAt && (
                                    <p className="text-xs text-gray-500">
                                        {new Date(stage.approvedAt).toLocaleString()}
                                    </p>
                                )}
                                {stage.status === 'current' && (
                                    <p className="text-sm text-blue-600 font-medium mt-1">
                                        ⏳ Awaiting approval...
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Progress Stats */}
            <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-md text-center">
                    <p className="text-2xl font-bold text-green-600">
                        {stages.filter((s) => s.status === 'completed').length}
                    </p>
                    <p className="text-sm text-gray-600">Completed</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-md text-center">
                    <p className="text-2xl font-bold text-blue-600">
                        {stages.filter((s) => s.status === 'current').length}
                    </p>
                    <p className="text-sm text-gray-600">In Progress</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-md text-center">
                    <p className="text-2xl font-bold text-gray-400">
                        {stages.filter((s) => s.status === 'pending').length}
                    </p>
                    <p className="text-sm text-gray-600">Pending</p>
                </div>
            </div>
        </div>
    );
}
