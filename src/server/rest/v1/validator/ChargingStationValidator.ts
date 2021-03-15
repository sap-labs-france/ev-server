import { HttpChargingStationsRequest } from '../../../../types/requests/HttpChargingStationRequest';
import Schema from './Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class ChargingStationValidator extends SchemaValidator {
  private static _instance: ChargingStationValidator | undefined;
  private chargingStationsGet: Schema;


  private constructor() {
    super('ChargingStationValidator');
    this.chargingStationsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstations-get.json`, 'utf8'));
  }

  public static getInstance(): ChargingStationValidator {
    if (!ChargingStationValidator._instance) {
      ChargingStationValidator._instance = new ChargingStationValidator();
    }
    return ChargingStationValidator._instance;
  }

  public validateChargingStationsGetReq(data: any): HttpChargingStationsRequest {
    // Validate schema
    this.validate(this.chargingStationsGet, data);
    // Validate deps between components
    return data;
  }
}
