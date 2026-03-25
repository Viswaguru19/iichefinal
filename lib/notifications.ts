import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY || '');
  }
  return resend;
}

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'IIChE AVVU SC Portal <noreply@iicheavvu.in>',
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error };
  }
}
