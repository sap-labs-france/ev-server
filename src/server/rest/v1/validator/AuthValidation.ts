import { HttpCheckEulaRequest, HttpEulaRequest, HttpLoginRequest, HttpRegisterUserRequest, HttpResendVerificationMailRequest, HttpResetPasswordRequest, HttpVerifyEmailRequest } from '../../../../types/requests/HttpUserRequest';

import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class AuthValidator extends SchemaValidator {
  private static _instance: AuthValidator | undefined;
  private _authSignIn: any;
  private _authSignOn: any;
  private _authResetPassword: any;
  private _authCheckEula: any;
  private _authVerifyEmail: any;
  private _authResendVerificationEmail: any;
  private _authEula: any;

  private constructor() {
    super('AuthValidator');
    this._authSignIn = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-signin.json`, 'utf8'));
    this._authSignOn = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-signon.json`, 'utf8'));
    this._authResetPassword = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-reset-password.json`, 'utf8'));
    this._authCheckEula = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-check-eula.json`, 'utf8'));
    this._authVerifyEmail = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-verify-email.json`, 'utf8'));
    this._authResendVerificationEmail = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-resend-verification-email.json`, 'utf8'));
    this._authEula = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-eula.json`, 'utf8'));
  }

  public static getInstance(): AuthValidator {
    if (!AuthValidator._instance) {
      AuthValidator._instance = new AuthValidator();
    }
    return AuthValidator._instance;
  }

  public validateAuthSignIn(data: HttpLoginRequest): HttpLoginRequest {
    // Validate schema
    this.validate(this._authSignIn, data);
    return data;
  }

  public validateAuthSignOn(data: HttpRegisterUserRequest): Partial<HttpRegisterUserRequest> {
    // Validate schema
    this.validate(this._authSignOn, data);
    return data;
  }

  public validateAuthResetPassword(data: HttpResetPasswordRequest): Partial<HttpResetPasswordRequest> {
    // Validate schema
    this.validate(this._authResetPassword, data);
    return data;
  }

  public validateAuthCheckEula(data: any): Partial<HttpCheckEulaRequest> {
    // Validate schema
    this.validate(this._authCheckEula, data);
    return data;
  }

  public validateAuthVerifyEmail(data: any): Partial<HttpVerifyEmailRequest> {
    // Validate schema
    this.validate(this._authVerifyEmail, data);
    return data;
  }

  public validateAuthResendVerificationEmail(data: any): Partial<HttpResendVerificationMailRequest> {
    // Validate schema
    this.validate(this._authResendVerificationEmail, data);
    return data;
  }

  public validateAuthEula(data: any): Partial<HttpEulaRequest> {
    // Validate schema
    this.validate(this._authEula, data);
    return data;
  }
}
