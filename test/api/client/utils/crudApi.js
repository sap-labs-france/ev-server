const ReadApi = require('./readApi');
const UpdateApi = require('./updateApi');

class CRUDApi {

  constructor(serviceDefinition, baseApi) {
    this.serviceDefinition = serviceDefinition;
    this.baseApi = baseApi;
    this.readApi = new ReadApi(baseApi);
    this.updateApi = new UpdateApi(baseApi);
  }

   create(payload, expectations) {
    return this.baseApi.send({
      method: 'POST',
      path: this.serviceDefinition.create,
      payload: payload,
    }, expectations);
  }

  readById(id, expectations) {
    return this.readApi.readById(this.serviceDefinition.readById, id, expectations);
  }

  read(query, expectations) {
    return this.readApi.readById(this.serviceDefinition.read, query, expectations);
  }

  readAll(query, expectations) {
    return this.readApi.readAll(this.serviceDefinition.read, query, expectations);
  }

  update(payload, expectations) {
    return this.updateApi.update(this.serviceDefinition.read, query, expectations);
  }

   delete(id, expectations) {
    return this.baseApi.send({
      method: 'DELETE',
      path: this.serviceDefinition.delete,
      query: {ID: id}
    }, expectations);
  }

}

module.exports = CRUDApi;