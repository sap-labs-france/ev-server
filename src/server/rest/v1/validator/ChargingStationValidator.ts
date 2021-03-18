import HttpByIDRequest, { HttpRestByIDRequest } from '../../../../types/requests/HttpByIDRequest';

import { HttpChargingStationsRequest } from '../../../../types/requests/HttpChargingStationRequest';
import Schema from './Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class ChargingStationValidator extends SchemaValidator {
  private static instance: ChargingStationValidator | undefined;
  private chargingStationsGet: Schema;
  private chargingStationGet: Schema;


  private constructor() {
    super('ChargingStationValidator');
    this.chargingStationsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstations-get.json`, 'utf8'));
    this.chargingStationGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-get.json`, 'utf8'));
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
    // Validate deps between components
    return data;
  }

  public validateChargingStationGetReq(data: any): HttpRestByIDRequest {
    // Validate schema
    this.validate(this.chargingStationGet, data);
    // Validate deps between components
    return data;
  }
}
