import { redirect } from 'next/navigation';

/** Legacy portal chat URL → dedicated chat app. */
export default function DashboardChatRedirect({
  searchParams,
}: {
  searchParams: { user?: string; group?: string };
}) {
  const q = new URLSearchParams();
  if (searchParams.user) q.set('user', searchParams.user);
  if (searchParams.group) q.set('group', searchParams.group);
  const qs = q.toString();
  redirect(qs ? `/chat?${qs}` : '/chat');
}
