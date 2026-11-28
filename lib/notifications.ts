import nodemailer from 'nodemailer';
import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY || '');
  }
  return resend;
}

export type SendEmailOptions = {
  text?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
    contentId?: string;
  }>;
  headers?: Record<string, string>;
};

function isRetryableEmailError(error?: string) {
  const message = String(error || '').toLowerCase();
  return (
    message.includes('429') ||
    message.includes('rate') ||
    message.includes('too many') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('fetch failed') ||
    message.includes('econnreset') ||
    message.includes('503') ||
    message.includes('502')
  );
}

export async function sendEmailWithRetry(
  to: string,
  subject: string,
  html: string,
  options?: SendEmailOptions,
  attempts = 4,
) {
  let last: { success: boolean; error?: string } = { success: false, error: 'Failed to send email' };
  for (let i = 0; i < attempts; i += 1) {
    last = await sendEmail(to, subject, html, options);
    if (last.success) return last;
    if (i < attempts - 1 && isRetryableEmailError(last.error)) {
      await new Promise((resolve) => setTimeout(resolve, 600 * (i + 1)));
      continue;
    }
    break;
  }
  return last;
}

function smtpHost() {
  return process.env.SMTP_HOST?.trim() || '';
}

function sendViaSmtp() {
  return Boolean(smtpHost());
}

async function sendEmailViaSmtp(to: string, subject: string, html: string, options?: SendEmailOptions) {
  const user = process.env.SMTP_USER?.trim() || '';
  const pass = process.env.SMTP_PASSWORD?.trim() || '';
  if (!user || !pass) {
    const error = 'SMTP_USER and SMTP_PASSWORD are required. Add the mailbox password to .env.local and restart the server.';
    console.error('Email send error:', error);
    return { success: false, error };
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const from = process.env.SMTP_FROM?.trim() || user;
  const replyTo = options?.replyTo || process.env.SMTP_REPLY_TO?.trim() || user;

  try {
    const transport = nodemailer.createTransport({
      host: smtpHost(),
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transport.sendMail({
      from,
      to,
      replyTo,
      subject,
      html,
      text: options?.text,
      headers: {
        'List-Unsubscribe': `<mailto:${replyTo}>`,
        ...options?.headers,
      },
      attachments: options?.attachments?.map((file) => ({
        filename: file.filename,
        content: file.content,
        contentType: file.contentType,
        cid: file.contentId,
      })),
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email';
    console.error('Email send error:', message);
    return { success: false, error: message };
  }
}

export async function sendEmail(to: string, subject: string, html: string, options?: SendEmailOptions) {
  if (sendViaSmtp()) return sendEmailViaSmtp(to, subject, html, options);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const error = 'RESEND_API_KEY is missing. Add it to .env.local and restart the server.';
    console.error('Email send error:', error);
    return { success: false, error };
  }

  try {
    const { error } = await getResend().emails.send({
      from:
        process.env.RESEND_FROM_EMAIL ||
        'IIChE AVVU Student Chapter <notifications@iicheavvu.in>',
      to,
      replyTo: options?.replyTo || process.env.RESEND_REPLY_TO || 'admin@iicheavvu.in',
      subject,
      html,
      text: options?.text,
      attachments: options?.attachments?.map((file) => ({
        filename: file.filename,
        content: file.content,
        contentType: file.contentType,
        content_id: file.contentId,
        contentId: file.contentId,
      })),
      headers: {
        'List-Unsubscribe': `<mailto:${process.env.RESEND_REPLY_TO || 'admin@iicheavvu.in'}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        ...options?.headers,
      },
    });
    if (error) {
      const message = typeof error === 'string' ? error : error.message || JSON.stringify(error);
      console.error('Email send error:', message);
      return { success: false, error: message };
    }
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email';
    console.error('Email send error:', message);
    return { success: false, error: message };
  }
}
