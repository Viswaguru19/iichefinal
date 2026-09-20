'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Save, Search, User } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import DashboardAtmosphere from '@/components/react-bits/DashboardAtmosphere';
import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { createClient } from '@/lib/supabase/client';
import { canEditOtherMemberProfiles, memberAvatarSrc } from '@/lib/member-profile-edit';

type MemberRow = {
  id: string;
  name: string | null;
  email: string | null;
  username?: string | null;
  description?: string | null;
  avatar_url?: string | null;
  profile_photo?: string | null;
  committee_members?: { position?: string | null; committees?: { name?: string | null } | null }[];
};

export default function MemberProfilesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const selected = members.find((m) => m.id === selectedId) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const committees = (m.committee_members || [])
        .map((c) => c.committees?.name || '')
        .join(' ');
      return `${m.name || ''} ${m.email || ''} ${m.username || ''} ${committees}`.toLowerCase().includes(q);
    });
  }, [members, query]);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name || '');
    setDescription(selected.description || '');
    setPhotoFile(null);
    setPreviewUrl(null);
  }, [selectedId]);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const [{ data: profile }, { data: memberships }] = await Promise.all([
      supabase.from('profiles').select('is_admin, role').eq('id', user.id).maybeSingle(),
      supabase.from('committee_members').select('committees(name)').eq('user_id', user.id),
    ]);

    if (!canEditOtherMemberProfiles(profile, memberships as { committees?: { name?: string } }[])) {
      toast.error('Only Graphics committee or admins can edit member profiles');
      router.push('/dashboard');
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, username, description, avatar_url, profile_photo, committee_members(position, committees(name))')
      .order('name');

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setMembers((data || []) as MemberRow[]);
    setLoading(false);
  }

  function onPickPhoto(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      let avatarPath = selected.avatar_url || '';
      let profilePhoto = selected.profile_photo || '';

      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg';
        const filePath = `${selected.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, photoFile, { upsert: true });
        if (upErr) throw upErr;
        avatarPath = filePath;
        profilePhoto = supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          name: name.trim() || selected.name,
          description: description.trim() || null,
          avatar_url: avatarPath || null,
          profile_photo: profilePhoto || null,
        })
        .eq('id', selected.id);

      if (error) throw error;
      toast.success(`Updated ${name.trim() || 'member'} profile`);
      setPhotoFile(null);
      await load();
      setSelectedId(selected.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PortalLoadingScreen message="Loading member profiles…" variant="home" />;

  const currentPhoto = previewUrl || (selected ? memberAvatarSrc(supabase, selected.avatar_url, selected.profile_photo) : null);

  return (
    <div className="min-h-screen bg-mesh relative overflow-hidden">
      <DashboardAtmosphere />
      <PageHeader title="Member profiles" gradientTitle />

      <div className="max-w-6xl mx-auto px-4 py-8 relative z-10 grid md:grid-cols-[280px_minmax(0,1fr)] gap-6">
        <div className="premium-panel rounded-2xl p-4 h-fit">
          <label className="relative block mb-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl premium-input border border-white/60 bg-white/70 outline-none"
            />
          </label>
          <div className="max-h-[70vh] overflow-y-auto space-y-1">
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={`w-full text-left rounded-xl px-3 py-2.5 transition ${
                  selectedId === m.id ? 'bg-teal-600 text-white' : 'hover:bg-white/70'
                }`}
              >
                <p className="font-semibold truncate">{m.name || 'Unnamed'}</p>
                <p className={`text-xs truncate ${selectedId === m.id ? 'text-white/80' : 'text-gray-500'}`}>
                  {m.committee_members?.[0]?.committees?.name || m.email}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="premium-panel rounded-2xl p-6 sm:p-8">
          {!selected ? (
            <div className="text-center py-16 text-gray-500">
              <User className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Pick a member to add their photo and public profile.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-40 h-40 rounded-2xl overflow-hidden border-4 border-teal-100 bg-gradient-to-br from-teal-50 to-sky-50 flex items-center justify-center">
                    {currentPhoto ? (
                      <img src={currentPhoto} alt={selected.name || 'Member'} className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-12 h-12 text-teal-300" />
                    )}
                  </div>
                  <label className="absolute bottom-2 right-2 bg-gradient-to-br from-teal-600 to-blue-600 text-white p-3 rounded-full cursor-pointer shadow-lg">
                    <Camera className="w-5 h-5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onPickPhoto(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
                <p className="mt-3 text-sm text-gray-500">{selected.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl premium-input border border-white/60 bg-white/70 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Shown on the public profile and committees page"
                  className="w-full px-4 py-2.5 rounded-xl premium-input border border-white/60 bg-white/70 outline-none resize-none"
                />
              </div>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="w-full btn-gradient-blue py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
