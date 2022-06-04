import { HttpRegistrationTokenGetRequest, HttpRegistrationTokenRevokeRequest, HttpRegistrationTokensGetRequest } from '../../../../types/requests/HttpRegistrationToken';

import RegistrationToken from '../../../../types/RegistrationToken';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class RegistrationTokenValidatorRest extends SchemaValidator {
  private static instance: RegistrationTokenValidatorRest | null = null;
  private registrationTokenCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/registration-token/registration-token-create.json`, 'utf8'));
  private registrationTokenGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/registration-token/registration-token-get.json`, 'utf8'));
  private registrationTokenRevoke: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/registration-token/registration-token-revoke.json`, 'utf8'));
  private registrationTokenDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/registration-token/registration-token-delete.json`, 'utf8'));
  private registrationTokensGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/registration-token/registration-tokens-get.json`, 'utf8'));
  private registrationTokenUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/registration-token/registration-token-update.json`, 'utf8'));


  private constructor() {
    super('RegistrationTokenValidatorRest');
  }

  public static getInstance(): RegistrationTokenValidatorRest {
    if (!RegistrationTokenValidatorRest.instance) {
      RegistrationTokenValidatorRest.instance = new RegistrationTokenValidatorRest();
    }
    return RegistrationTokenValidatorRest.instance;
  }

  public validateRegistrationTokenCreateReq(data: Record<string, unknown>): RegistrationToken {
    return this.validate(this.registrationTokenCreate, data);
  }

  public validateRegistrationTokenGetReq(data: Record<string, unknown>): HttpRegistrationTokenGetRequest {
    return this.validate(this.registrationTokenGet, data);
  }

  public validateRegistrationTokenRevokeReq(data: Record<string, unknown>): HttpRegistrationTokenRevokeRequest {
    return this.validate(this.registrationTokenRevoke, data);
  }

  public validateRegistrationTokenDeleteReq(data: Record<string, unknown>): HttpRegistrationTokenGetRequest {
    return this.validate(this.registrationTokenDelete, data);
  }

  public validateRegistrationTokensGetReq(data: Record<string, unknown>): HttpRegistrationTokensGetRequest {
    return this.validate(this.registrationTokensGet, data);
  }

  public validateRegistrationTokenUpdateReq(data: Record<string, unknown>): RegistrationToken {
    return this.validate(this.registrationTokenUpdate, data);
  }
}
