import { OICPAuthorizeRemoteStartCpoReceive, OICPAuthorizeRemoteStopCpoReceive } from '../../../types/oicp/OICPAuthorize';

import Schema from '../../../types/validator/Schema';
import SchemaValidator from '../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../types/GlobalType';

export default class OICPValidation extends SchemaValidator {
  private static instance: OICPValidation|null = null;

  private remoteStartRequest: Schema;
  private remoteStopRequest: Schema;

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
    this.validate('validateRemoteStart', this.remoteStartRequest, remoteStart as unknown as Record<string, unknown>);
  }

  public validateRemoteStop(remoteStop: OICPAuthorizeRemoteStopCpoReceive): void {
    this.validate('validateRemoteStop', this.remoteStopRequest, remoteStop as unknown as Record<string, unknown>);
  }
}
