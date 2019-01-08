const CrudApi = require('./utils/CrudApi');
const Constants = require('./utils/Constants');

class OCPIEndpointApi extends CrudApi {
  constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  readById(id) {
    return super.readById('/client/api/Ocpiendpoint', id);
  }

  readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll('/client/api/Ocpiendpoints', params, paging, ordering);
  }

  create(data) {
    return super.create('/client/api/OcpiendpointCreate', data);
  }

  update(data) {
    return super.update('/client/api/OcpiendpointUpdate', data);
  }

  delete(id) {
    return super.delete('/client/api/OcpiendpointDelete', id);
  }
}

module.exports = OCPIEndpointApi;