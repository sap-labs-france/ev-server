const CrudApi = require('./utils/CrudApi');

class SiteApi extends CrudApi {
  constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  update(data) {
    return super.update('/client/api/PricingUpdate', data);
  }
}

module.exports = SiteApi;