const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;
const { getDb } = require('../db/database');

class EmailService {
  constructor() {
    this.transporter = null;
  }

  async initialize() {
    const db = getDb();
    const settings = db.prepare(`
      SELECT key, value FROM settings 
      WHERE key IN (
        'smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_secure',
        'smtp_user', 'smtp_password', 'smtp_from_email', 'smtp_from_name'
      )
    `).all();

    const config = {};
    settings.forEach(setting => {
      config[setting.key] = setting.value;
    });

    if (config.smtp_enabled !== 'true') {
      console.log('SMTP is disabled in settings');
      return false;
    }

    if (!config.smtp_host || !config.smtp_port) {
      console.error('SMTP configuration incomplete');
      return false;
    }

    try {
      const transportConfig = {
        host: config.smtp_host,
        port: parseInt(config.smtp_port),
        secure: config.smtp_secure === 'ssl',
        auth: config.smtp_user && config.smtp_password ? {
          user: config.smtp_user,
          pass: config.smtp_password
        } : undefined
      };

      if (config.smtp_secure === 'tls') {
        transportConfig.requireTLS = true;
      }

      this.transporter = nodemailer.createTransport(transportConfig);
      this.fromEmail = config.smtp_from_email || config.smtp_user;
      this.fromName = config.smtp_from_name || 'Novelarr';

      await this.transporter.verify();
      console.log('Email service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.transporter = null;
      return false;
    }
  }

  async sendToKindle(userEmail, kindleEmail, bookPath, bookTitle, bookAuthor) {
    if (!this.transporter) {
      await this.initialize();
      if (!this.transporter) {
        throw new Error('Email service not configured');
      }
    }

    const db = getDb();
    const kindleSettings = db.prepare(`
      SELECT value FROM settings 
      WHERE key IN ('kindle_enabled', 'kindle_email_domain')
    `).all();

    const kindleEnabled = kindleSettings.find(s => s.key === 'kindle_enabled')?.value === 'true';
    if (!kindleEnabled) {
      throw new Error('Send to Kindle is disabled');
    }

    if (!kindleEmail.includes('@')) {
      const domain = kindleSettings.find(s => s.key === 'kindle_email_domain')?.value || '@kindle.com';
      kindleEmail = kindleEmail + domain;
    }

    try {
      const bookData = await fs.readFile(bookPath);
      const fileName = path.basename(bookPath);

      const mailOptions = {
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: kindleEmail,
        subject: 'Send to Kindle',
        text: `Book: ${bookTitle} by ${bookAuthor}\n\nSent from Novelarr to your Kindle device.`,
        attachments: [{
          filename: fileName,
          content: bookData
        }]
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Book sent to Kindle:', info.messageId);
      return info;
    } catch (error) {
      console.error('Failed to send to Kindle:', error);
      throw error;
    }
  }

  async testConnection() {
    if (!this.transporter) {
      await this.initialize();
      if (!this.transporter) {
        return { success: false, error: 'Email service not configured' };
      }
    }

    try {
      await this.transporter.verify();
      return { success: true, message: 'SMTP connection successful' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();