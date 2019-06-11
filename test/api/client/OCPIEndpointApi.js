const CrudApi = require('./utils/CrudApi');
const Constants = require('./utils/Constants');

class OCPIEndpointApi extends CrudApi {
  constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  readById(id) {
    return super.readById('/client/api/OcpiEndpoint', id);
  }

  readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll('/client/api/OcpiEndpoints', params, paging, ordering);
  }

  create(data) {
    return super.create('/client/api/OcpiEndpointCreate', data);
  }

  update(data) {
    return super.update('/client/api/OcpiEndpointUpdate', data);
  }

  delete(id) {
    return super.delete('/client/api/OcpiEndpointDelete', id);
  }
}

module.exports = OCPIEndpointApi;