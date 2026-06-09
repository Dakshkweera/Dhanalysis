// backend/services/emailService.js
// Re-exports from resendEmailService so all existing import sites keep working.

export {
  sendPortfolioEmail,
  sendTestEmail,
  generatePortfolioEmailMessage,
} from './resendEmailService.js';
