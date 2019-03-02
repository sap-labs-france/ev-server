const soap = require('strong-soap').soap;
const AbstractSoapClient = require('./AbstractSoapClient');

class RatingService extends AbstractSoapClient {

  constructor(serverUrl, user, password) {
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
        {rejectUnauthorized: false, strictSSL: false}
      )
    );
  }

  async loadChargedItemsToInvoicing() {
    await this.execute(new ChargedItemLoadRequest());
    return this.timeout(3000);
  }

  timeout(delayms) {
    return new Promise(resolve => setTimeout(resolve, delayms));
  }
}

module.exports = RatingService;


class ChargedItemLoadRequest {
  getName() {
    return 'chargedItemLoad';
  }
}