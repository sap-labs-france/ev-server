const PageableApi = require('./PageableApi');

class ReadApi {

  constructor(baseApi) {
    this.baseApi = baseApi;
    this.pageableApi = new PageableApi(100, baseApi);
  }


  readById(path, id) {
    return this.baseApi.send({
      method: 'GET',
      url: path,
      params: {ID: id}
    });
  }

  read(path, params = {}, headers = {}) {
    return this.baseApi.send({
      method: 'GET',
      url: path,
      params: params,
      headers: headers
    });
  }

  readAll(path, params = {}) {
    let request = this.pageableApi;
    if (params.Limit || params.Skip) {
      request = this.baseApi;
    }
    return request.send({
      method: 'GET',
      url: path,
      params: params
    });
  }
}

module.exports = ReadApi;