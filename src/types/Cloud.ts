export enum CloudCredentialsEnvKey {
  EV_DATABASE_KEY = 'evDBKey',
  SMTP_USERNAME = 'smtpUsername',
  SMTP_PASSWORD = 'smtpPassword',
  SMTP_BACKUP_USERNAME = 'smtpBackupUsername',
  SMTP_BACKUP_PASSWORD = 'smtpBackupPassword',
  USER_TOKEN_KEY = 'userTokenKey',
  CAPTCHA_SECRET_KEY = 'captchaSecretKey',
  CRYPTO_KEY = 'cryptoKey',
  FIREBASE_PRIVATE_KEY_ID = 'firebasePrivateKeyID',
  FIREBASE_PRIVATE_KEY = 'firebasePrivateKey'
}

export type CloudCredentials = Record<CloudCredentialsEnvKey, string>;
