// backend/services/resendEmailService.js
// Transactional email via Gmail SMTP (nodemailer).

import nodemailer from 'nodemailer';
import config from '../config/env.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.GMAIL_USER,
    pass: config.GMAIL_APP_PASSWORD,
  },
});

// ── Email template ────────────────────────────────────────────────────────────

export const generatePortfolioEmailMessage = (snapshot, userName = 'User') => {
  const date = new Date(snapshot.date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const dailyChange  = snapshot.dailyChange;
  const pl           = snapshot.profitLoss ?? 0;
  const roi          = snapshot.roi ?? 0;
  const cagr         = snapshot.cagr ?? 0;
  const plSign       = pl  >= 0 ? '+' : '';
  const roiSign      = roi >= 0 ? '+' : '';
  const dayVal       = dailyChange?.portfolioValue ?? 0;
  const dayPct       = dailyChange?.percentage ?? 0;
  const daySign      = dayVal >= 0 ? '+' : '';
  const mktVal       = dailyChange?.marketChange ?? 0;
  const mktPct       = dailyChange?.marketChangePercentage ?? 0;
  const mktSign      = mktVal >= 0 ? '+' : '';
  const plColor      = pl  >= 0 ? '#16a34a' : '#dc2626';
  const dayColor     = dayVal >= 0 ? '#16a34a' : '#dc2626';
  const mktColor     = mktVal >= 0 ? '#16a34a' : '#dc2626';

  const best  = snapshot.topPerformers?.best;
  const worst = snapshot.topPerformers?.worst;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">📊 Dhanalysis</h1>
          <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Daily Portfolio Report · ${date}</p>
        </td>
      </tr>

      <!-- Greeting -->
      <tr>
        <td style="padding:28px 40px 0;">
          <p style="margin:0;font-size:16px;color:#374151;">Hi <strong>${userName}</strong>,</p>
          <p style="margin:8px 0 0;font-size:14px;color:#6b7280;">Here's your portfolio snapshot for today.</p>
        </td>
      </tr>

      <!-- Portfolio Value Card -->
      <tr>
        <td style="padding:24px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
            <tr>
              <td style="padding:20px 24px;">
                <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Current Portfolio Value</p>
                <p style="margin:6px 0 0;font-size:30px;font-weight:700;color:#0f172a;">₹${snapshot.portfolioValue.toLocaleString('en-IN')}</p>
                ${dailyChange ? `
                <p style="margin:6px 0 0;font-size:14px;color:${dayColor};font-weight:600;">
                  ${daySign}₹${Math.abs(dayVal).toLocaleString('en-IN')} (${daySign}${dayPct}%) today
                </p>` : '<p style="margin:6px 0 0;font-size:13px;color:#9ca3af;">First day — no comparison yet</p>'}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Stats Row -->
      <tr>
        <td style="padding:16px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <!-- Total Invested -->
              <td width="33%" style="padding-right:8px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                  <tr><td style="padding:16px;">
                    <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;">Invested</p>
                    <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0f172a;">₹${snapshot.totalInvested.toLocaleString('en-IN')}</p>
                  </td></tr>
                </table>
              </td>
              <!-- P&L -->
              <td width="33%" style="padding:0 4px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                  <tr><td style="padding:16px;">
                    <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;">P&amp;L</p>
                    <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${plColor};">${plSign}₹${Math.abs(pl).toLocaleString('en-IN')}</p>
                    <p style="margin:2px 0 0;font-size:12px;color:${plColor};">${roiSign}${roi}%</p>
                  </td></tr>
                </table>
              </td>
              <!-- CAGR -->
              <td width="33%" style="padding-left:8px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                  <tr><td style="padding:16px;">
                    <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;">CAGR</p>
                    <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0f172a;">${cagr}%</p>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Market Performance -->
      ${dailyChange ? `
      <tr>
        <td style="padding:16px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Market Movement Today</p>
              <p style="margin:6px 0 0;font-size:15px;font-weight:600;color:${mktColor};">
                ${mktSign}₹${Math.abs(mktVal).toLocaleString('en-IN')} (${mktSign}${mktPct}%)
              </p>
              ${dailyChange.newCapitalAdded !== 0 ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">New capital added: ₹${Math.abs(dailyChange.newCapitalAdded).toLocaleString('en-IN')}</p>` : ''}
            </td></tr>
          </table>
        </td>
      </tr>` : ''}

      <!-- Top Performers -->
      ${best || worst ? `
      <tr>
        <td style="padding:16px 40px 0;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">🏆 Top Performers</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${best ? `
              <td width="50%" style="padding-right:8px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
                  <tr><td style="padding:14px 16px;">
                    <p style="margin:0;font-size:11px;color:#16a34a;font-weight:600;">BEST</p>
                    <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#0f172a;">${best.symbol}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#16a34a;font-weight:600;">+${best.roi}% ROI</p>
                  </td></tr>
                </table>
              </td>` : ''}
              ${worst ? `
              <td width="50%" style="padding-left:8px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
                  <tr><td style="padding:14px 16px;">
                    <p style="margin:0;font-size:11px;color:#dc2626;font-weight:600;">NEEDS ATTENTION</p>
                    <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#0f172a;">${worst.symbol}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#dc2626;font-weight:600;">${worst.roi}% ROI</p>
                  </td></tr>
                </table>
              </td>` : ''}
            </tr>
          </table>
        </td>
      </tr>` : ''}

      <!-- Footer -->
      <tr>
        <td style="padding:32px 40px;">
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;">
          <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
            This is an automated daily report from <strong>Dhanalysis</strong>.<br>
            To stop receiving emails, update your notification preferences in Settings.
          </p>
          <p style="margin:12px 0 0;font-size:13px;color:#9ca3af;text-align:center;">Happy Investing! 📊</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  return html;
};

// ── Send portfolio email ──────────────────────────────────────────────────────

export const sendPortfolioEmail = async (userEmail, userName, snapshot) => {
  try {
    const html = generatePortfolioEmailMessage(snapshot, userName);
    const dateLabel = new Date(snapshot.date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });

    await transporter.sendMail({
      from:    `${config.EMAIL_FROM_NAME || 'Dhanalysis'} <${config.GMAIL_USER}>`,
      to:      userEmail,
      subject: `📊 Portfolio Update — ${dateLabel}`,
      html,
    });

    console.log(`✅ Email sent to ${userEmail}`);
    return { success: true };
  } catch (err) {
    console.error(`❌ sendPortfolioEmail failed for ${userEmail}:`, err.message);
    return { success: false, error: err.message };
  }
};

// ── Test email ────────────────────────────────────────────────────────────────

export const sendTestEmail = async (toEmail) => {
  try {
    await transporter.sendMail({
      from:    `${config.EMAIL_FROM_NAME || 'Dhanalysis'} <${config.GMAIL_USER}>`,
      to:      toEmail,
      subject: '🧪 Dhanalysis — Email test',
      html:    '<p style="font-family:sans-serif;">If you received this, <strong>Gmail SMTP</strong> is configured correctly. ✅</p>',
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
