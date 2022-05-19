import { HttpCreateChargingStationTemplateRequest, HttpDeleteChargingStationTemplateRequest, HttpGetChargingStationTemplateRequest, HttpGetChargingStationTemplatesRequest, HttpUpdateChargingStationTemplateRequest } from '../../../../types/requests/HttpChargingStationTemplateRequest';

import { ChargingStationTemplate } from '../../../../types/ChargingStation';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class ChargingStationTemplateValidator extends SchemaValidator {
  private static instance: ChargingStationTemplateValidator | null = null;
  private chargingStationTemplateCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/chargingstation/chargingstation-template.json`, 'utf8'));
  private chargingStationTemplateGetByID: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstationtemplate/charging-station-template-get.json`, 'utf8'));
  private chargingStationsTemplateGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstationtemplate/charging-station-templates-get.json`, 'utf8'));
  private chargingStationTemplateUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstationtemplate/charging-station-template-update.json`, 'utf8'));
  private chargingStationsTemplateDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstationtemplate/charging-station-template-delete.json`, 'utf8'));


  private constructor() {
    super('ChargingStationTemplateValidator');
  }

  public static getInstance(): ChargingStationTemplateValidator {
    if (!ChargingStationTemplateValidator.instance) {
      ChargingStationTemplateValidator.instance = new ChargingStationTemplateValidator();
    }
    return ChargingStationTemplateValidator.instance;
  }

  public validateChargingStationTemplateCreateReq(data: Record<string, unknown>): HttpCreateChargingStationTemplateRequest {
    return this.validate(this.chargingStationTemplateCreate, data);
  }

  public validateChargingStationTemplateGetReq(data: Record<string, unknown>): HttpGetChargingStationTemplateRequest {
    return this.validate(this.chargingStationTemplateGetByID, data);
  }

  public validateChargingStationTemplatesGetReq(data: Record<string, unknown>): HttpGetChargingStationTemplatesRequest {
    return this.validate(this.chargingStationsTemplateGet, data);
  }

  public validateChargingStationTemplateDeleteReq(data: Record<string, unknown>): HttpDeleteChargingStationTemplateRequest {
    return this.validate(this.chargingStationsTemplateDelete, data);
  }

  public validateChargingStationTemplateUpdateReq(data: Record<string, unknown>): HttpUpdateChargingStationTemplateRequest {
    return this.validate(this.chargingStationTemplateUpdate, data);
  }
}
