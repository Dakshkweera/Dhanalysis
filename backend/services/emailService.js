import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configure email transporter (Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// Verify transporter configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email configuration error:', error.message);
  } else {
    console.log('✅ Email service ready to send messages');
  }
});

// Generate portfolio email message
export const generatePortfolioEmailMessage = (snapshot, userName = 'User') => {
  const date = new Date(snapshot.date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  const dailyChange = snapshot.dailyChange;
  const changeSymbol = dailyChange?.portfolioValue >= 0 ? '+' : '';
  const marketSymbol = dailyChange?.marketChange >= 0 ? '+' : '';
  
  const message = `
Hi ${userName},

Here's your portfolio update for ${date}:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 PORTFOLIO SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Value: ₹${snapshot.portfolioValue.toLocaleString('en-IN')}
${dailyChange ? `Today's Change: ${changeSymbol}₹${dailyChange.portfolioValue.toLocaleString('en-IN')} (${changeSymbol}${dailyChange.percentage}%)` : 'No previous data for comparison'}

${dailyChange && dailyChange.newCapitalAdded !== 0 ? `
💰 New Capital: ${dailyChange.newCapitalAdded >= 0 ? '+' : ''}₹${Math.abs(dailyChange.newCapitalAdded).toLocaleString('en-IN')}
📈 Market Performance: ${marketSymbol}₹${dailyChange.marketChange.toLocaleString('en-IN')} (${marketSymbol}${dailyChange.marketChangePercentage}%)
` : dailyChange ? `
📈 Market Performance: ${marketSymbol}₹${dailyChange.marketChange.toLocaleString('en-IN')} (${marketSymbol}${dailyChange.marketChangePercentage}%)
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 OVERALL PERFORMANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Invested: ₹${snapshot.totalInvested.toLocaleString('en-IN')}
Total P/L: ${snapshot.profitLoss >= 0 ? '+' : ''}₹${snapshot.profitLoss.toLocaleString('en-IN')} (${snapshot.roi >= 0 ? '+' : ''}${snapshot.roi}%)
CAGR: ${snapshot.cagr}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 TOP PERFORMERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${snapshot.topPerformers.best ? `Best: ${snapshot.topPerformers.best.symbol} (${snapshot.topPerformers.best.roi >= 0 ? '+' : ''}${snapshot.topPerformers.best.roi}%)` : 'N/A'}
${snapshot.topPerformers.worst ? `Worst: ${snapshot.topPerformers.worst.symbol} (${snapshot.topPerformers.worst.roi >= 0 ? '+' : ''}${snapshot.topPerformers.worst.roi}%)` : 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is an automated daily report.
If you wish to stop receiving these emails, please update your notification preferences.

Happy Investing! 📊
Investment Tracker Team
  `.trim();
  
  return message;
};

// Send email notification
export const sendPortfolioEmail = async (userEmail, userName, snapshot) => {
  try {
    const message = generatePortfolioEmailMessage(snapshot, userName);
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `📊 Portfolio Update - ${new Date(snapshot.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
      text: message
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Email sent to ${userEmail} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error(`❌ Failed to send email to ${userEmail}:`, error.message);
    return { success: false, error: error.message };
  }
};

// Test email function (for testing setup)
export const sendTestEmail = async (toEmail) => {
  try {
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: '🧪 Test Email - Investment Tracker',
      text: 'This is a test email from your Investment Tracker backend. If you received this, email service is working correctly! ✅'
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully:', info.messageId);
    return { success: true };
    
  } catch (error) {
    console.error('❌ Test email failed:', error.message);
    return { success: false, error: error.message };
  }
};

export default transporter;
