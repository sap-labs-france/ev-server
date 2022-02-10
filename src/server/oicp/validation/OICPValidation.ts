import { OICPAuthorizeRemoteStartCpoReceive, OICPAuthorizeRemoteStopCpoReceive } from '../../../types/oicp/OICPAuthorize';

import Schema from '../../../types/validator/Schema';
import SchemaValidator from '../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../types/GlobalType';

export default class OICPValidation extends SchemaValidator {
  private static instance: OICPValidation|null = null;
  private remoteStartRequest: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/oicp/schemas/oicp-authorize-remote-start-cpo-receive.json`, 'utf8'));
  private remoteStopRequest: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/oicp/schemas/oicp-authorize-remote-stop-cpo-receive.json`, 'utf8'));

  private constructor() {
    super('OICPValidation');
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
