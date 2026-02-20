/**
 * PM2 ecosystem configuration — Settlement Sam
 *
 * Usage:
 *   pm2 start deployment/ecosystem.config.js --env production
 *   pm2 save
 *   pm2 startup   (follow the printed command to enable on boot)
 *
 * Commands:
 *   pm2 list         — see running apps
 *   pm2 logs sam     — tail logs
 *   pm2 restart sam  — zero-downtime restart
 *   pm2 reload sam   — graceful reload
 *   pm2 stop sam     — stop
 *   pm2 delete sam   — remove from PM2
 */

module.exports = {
  apps: [
    {
      name:             'sam',
      script:           'node_modules/.bin/next',
      args:             'start',
      cwd:              '/var/www/settlement-sam',          // change to your deploy path
      instances:        'max',                              // cluster mode — one per CPU core
      exec_mode:        'cluster',
      watch:            false,
      max_memory_restart: '512M',

      // Node flags
      node_args: '--no-warnings',                          // suppress experimental-sqlite notice

      // Environment — production
      env_production: {
        NODE_ENV:              'production',
        PORT:                  3000,

        // Copy these from your .env file (or use a secrets manager)
        // DATABASE_PATH:      '/var/www/settlement-sam/db/settlement_sam.db',
        // JWT_SECRET:         'your-long-random-secret',
        // ADMIN_EMAIL:        'admin@yourdomain.com',
        // ADMIN_HASH:         '$2b$12$...',
        // GMAIL_USER:         'your@gmail.com',
        // GMAIL_APP_PASSWORD: 'xxxx xxxx xxxx xxxx',
        // GOOGLE_SERVICE_ACCOUNT_EMAIL: 'sam@project.iam.gserviceaccount.com',
        // GOOGLE_SERVICE_ACCOUNT_KEY:   '-----BEGIN PRIVATE KEY-----\\n...',
        // STRIPE_SECRET_KEY:  'sk_live_...',
        // STRIPE_WEBHOOK_SECRET: 'whsec_...',
        // NEXT_PUBLIC_APP_URL: 'https://yourdomain.com',
      },

      // Logging
      out_file:   '/var/log/pm2/sam-out.log',
      error_file: '/var/log/pm2/sam-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      log_type: 'json',

      // Auto-restart policy
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
