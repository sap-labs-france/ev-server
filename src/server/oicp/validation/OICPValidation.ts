import { OICPAuthorizeRemoteStartCpoReceive, OICPAuthorizeRemoteStopCpoReceive } from '../../../types/oicp/OICPAuthorize';

import BackendError from '../../../exception/BackendError';
import ChargingStation from '../../../types/ChargingStation';
import Logging from '../../../utils/Logging';
import SchemaValidator from '../../rest/v1/validator/SchemaValidator';
import { ServerAction } from '../../../types/Server';
import Utils from '../../../utils/Utils';
import fs from 'fs';
import global from '../../../types/GlobalType';

const MODULE_NAME = 'OICPValidation';

export default class OICPValidation extends SchemaValidator {
  private static instance: OICPValidation|null = null;

  public validate: any;
  private _remoteStartRequest: any;
  private _remoteStopRequest: any;

  private constructor() {
    super('OICPValidation');
    this._remoteStartRequest = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/oicp/schemas/OICPAuthorizeRemoteStartCpoReceive.json`, 'utf8'));
    this._remoteStopRequest = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/oicp/schemas/OICPAuthorizeRemoteStopCpoReceive.json`, 'utf8'));
  }

  static getInstance(): OICPValidation {
    if (!OICPValidation.instance) {
      OICPValidation.instance = new OICPValidation();
    }
    return OICPValidation.instance;
  }

  validateRemoteStart(remoteStart: OICPAuthorizeRemoteStartCpoReceive): void {
    this.validate(this._remoteStartRequest, remoteStart);
  }

  validateRemoteStop(remoteStop: OICPAuthorizeRemoteStopCpoReceive): void {
    this.validate(this._remoteStopRequest, remoteStop);
  }

}

