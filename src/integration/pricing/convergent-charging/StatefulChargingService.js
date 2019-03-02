const soap = require('strong-soap').soap;
const AbstractSoapClient = require('./AbstractSoapClient');
const {performance} = require('perf_hooks');

class StatefulChargingService extends AbstractSoapClient {

  constructor(serverUrl, user, password) {
    super(
      `${serverUrl}/ARTIX/statefulCharging`,
      `${global.appRoot}/assets/convergent-charging/wsdl/StatefulCharging.wsdl`,
      'statefulCharging',
      'statefulChargingPort',
      user,
      password,
      new soap.ClientSSLSecurity(
        `${global.appRoot}/assets/convergent-charging/ssl/hybris-access.key`,
        `${global.appRoot}/assets/convergent-charging/ssl/hybris-access.crt`,
        {rejectUnauthorized: false, strictSSL: false}
      )
    );
  }
}

module.exports = StatefulChargingService;
