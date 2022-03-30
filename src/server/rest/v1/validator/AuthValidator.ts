import { HttpCheckEulaRequest, HttpEulaRequest, HttpLoginRequest, HttpRegisterUserRequest, HttpResendVerificationMailRequest, HttpResetPasswordRequest, HttpVerifyEmailRequest } from '../../../../types/requests/HttpUserRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class AuthValidator extends SchemaValidator {
  private static instance: AuthValidator | null = null;
  private authSignIn: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-signin.json`, 'utf8'));
  private authSignOn: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-signon.json`, 'utf8'));
  private authPasswordReset: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-password-reset.json`, 'utf8'));
  private authEulaCheck: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-eula-check.json`, 'utf8'));
  private authEmailVerify: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-email-verify.json`, 'utf8'));
  private authVerificationEmailResend: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-verification-email-resend.json`, 'utf8'));
  private authEula: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-eula.json`, 'utf8'));

  private constructor() {
    super('AuthValidator', {
      strict: true, // When 'true', it fails with anyOf required fields: https://github.com/ajv-validator/ajv/issues/1571
      allErrors: true,
      removeAdditional: true, // 'all' fails with anyOf documents: Manually added 'additionalProperties: false' in schema due filtering of data in anyOf/oneOf/allOf array (it's standard): https://github.com/ajv-validator/ajv/issues/1784
      allowUnionTypes: true,
      coerceTypes: true,
      verbose: true,
    });
  }

  public static getInstance(): AuthValidator {
    if (!AuthValidator.instance) {
      AuthValidator.instance = new AuthValidator();
    }
    return AuthValidator.instance;
  }

  public validateAuthSignInReq(data: Record<string, unknown>): HttpLoginRequest {
    return this.validate(this.authSignIn, data);
  }

  public validateAuthSignOnReq(data: Record<string, unknown>): Partial<HttpRegisterUserRequest> {
    return this.validate(this.authSignOn, data);
  }

  public validateAuthPasswordResetReq(data: Record<string, unknown>): Partial<HttpResetPasswordRequest> {
    return this.validate(this.authPasswordReset, data);
  }

  public validateAuthEulaCheckReq(data: Record<string, unknown>): Partial<HttpCheckEulaRequest> {
    return this.validate(this.authEulaCheck, data);
  }

  public validateAuthEmailVerifyReq(data: Record<string, unknown>): Partial<HttpVerifyEmailRequest> {
    return this.validate(this.authEmailVerify, data);
  }

  public validateAuthVerificationEmailResendReq(data: Record<string, unknown>): Partial<HttpResendVerificationMailRequest> {
    return this.validate(this.authVerificationEmailResend, data);
  }

  public validateAuthEulaReq(data: Record<string, unknown>): Partial<HttpEulaRequest> {
    return this.validate(this.authEula, data);
  }
}
