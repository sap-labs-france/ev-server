import { HttpChargingStationCommandRequest, HttpChargingStationsRequest } from '../../../../types/requests/HttpChargingStationRequest';

import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import Schema from './Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class ChargingStationValidator extends SchemaValidator {
  private static instance: ChargingStationValidator | undefined;
  private chargingStationsGet: Schema;
  private chargingStationGet: Schema;
  private chargingStationDelete: Schema;
  private chargingStationAction: Schema;


  private constructor() {
    super('ChargingStationValidator');
    this.chargingStationsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstations-get.json`, 'utf8'));
    this.chargingStationGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-get.json`, 'utf8'));
    this.chargingStationDelete = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-delete.json`, 'utf8'));
    this.chargingStationAction = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action.json`, 'utf8'));
  }

  public static getInstance(): ChargingStationValidator {
    if (!ChargingStationValidator.instance) {
      ChargingStationValidator.instance = new ChargingStationValidator();
    }
    return ChargingStationValidator.instance;
  }

  public validateChargingStationsGetReq(data: any): HttpChargingStationsRequest {
    // Validate schema
    this.validate(this.chargingStationsGet, data);
    return data;
  }

  public validateChargingStationGetReq(data: any): HttpByIDRequest {
    // Validate schema
    this.validate(this.chargingStationGet, data);
    return data;
  }

  public validateChargingStationDeleteReq(data: any): HttpByIDRequest {
    // Validate schema
    this.validate(this.chargingStationDelete, data);
    return data;
  }

  public validateChargingStationActionReq(data: any): HttpChargingStationCommandRequest {
    // Validate schema
    this.validate(this.chargingStationAction, data);
    return data;
  }
}
