import { OICPAuthorizeRemoteStartCpoReceive, OICPAuthorizeRemoteStopCpoReceive } from '../../../types/oicp/OICPAuthorize';

import SchemaValidator from '../../rest/v1/validator/SchemaValidator';
import fs from 'fs';
import global from '../../../types/GlobalType';

const MODULE_NAME = 'OICPValidation';

export default class OICPValidation extends SchemaValidator {
  private static instance: OICPValidation|null = null;

  public validate: any;
  private remoteStartRequest: any;
  private remoteStopRequest: any;

  private constructor() {
    super('OICPValidation');
    this.remoteStartRequest = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/oicp/schemas/OICPAuthorizeRemoteStartCpoReceive.json`, 'utf8'));
    this.remoteStopRequest = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/oicp/schemas/OICPAuthorizeRemoteStopCpoReceive.json`, 'utf8'));
  }

  public static getInstance(): OICPValidation {
    if (!OICPValidation.instance) {
      OICPValidation.instance = new OICPValidation();
    }
    return OICPValidation.instance;
  }

  public validateRemoteStart(remoteStart: OICPAuthorizeRemoteStartCpoReceive): void {
    this.validate(this.remoteStartRequest, remoteStart);
  }

  public validateRemoteStop(remoteStop: OICPAuthorizeRemoteStopCpoReceive): void {
    this.validate(this.remoteStopRequest, remoteStop);
  }

}

