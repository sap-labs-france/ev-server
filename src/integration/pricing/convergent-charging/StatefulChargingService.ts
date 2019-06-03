const soap = require('strong-soap').soap;
import AbstractSoapClient from './AbstractSoapClient';

export default class StatefulChargingService extends AbstractSoapClient {

  constructor(serverUrl: string, user: string, password: string) {
    super(
      `${serverUrl}/ARTIX/statefulCharging`,
      `${(global as any).appRoot}/assets/convergent-charging/wsdl/StatefulCharging.wsdl`,
      'statefulCharging',
      'statefulChargingPort',
      user,
      password,
      new soap.ClientSSLSecurity(
        `${(global as any).appRoot}/assets/convergent-charging/ssl/hybris-access.key`,
        `${(global as any).appRoot}/assets/convergent-charging/ssl/hybris-access.crt`,
        { rejectUnauthorized: false, strictSSL: false }
      )
    );
  }
};
