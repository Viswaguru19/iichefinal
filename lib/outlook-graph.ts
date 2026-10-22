import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { tryCreateAdminClient } from '@/lib/supabase/admin';

export const OUTLOOK_REQUIRED_MAILBOX = (
  process.env.OUTLOOK_REQUIRED_MAILBOX || 'IIChE@cb.amrita.edu'
).trim().toLowerCase();

const SCOPES = 'offline_access User.Read Mail.Send';

function tenant() {
  return process.env.MICROSOFT_TENANT_ID?.trim() || 'organizations';
}

function tokenSecret() {
  return (
    process.env.OUTLOOK_TOKEN_SECRET?.trim() ||
    process.env.MICROSOFT_CLIENT_SECRET?.trim() ||
    ''
  );
}

export function outlookEnvReady() {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID?.trim() &&
      process.env.MICROSOFT_CLIENT_SECRET?.trim() &&
      tokenSecret(),
  );
}

export function outlookRedirectUri(origin: string) {
  return `${origin.replace(/\/$/, '')}/api/outlook/callback`;
}

export function outlookAuthorizeUrl(origin: string, state: string, codeChallenge: string) {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID || '',
    response_type: 'code',
    redirect_uri: outlookRedirectUri(origin),
    response_mode: 'query',
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
    login_hint: OUTLOOK_REQUIRED_MAILBOX,
  });
  return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize?${params.toString()}`;
}

export function encryptSecret(value: string) {
  const key = createHash('sha256').update(tokenSecret()).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptSecret(payload: string) {
  const [ivB64, tagB64, dataB64] = String(payload || '').split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Stored Outlook token is invalid');
  const key = createHash('sha256').update(tokenSecret()).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString(
    'utf8',
  );
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function exchangeToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return (await res.json()) as TokenResponse;
}

export async function exchangeOutlookCode(opts: {
  origin: string;
  code: string;
  codeVerifier: string;
}) {
  return exchangeToken(
    new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
      grant_type: 'authorization_code',
      code: opts.code,
      redirect_uri: outlookRedirectUri(opts.origin),
      code_verifier: opts.codeVerifier,
      scope: SCOPES,
    }),
  );
}

async function refreshOutlookToken(refreshToken: string) {
  return exchangeToken(
    new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: SCOPES,
    }),
  );
}

export async function graphMe(accessToken: string) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as {
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(data.error?.message || 'Could not read the Outlook mailbox');
  const mailbox = String(data.mail || data.userPrincipalName || '')
    .trim()
    .toLowerCase();
  return { mailbox, displayName: String(data.displayName || '').trim() };
}

export function mailboxAllowed(mailbox: string) {
  return mailbox.trim().toLowerCase() === OUTLOOK_REQUIRED_MAILBOX;
}

export async function saveOutlookConnection(opts: {
  userId: string;
  mailbox: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) {
  const admin = tryCreateAdminClient();
  if (!admin) throw new Error('Server is missing admin credentials to store the Outlook login');
  const expiresAt = new Date(Date.now() + Math.max(60, opts.expiresIn - 90) * 1000).toISOString();
  const { error } = await admin.from('outlook_mail_connections').upsert(
    {
      user_id: opts.userId,
      mailbox: opts.mailbox.toLowerCase(),
      access_token_enc: encryptSecret(opts.accessToken),
      refresh_token_enc: encryptSecret(opts.refreshToken),
      access_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw new Error(error.message);
}

export async function getOutlookConnectionStatus(userId: string) {
  const admin = tryCreateAdminClient();
  if (!admin) return { connected: false, mailbox: null as string | null, configured: outlookEnvReady() };
  const { data } = await admin
    .from('outlook_mail_connections')
    .select('mailbox')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    connected: Boolean(data?.mailbox),
    mailbox: data?.mailbox ? String(data.mailbox) : null,
    configured: outlookEnvReady(),
    requiredMailbox: OUTLOOK_REQUIRED_MAILBOX,
  };
}

export async function deleteOutlookConnection(userId: string) {
  const admin = tryCreateAdminClient();
  if (!admin) return;
  await admin.from('outlook_mail_connections').delete().eq('user_id', userId);
}

async function accessTokenForUser(userId: string) {
  const admin = tryCreateAdminClient();
  if (!admin) throw new Error('Server is missing admin credentials for Outlook');
  const { data, error } = await admin
    .from('outlook_mail_connections')
    .select('mailbox, access_token_enc, refresh_token_enc, access_expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) throw new Error('Outlook is not connected. Sign in with IIChE@cb.amrita.edu first.');
  if (!mailboxAllowed(String(data.mailbox || ''))) {
    throw new Error(`Connect the chapter mailbox ${OUTLOOK_REQUIRED_MAILBOX}, not ${data.mailbox}.`);
  }

  const expiresAt = new Date(data.access_expires_at || 0).getTime();
  if (expiresAt > Date.now() + 30_000) {
    return { token: decryptSecret(data.access_token_enc), mailbox: String(data.mailbox) };
  }

  const refreshed = await refreshOutlookToken(decryptSecret(data.refresh_token_enc));
  if (!refreshed.access_token) {
    throw new Error(refreshed.error_description || 'Outlook sign-in expired. Connect Outlook again.');
  }
  await saveOutlookConnection({
    userId,
    mailbox: String(data.mailbox),
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || decryptSecret(data.refresh_token_enc),
    expiresIn: Number(refreshed.expires_in) || 3600,
  });
  return { token: refreshed.access_token, mailbox: String(data.mailbox) };
}

export type OutlookFileAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export async function sendOutlookMail(opts: {
  userId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: OutlookFileAttachment[];
}) {
  const { token } = await accessTokenForUser(opts.userId);
  const message: Record<string, unknown> = {
    subject: opts.subject,
    body: { contentType: 'HTML', content: opts.html },
    toRecipients: [{ emailAddress: { address: opts.to } }],
  };
  if (opts.attachments?.length) {
    message.attachments = opts.attachments.map((file) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: file.filename,
      contentType: file.contentType,
      contentBytes: file.content.toString('base64'),
    }));
  }

  let lastError = 'Failed to send via Outlook';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });
    if (res.ok || res.status === 202) return { success: true as const };
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    lastError = data.error?.message || `Outlook send failed (${res.status})`;
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const wait = Number(res.headers.get('Retry-After') || '') || 600 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, wait));
      continue;
    }
    break;
  }
  return { success: false as const, error: lastError };
}
