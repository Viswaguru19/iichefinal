'use client';

import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import ProfileAppSettings from '@/components/ProfileAppSettings';
import PageHeader from '@/components/PageHeader';
import DashboardAtmosphere from '@/components/react-bits/DashboardAtmosphere';
import GsapText from '@/components/react-bits/GsapText';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Camera, Save } from 'lucide-react';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [portalTheme, setPortalTheme] = useState<'dark-gradient' | 'light-gradient'>('dark-gradient');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadProfile();
    try {
      const saved = localStorage.getItem('portal-theme');
      if (saved === 'light-gradient') setPortalTheme('light-gradient');
    } catch { }
  }, []);

  const applyPortalTheme = (theme: 'dark-gradient' | 'light-gradient') => {
    setPortalTheme(theme);
    try {
      localStorage.setItem('portal-theme', theme);
      document.documentElement.setAttribute('data-portal-theme', theme === 'light-gradient' ? 'light' : 'dark');
    } catch { }
  };

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setProfile(data);
      setName((data as any).name);
      setUsername((data as any).username || '');
      setEmail((data as any).email);
      setDescription((data as any).description || '');
      setPhotoUrl((data as any).avatar_url || '');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let avatarPath = photoUrl;

      if (photo) {
        const fileExt = photo.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, photo, { upsert: true });

        if (uploadError) throw uploadError;

        avatarPath = filePath;
      }

      const updateData: any = {
        name,
        description,
        avatar_url: avatarPath,
      };

      if (username) {
        updateData.username = username;
      }

      const { error } = await (supabase as any)
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      if (email !== profile.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email,
        });
        if (emailError) throw emailError;
      }

      if (password) {
        const { error: pwError } = await supabase.auth.updateUser({
          password,
        });
        if (pwError) throw pwError;
      }

      toast.success('Profile updated successfully!');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return <PortalLoadingScreen message="Loading profile…" variant="home" />;

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl premium-input border border-white/60 bg-white/70 focus:ring-2 focus:ring-teal-500/40 focus:border-teal-400 outline-none transition';

  return (
    <div className="min-h-screen bg-mesh relative overflow-hidden">
      <DashboardAtmosphere />
      <PageHeader title="Edit Profile" gradientTitle />

      <div className="max-w-2xl mx-auto px-4 py-8 relative z-10">
        <div className="mb-6">
          <GsapText
            text="Update your photo, bio, theme, and account details."
            as="p"
            className="text-sm text-gray-500"
            split="words"
            delay={0.12}
            stagger={0.04}
          />
        </div>

        <div className="premium-panel rounded-2xl p-6 sm:p-8 shadow-lg">
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              <div className="w-48 h-48 rounded-full bg-gradient-to-br from-teal-50 to-sky-50 flex items-center justify-center overflow-hidden border-4 border-teal-100/80 shadow-inner">
                {previewUrl ? (
                  <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : photoUrl ? (
                  <img
                    src={supabase.storage.from('avatars').getPublicUrl(photoUrl).data.publicUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-16 h-16 text-teal-300" />
                )}
              </div>
              <label className="absolute bottom-2 right-2 bg-gradient-to-br from-teal-600 to-blue-600 text-white p-3 rounded-full cursor-pointer hover:from-teal-700 hover:to-blue-700 shadow-lg shadow-teal-500/25 transition">
                <Camera className="w-5 h-5" />
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>
            <p className="mt-4 text-sm text-gray-500">Photo displays at about 5cm × 5cm (~190px)</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Portal Theme</label>
              <div className="flex gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => applyPortalTheme('dark-gradient')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    portalTheme === 'dark-gradient'
                      ? 'bg-gray-900 text-white shadow-md'
                      : 'bg-white/70 text-gray-700 hover:bg-white border border-white/80'
                  }`}
                >
                  Black Gradient
                </button>
                <button
                  type="button"
                  onClick={() => applyPortalTheme('light-gradient')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    portalTheme === 'light-gradient'
                      ? 'bg-gradient-to-r from-teal-600 to-blue-600 text-white shadow-md shadow-teal-500/20'
                      : 'bg-white/70 text-gray-700 hover:bg-white border border-white/80'
                  }`}
                >
                  White Gradient
                </button>
              </div>
            </div>

            <ProfileAppSettings />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description / Bio</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Tell us about yourself..."
                className={`${inputClass} resize-none`}
              />
              <p className="mt-1 text-xs text-gray-500">Shown on your public profile</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password (optional)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className={inputClass}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full btn-gradient-blue py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
