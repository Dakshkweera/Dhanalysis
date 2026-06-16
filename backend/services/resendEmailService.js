// backend/services/resendEmailService.js
// Backward-compat re-export — real logic lives in emailService.js
// (This file was the original email service before the rename.)

export {
  sendPortfolioEmail,
  sendTestEmail,
  generatePortfolioEmailMessage,
} from './emailService.js';
