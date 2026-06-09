// backend/services/otpEmailService.js
// Sends OTP verification emails via Gmail SMTP.

import nodemailer from 'nodemailer';
import config from '../config/env.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.GMAIL_USER,
    pass: config.GMAIL_APP_PASSWORD,
  },
});

export const sendOtpEmail = async (toEmail, otp) => {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">📊 Dhanalysis</h1>
          <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Email Verification</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:36px 40px;">
          <p style="margin:0;font-size:16px;color:#374151;">Hi there,</p>
          <p style="margin:12px 0 0;font-size:15px;color:#6b7280;line-height:1.6;">
            Use the OTP below to verify your email address. It expires in <strong>10 minutes</strong>.
          </p>

          <!-- OTP Box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
            <tr>
              <td align="center">
                <div style="display:inline-block;background:#f0f9ff;border:2px dashed #3b82f6;border-radius:12px;padding:20px 40px;">
                  <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:2px;">Your OTP</p>
                  <p style="margin:8px 0 0;font-size:42px;font-weight:800;color:#1e40af;letter-spacing:10px;">${otp}</p>
                </div>
              </td>
            </tr>
          </table>

          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
            ⚠️ Never share this OTP with anyone. Dhanalysis will never ask for it.<br>
            If you didn't request this, please ignore this email.
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">© 2026 Dhanalysis · Secure Portfolio Analytics</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  await transporter.sendMail({
    from:    `Dhanalysis <${config.GMAIL_USER}>`,
    to:      toEmail,
    subject: '🔐 Your Dhanalysis verification code',
    html,
  });

  console.log(`✅ OTP email sent to ${toEmail}`);
};
