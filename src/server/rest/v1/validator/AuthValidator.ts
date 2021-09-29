import { HttpCheckEulaRequest, HttpEulaRequest, HttpLoginRequest, HttpRegisterUserRequest, HttpResendVerificationMailRequest, HttpResetPasswordRequest, HttpVerifyEmailRequest } from '../../../../types/requests/HttpUserRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class AuthValidator extends SchemaValidator {
  private static instance: AuthValidator|null = null;
  private authSignIn: Schema;
  private authSignOn: Schema;
  private authPasswordReset: Schema;
  private authEulaCheck: Schema;
  private authEmailVerify: Schema;
  private authVerificationEmailResend: Schema;
  private authEula: Schema;

  private constructor() {
    super('AuthValidator');
    this.authSignIn = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-signin.json`, 'utf8'));
    this.authSignOn = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-signon.json`, 'utf8'));
    this.authPasswordReset = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-password-reset.json`, 'utf8'));
    this.authEulaCheck = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-eula-check.json`, 'utf8'));
    this.authEmailVerify = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-email-verify.json`, 'utf8'));
    this.authVerificationEmailResend = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-verification-email-resend.json`, 'utf8'));
    this.authEula = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-eula.json`, 'utf8'));
  }

  public static getInstance(): AuthValidator {
    if (!AuthValidator.instance) {
      AuthValidator.instance = new AuthValidator();
    }
    return AuthValidator.instance;
  }

  public validateAuthSignInReq(data: unknown): HttpLoginRequest {
    return this.validate('validateAuthSignInReq', this.authSignIn, data);
  }

  public validateAuthSignOnReq(data: unknown): Partial<HttpRegisterUserRequest> {
    return this.validate('validateAuthSignOnReq', this.authSignOn, data);
  }

  public validateAuthPasswordResetReq(data: unknown): Partial<HttpResetPasswordRequest> {
    return this.validate('validateAuthPasswordResetReq', this.authPasswordReset, data);
  }

  public validateAuthEulaCheckReq(data: unknown): Partial<HttpCheckEulaRequest> {
    return this.validate('validateAuthEulaCheckReq', this.authEulaCheck, data);
  }

  public validateAuthEmailVerifyReq(data: unknown): Partial<HttpVerifyEmailRequest> {
    return this.validate('validateAuthEmailVerifyReq', this.authEmailVerify, data);
  }

  public validateAuthVerificationEmailResendReq(data: unknown): Partial<HttpResendVerificationMailRequest> {
    return this.validate('validateAuthVerificationEmailResendReq', this.authVerificationEmailResend, data);
  }

  public validateAuthEulaReq(data: unknown): Partial<HttpEulaRequest> {
    return this.validate('validateAuthEulaReq', this.authEula, data);
  }
}
