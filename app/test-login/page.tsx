'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function TestLogin() {
  const [email, setEmail] = useState('sahana@iicheavvu.com');
  const [password, setPassword] = useState('test123');
  const [result, setResult] = useState('');
  const supabase = createClient();

  const testLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (error) {
        setResult(`Error: ${error.message}`);
      } else {
        setResult(`Success! User: ${data.user?.email}`);
      }
    } catch (err: any) {
      setResult(`Catch error: ${err.message}`);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Login</h1>
      
      <div className="space-y-4 max-w-md">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full p-2 border rounded"
        />
        
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full p-2 border rounded"
        />
        
        <button
          onClick={testLogin}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Test Login
        </button>
        
        {result && (
          <div className="p-4 bg-gray-100 rounded">
            <pre>{result}</pre>
          </div>
        )}
      </div>
    </div>
  );
}