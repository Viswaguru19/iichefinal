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
  }>;
  headers?: Record<string, string>;
};

export async function sendEmail(to: string, subject: string, html: string, options?: SendEmailOptions) {
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
      attachments: options?.attachments,
      headers: {
        'List-Unsubscribe': `<mailto:${process.env.RESEND_REPLY_TO || 'admin@iicheavvu.in'}>`,
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
