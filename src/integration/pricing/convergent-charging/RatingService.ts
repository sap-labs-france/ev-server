import { soap } from 'strong-soap';
import AbstractSoapClient from './AbstractSoapClient';

export default class RatingService extends AbstractSoapClient {

  //TODO Absolutely remove the global as any typecase; instead, define the global properly.
  //https://stackoverflow.com/questions/40743131/how-to-prevent-property-does-not-exist-on-type-global-with-jsdom-and-t
  public constructor(serverUrl: string, user: string, password: string) {
    super(
      `${serverUrl}/ARTIX/rating`,
      `${(global as any).appRoot}/assets/convergent-charging/wsdl/rating_1.wsdl`,
      'rating',
      'RatingServicesPort',
      user,
      password,
      new soap.ClientSSLSecurity(
        `${(global as any).appRoot}/assets/convergent-charging/ssl/hybris-access.key`,
        `${(global as any).appRoot}/assets/convergent-charging/ssl/hybris-access.crt`,
        { rejectUnauthorized: false, strictSSL: false }
      )
    );
  }

  public async loadChargedItemsToInvoicing(): Promise<number> {
    await this.execute(new ChargedItemLoadRequest());
    return this.timeout(3000);
  }

  public timeout(delayms: number): Promise<number> {
    return new Promise(resolve => setTimeout(resolve, delayms));
  }
}

export class ChargedItemLoadRequest {
  public getName(): string {
    return 'chargedItemLoad';
  }
}
