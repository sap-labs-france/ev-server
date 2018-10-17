const {expect} = require('chai');

class PageableApi {

  constructor(pageSize, baseApi) {
    this.pageSize = pageSize;
    this.baseApi = baseApi;
    this.url = baseApi.url;
  }

  async send(data) {
    data.params.Limit = 1;
    data.params.Skip = 0;
    let response = await this.baseApi.send(data);
    expect(response.status).to.equal(200);
    expect(response.data).to.have.property('count');
    let count = response.data.count;
    let pages = Math.round(count / this.pageSize);

    if ((pages * this.pageSize) < count) {
      pages++;
    }

    const promises = [...Array(pages).keys()].map(async page => {
      const innerData = JSON.parse(JSON.stringify(data));
      innerData.params = {...innerData.params, ...{Limit: this.pageSize, Skip: this.pageSize * page}};
      return this.baseApi.send(innerData);
    });

    const responses = await Promise.all(promises);
    responses.forEach(response => {
        expect(response.status).to.equal(200);
        expect(response.data).to.have.property('count');
        expect(response.data).to.have.property('result');
      }
    );
    response = {
      status: 200,
      data: {
        count: count,
        result: responses.map(response => response.data.result).reduce((list, result) => list.concat(result), [])
      }
    };

    return response
  }
}

module.exports = PageableApi;