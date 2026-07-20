import fs from 'fs';
import path from 'path';

const files = [
  'app/dashboard/forms/page.tsx',
  'app/dashboard/forms/[id]/edit/page.tsx',
  'app/dashboard/forms/[id]/responses/page.tsx',
  'app/dashboard/forms/[id]/page.tsx',
  'app/dashboard/chat/page.tsx',
  'app/dashboard/tasks/page.tsx',
  'app/dashboard/meetings/page.tsx',
  'app/dashboard/past-events/page.tsx',
  'app/dashboard/proposals/page.tsx',
  'app/dashboard/meetings/[id]/page.tsx',
  'app/dashboard/events/workflow/page.tsx',
  'app/dashboard/accounts/page.tsx',
  'app/dashboard/kickoff/page.tsx',
  'app/dashboard/faculty/page.tsx',
  'app/dashboard/profile/page.tsx',
];

const block =
  /if \(loading\) \{\s*return \(\s*<div className="min-h-screen bg-mesh flex items-center justify-center">[\s\S]*?<\/div>\s*\);\s*\}/;

for (const f of files) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('animate-pulse-glow') && !s.includes('Loading...</div>')) continue;

  if (!s.includes('PortalLoadingScreen')) {
    s = s.replace(
      /^('use client';\n\n)/,
      "$1import PortalLoadingScreen from '@/components/PortalLoadingScreen';\n",
    );
    if (!s.includes('PortalLoadingScreen')) {
      s = s.replace(/^import /m, "import PortalLoadingScreen from '@/components/PortalLoadingScreen';\nimport ");
    }
  }

  const msg = f.includes('forms')
    ? 'Loading forms…'
    : f.includes('chat')
      ? 'Opening chat…'
      : f.includes('tasks')
        ? 'Loading tasks…'
        : f.includes('meetings')
          ? 'Loading meetings…'
          : f.includes('proposals')
            ? 'Loading proposals…'
            : f.includes('profile')
              ? 'Loading profile…'
              : f.includes('faculty')
                ? 'Loading faculty dashboard…'
                : f.includes('accounts')
                  ? 'Loading accounts…'
                  : 'Loading…';

  if (block.test(s)) {
    s = s.replace(block, `if (loading) return <PortalLoadingScreen message="${msg}" />;`);
  }

  s = s.replace(
    /return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading\.\.\.<\/div>/g,
    `return <PortalLoadingScreen message="${msg}" />`,
  );

  fs.writeFileSync(p, s);
  console.log('updated', f);
}
