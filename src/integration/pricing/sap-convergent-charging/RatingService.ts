import AbstractSoapClient from './AbstractSoapClient';
import global from '../../../types/GlobalType';
import { soap } from 'strong-soap';

export default class RatingService extends AbstractSoapClient {

  public constructor(serverUrl: string, user: string, password: string) {
    super(
      `${serverUrl}/ARTIX/rating`,
      `${global.appRoot}/integration/pricing/convergent-charging/assets/wsdl/rating_1.wsdl`,
      'rating',
      'RatingServicesPort',
      user,
      password,
      new soap.ClientSSLSecurity(
        `${global.appRoot}/integration/pricing/convergent-charging/assets/ssl/hybris-access.key`,
        `${global.appRoot}/integration/pricing/convergent-charging/assets/ssl/hybris-access.crt`,
        { rejectUnauthorized: false, strictSSL: false }
      )
    );
  }

  public async loadChargedItemsToInvoicing(): Promise<number> {
    await this.execute(new ChargedItemLoadRequest());
    return this.timeout(3000);
  }

  public async timeout(delayms: number): Promise<number> {
    return new Promise((resolve) => setTimeout(resolve, delayms));
  }
}

export class ChargedItemLoadRequest {
  public getName(): string {
    return 'chargedItemLoad';
  }
}
