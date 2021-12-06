import AbstractSoapClient from './AbstractSoapClient';
import global from '../../../types/GlobalType';
import { soap } from 'strong-soap';

export default class StatefulChargingService extends AbstractSoapClient {

  constructor(serverUrl: string, user: string, password: string) {
    super(
      `${serverUrl}/ARTIX/statefulCharging`,
      `${global.appRoot}/integration/pricing/convergent-charging/assets/wsdl/StatefulCharging.wsdl`,
      'statefulCharging',
      'statefulChargingPort',
      user,
      password,
      new soap.ClientSSLSecurity(
        `${global.appRoot}/integration/pricing/convergent-charging/assets/ssl/hybris-access.key`,
        `${global.appRoot}/integration/pricing/convergent-charging/assets/ssl/hybris-access.crt`,
        { rejectUnauthorized: false, strictSSL: false }
      )
    );
  }
}
