import { HttpChargingStationTemplateRequest, HttpChargingStationsTemplateRequest } from '../../../../types/requests/HttpChargingStationTemplateRequest';

import ChargingStationTemplate from '../../../../types/ChargingStationTemplate';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class ChargingStationTemplateValidator extends SchemaValidator {
  private static instance: ChargingStationTemplateValidator | null = null;
  // private chargingStationTemplateCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/registration-token/registration-token-create.json`, 'utf8'));
  // private chargingStationTemplateGetByID: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/registration-token/registration-token-by-id.json`, 'utf8'));
  private chargingStationsTemplateGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/registration-token/registration-tokens-get.json`, 'utf8'));
  // private chargingStationTemplateUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/registration-token/registration-token-update.json`, 'utf8'));


  private constructor() {
    super('ChargingStationTemplateValidator');
  }

  public static getInstance(): ChargingStationTemplateValidator {
    if (!ChargingStationTemplateValidator.instance) {
      ChargingStationTemplateValidator.instance = new ChargingStationTemplateValidator();
    }
    return ChargingStationTemplateValidator.instance;
  }

  // public validateChargingStationTemplateCreateReq(data: Record<string, unknown>): ChargingStationTemplate {
  //   return this.validate(this.chargingStationTemplateCreate, data);
  // }

  // public validateChargingStationTemplateGetReq(data: Record<string, unknown>): HttpChargingStationTemplateRequest {
  //   return this.validate(this.chargingStationTemplateGetByID, data);
  // }

  public validateChargingStationsTemplateGetReq(data: Record<string, unknown>): HttpChargingStationsTemplateRequest {
    return this.validate(this.chargingStationsTemplateGet, data);
  }

  // public validateChargingStationTemplateUpdateReq(data: Record<string, unknown>): ChargingStationTemplate {
  //   return this.validate(this.chargingStationTemplateUpdate, data);
  // }
}
