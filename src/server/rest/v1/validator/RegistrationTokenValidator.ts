import { HttpRegistrationTokenRequest, HttpRegistrationTokensRequest } from '../../../../types/requests/HttpRegistrationToken';

import RegistrationToken from '../../../../types/RegistrationToken';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class RegistrationTokenValidator extends SchemaValidator {
  private static instance: RegistrationTokenValidator | null = null;
  private registrationTokenCreate: Schema;
  private registrationTokenGetByID: Schema;
  private registrationTokensGet: Schema;
  private registrationTokenUpdate: Schema;


  private constructor() {
    super('RegistrationTokenValidator');
    this.registrationTokenCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/registration-token/registration-token-create.json`, 'utf8'));
    this.registrationTokenGetByID = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/registration-token/registration-token-by-id.json`, 'utf8'));
    this.registrationTokensGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/registration-token/registration-tokens-get.json`, 'utf8'));
    this.registrationTokenUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/registration-token/registration-token-update.json`, 'utf8'));
  }

  public static getInstance(): RegistrationTokenValidator {
    if (!RegistrationTokenValidator.instance) {
      RegistrationTokenValidator.instance = new RegistrationTokenValidator();
    }
    return RegistrationTokenValidator.instance;
  }

  public validateRegistrationTokenCreateReq(data: Record<string, unknown>): RegistrationToken {
    return this.validate(this.registrationTokenCreate, data);
  }

  public validateRegistrationTokenGetReq(data: Record<string, unknown>): HttpRegistrationTokenRequest {
    return this.validate(this.registrationTokenGetByID, data);
  }

  public validateRegistrationTokensGetReq(data: Record<string, unknown>): HttpRegistrationTokensRequest {
    return this.validate(this.registrationTokensGet, data);
  }

  public validateRegistrationTokenUpdateReq(data: Record<string, unknown>): RegistrationToken {
    return this.validate(this.registrationTokenUpdate, data);
  }
}
