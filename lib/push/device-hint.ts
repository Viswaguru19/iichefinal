export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Unknown device';
  const ua = userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iPhone/iPad';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('mac')) return 'Mac';
  if (ua.includes('windows')) return 'Windows';
  return 'Browser';
}
