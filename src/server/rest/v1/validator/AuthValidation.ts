import { HttpLoginRequest, HttpRegisterUserRequest } from '../../../../types/requests/HttpUserRequest';

import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class AuthValidator extends SchemaValidator {
  private static _instance: AuthValidator | undefined;
  private _authSignIn: any;
  private _authSignOn: any;

  private constructor() {
    super('AuthValidator');
    this._authSignIn = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-signin.json`, 'utf8'));
    this._authSignOn = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-signon.json`, 'utf8'));
  }

  public static getInstance(): AuthValidator {
    if (!AuthValidator._instance) {
      AuthValidator._instance = new AuthValidator();
    }
    return AuthValidator._instance;
  }

  public validateAuthSignIn(auth: HttpLoginRequest): HttpLoginRequest {
    // Validate schema
    this.validate(this._authSignIn, auth);
    return auth;
  }

  public validateAuthSignOn(auth: HttpRegisterUserRequest): Partial<HttpRegisterUserRequest> {
    // Validate schema
    this.validate(this._authSignOn, auth);
    return auth;
  }
}
