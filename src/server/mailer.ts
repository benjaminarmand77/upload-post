import nodemailer from 'nodemailer';
export interface Mail { to: string; subject: string; text: string; html?: string }
export function smtpConfigured() { return !!process.env.SMTP_HOST; }
let transport: nodemailer.Transporter | null = null;
export async function sendMail(m: Mail): Promise<{ sent: boolean; preview?: string }> {
  if (!smtpConfigured()) { console.log(`\n📧 [mail → ${m.to}] ${m.subject}\n${m.text}\n`); return { sent: false }; }
  transport ||= nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
  await transport.sendMail({ from: process.env.SMTP_FROM || 'Upload-Post <no-reply@localhost>', to: m.to, subject: m.subject, text: m.text, html: m.html });
  return { sent: true };
}
export function magicLinkEmail(link: string, lang: string) {
  const fr = lang === 'fr';
  return {
    subject: fr ? 'Votre lien de connexion Upload-Post' : 'Your Upload-Post sign-in link',
    text: fr ? `Cliquez pour vous connecter : ${link}\n\nCe lien expire dans 20 minutes.` : `Click to sign in: ${link}\n\nThis link expires in 20 minutes.`,
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:16px"><h2 style="margin:0 0 12px">${fr ? 'Connexion à Upload-Post' : 'Sign in to Upload-Post'}</h2><p style="color:#475569">${fr ? 'Cliquez sur le bouton ci-dessous pour vous connecter. Le lien expire dans 20 minutes.' : 'Click the button below to sign in. The link expires in 20 minutes.'}</p><p style="margin:24px 0"><a href="${link}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${fr ? 'Se connecter' : 'Sign in'}</a></p><p style="color:#94a3b8;font-size:12px">${link}</p></div>`,
  };
}
