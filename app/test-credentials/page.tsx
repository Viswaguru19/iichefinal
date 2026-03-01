import { createClient } from '@/lib/supabase/server';

export default async function TestCredentials() {
  const supabase = await createClient();
  
  const { data: users } = await supabase.auth.admin.listUsers();
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Login Credentials</h1>
      <p className="mb-4">Password for all users: <code className="bg-gray-200 px-2 py-1">iichelogin</code></p>
      
      <div className="grid gap-2">
        {users?.users.map(user => (
          <div key={user.id} className="p-2 border rounded">
            <strong>Email:</strong> {user.email}
          </div>
        ))}
      </div>
    </div>
  );
}