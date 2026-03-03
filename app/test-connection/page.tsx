'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function TestConnection() {
    const [status, setStatus] = useState('Testing connection...');
    const [details, setDetails] = useState<any>(null);
    const [tests, setTests] = useState<any[]>([]);

    useEffect(() => {
        runTests();
    }, []);

    async function runTests() {
        const results: any[] = [];

        try {
            // Test 1: Environment variables
            results.push({
                name: 'Environment Variables',
                status: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Pass' : '❌ Fail',
                details: {
                    url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'Missing',
                    keyPresent: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                }
            });

            // Test 2: Create Supabase client
            let supabase;
            try {
                supabase = createClient();
                results.push({
                    name: 'Create Supabase Client',
                    status: '✅ Pass',
                    details: 'Client created successfully'
                });
            } catch (error: any) {
                results.push({
                    name: 'Create Supabase Client',
                    status: '❌ Fail',
                    details: error.message
                });
                setTests(results);
                setStatus('❌ Failed to create Supabase client');
                return;
            }

            // Test 3: Check auth
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                results.push({
                    name: 'Auth Check',
                    status: error ? '❌ Fail' : '✅ Pass',
                    details: error ? error.message : 'Auth working'
                });
            } catch (error: any) {
                results.push({
                    name: 'Auth Check',
                    status: '❌ Fail',
                    details: error.message
                });
            }

            // Test 4: Query profiles table
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('count')
                    .limit(1);

                results.push({
                    name: 'Database Query (profiles)',
                    status: error ? '❌ Fail' : '✅ Pass',
                    details: error ? error.message : 'Query successful'
                });
            } catch (error: any) {
                results.push({
                    name: 'Database Query (profiles)',
                    status: '❌ Fail',
                    details: error.message
                });
            }

            // Test 5: Check if username column exists
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('username')
                    .limit(1);

                results.push({
                    name: 'Username Column Check',
                    status: error ? '❌ Fail' : '✅ Pass',
                    details: error ? error.message : 'Username column exists'
                });
            } catch (error: any) {
                results.push({
                    name: 'Username Column Check',
                    status: '❌ Fail',
                    details: error.message
                });
            }

            setTests(results);

            const allPassed = results.every(r => r.status.includes('✅'));
            if (allPassed) {
                setStatus('✅ All tests passed! Connection is working.');
            } else {
                setStatus('❌ Some tests failed. Check details below.');
            }

        } catch (error: any) {
            setStatus('❌ Critical error: ' + error.message);
            setDetails(error);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h1 className="text-3xl font-bold mb-2">Supabase Connection Test</h1>
                    <p className="text-gray-600 mb-4">Testing connection to your Supabase project</p>

                    <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6">
                        <p className="text-lg font-semibold text-blue-900">{status}</p>
                    </div>

                    <div className="space-y-4">
                        {tests.map((test, idx) => (
                            <div key={idx} className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold text-gray-900">{test.name}</h3>
                                    <span className="text-lg">{test.status}</span>
                                </div>
                                <div className="bg-gray-50 p-3 rounded text-sm">
                                    <pre className="whitespace-pre-wrap">
                                        {typeof test.details === 'object'
                                            ? JSON.stringify(test.details, null, 2)
                                            : test.details
                                        }
                                    </pre>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-xl font-bold mb-4">Configuration</h2>
                    <div className="space-y-2 text-sm">
                        <div className="flex">
                            <span className="font-semibold w-32">Supabase URL:</span>
                            <span className="text-gray-600">{process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set'}</span>
                        </div>
                        <div className="flex">
                            <span className="font-semibold w-32">Anon Key:</span>
                            <span className="text-gray-600">
                                {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                                    ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 30)}...`
                                    : 'Not set'
                                }
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <a
                        href="/login"
                        className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Go to Login
                    </a>
                </div>
            </div>
        </div>
    );
}
