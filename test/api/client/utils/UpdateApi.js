class UpdateApi {

  constructor(baseApi) {
    this.baseApi = baseApi;
  }

  update(path, data) {
    return this.baseApi.send({
      method: 'PUT',
      url: path,
      data: data,
    });
  }
}

module.exports = UpdateApi;