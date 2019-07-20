import CrudApi from './utils/CrudApi';

export default class SiteApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public update(data) {
    return super.update(data, '/client/api/PricingUpdate');
  }
}
