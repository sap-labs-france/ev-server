const ReadApi = require('./ReadApi');
const UpdateApi = require('./UpdateApi');

class CrudApi {

  constructor(serviceDefinition, baseApi) {
    this.serviceDefinition = serviceDefinition;
    this.baseApi = baseApi;
    this.readApi = new ReadApi(baseApi);
    this.updateApi = new UpdateApi(baseApi);
  }

   create(data) {
    return this.baseApi.send({
      method: 'POST',
      url: this.serviceDefinition.create,
      data: data,
    });
  }

  readById(id) {
    return this.readApi.readById(this.serviceDefinition.readById, id);
  }

  read(query) {
    return this.readApi.readById(this.serviceDefinition.read, query);
  }

  readAll(query) {
    return this.readApi.readAll(this.serviceDefinition.read, query);
  }

  update(data) {
    return this.updateApi.update(this.serviceDefinition.read, query);
  }

   delete(id) {
    return this.baseApi.send({
      method: 'DELETE',
      url: this.serviceDefinition.delete,
      params: {ID: id}
    });
  }

}

module.exports = CrudApi;