import { HttpChargingStationCommandRequest, HttpDownloadQrCodeRequest } from '../../../../types/requests/HttpChargingStationRequest';

import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class ChargingStationValidator extends SchemaValidator {
  private static _instance: ChargingStationValidator | undefined;
  private _chargingStationDownloadQRCodePdf: any;
  private _chargingStationAction: any;
  private _chargingStationGetConnector: any;


  private constructor() {
    super('TenantValidator');
    this._chargingStationDownloadQRCodePdf = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-download-qrcode-pdf.json`, 'utf8'));
    this._chargingStationAction = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action.json`, 'utf8'));
    this._chargingStationGetById = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action.json`, 'utf8'));
  }

  public static getInstance(): ChargingStationValidator {
    if (!ChargingStationValidator._instance) {
      ChargingStationValidator._instance = new ChargingStationValidator();
    }
    return ChargingStationValidator._instance;
  }

  public validateChargingStationDownloadQRCodePdf(data: HttpDownloadQrCodeRequest): HttpDownloadQrCodeRequest {
    // Validate schema
    this.validate(this._chargingStationDownloadQRCodePdf, data);
    // Validate deps between components
    return data;
  }

  public validateChargingStationAction(data: HttpChargingStationCommandRequest): HttpChargingStationCommandRequest {
    // Validate schema
    this.validate(this._chargingStationAction, data);
    // Validate deps between components
    return data;
  }
}
