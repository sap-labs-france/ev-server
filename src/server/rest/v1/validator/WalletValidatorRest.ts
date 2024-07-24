import { HttpWalletRechargeRequest } from '../../../../types/requests/HttpWalletRequest';

// import { ChargingProfile } from '../../../../types/ChargingProfile';
import HttpDatabaseRequest from '../../../../types/requests/HttpDatabaseRequest';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class WalletValidatorRest extends SchemaValidator {
  private static instance: WalletValidatorRest | null = null;
  private WalletRecharge: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/wallet/walletrecharge-update.json`, 'utf8'));
  // private chargingStationGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-get.json`, 'utf8'));

  private constructor() {
    super('WalletValidatorRest');
  }

  public static getInstance(): WalletValidatorRest {
    if (!WalletValidatorRest.instance) {
      WalletValidatorRest.instance = new WalletValidatorRest();
    }
    return WalletValidatorRest.instance;
  }

  public validateWalletRechargeReq(data: Record<string, unknown>): HttpWalletRechargeRequest {
    return this.validate(this.WalletRecharge, data);
  }

}
