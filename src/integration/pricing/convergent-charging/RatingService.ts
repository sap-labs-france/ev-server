import { soap } from 'strong-soap';
import AbstractSoapClient from './AbstractSoapClient';
import global from '../../../types/GlobalType';

export default class RatingService extends AbstractSoapClient {

  public constructor(serverUrl: string, user: string, password: string) {
    super(
      `${serverUrl}/ARTIX/rating`,
      `${global.appRoot}/assets/convergent-charging/wsdl/rating_1.wsdl`,
      'rating',
      'RatingServicesPort',
      user,
      password,
      new soap.ClientSSLSecurity(
        `${global.appRoot}/assets/convergent-charging/ssl/hybris-access.key`,
        `${global.appRoot}/assets/convergent-charging/ssl/hybris-access.crt`,
        { rejectUnauthorized: false, strictSSL: false }
      )
    );
  }

  public async loadChargedItemsToInvoicing(): Promise<number> {
    await this.execute(new ChargedItemLoadRequest());
    return this.timeout(3000);
  }

  public async timeout(delayms: number): Promise<number> {
    return await new Promise((resolve) => {
      return setTimeout(resolve, delayms);
    });
  }
}

export class ChargedItemLoadRequest {
  public getName(): string {
    return 'chargedItemLoad';
  }
}
