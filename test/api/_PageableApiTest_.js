const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const sinonChai = require("sinon-chai");
chai.use(chaiSubset);
chai.use(sinonChai);

const PageableApi = require('./PageableApi');
const sinon = require('sinon');


describe('Pageable Api tests', function() {

  it('Constructor', async () => {
    new PageableApi(10, {url: null});
  });

  it('_getTotalCountOfElementToGet should read first element to get the total count', async () => {
    const fakeApi = {};
    fakeApi.url = null;
    const pageableApi = new PageableApi(10, fakeApi);

    expect(await pageableApi._getTotalCountOfElementToGet({
      status: 200,
      data: {count: 0}
    })).to.be.equals(0);
  });

  describe('_computeNumberOfPagesToRequest tests', function() {
    it('0 count -> 0 pages', async () => {
      const fakeApi = {};
      fakeApi.url = null;
      const pageableApi = new PageableApi(10, fakeApi);

      expect(pageableApi._computeNumberOfPagesToRequest(0)).to.be.equals(0);
    });

    it('1 count -> 1 pages', async () => {
      const fakeApi = {};
      fakeApi.url = null;
      const pageableApi = new PageableApi(10, fakeApi);
      expect(pageableApi._computeNumberOfPagesToRequest(0)).to.be.equals(0);
    });

    it('10 count -> 1 pages', async () => {
      const fakeApi = {};
      fakeApi.url = null;
      const pageableApi = new PageableApi(10, fakeApi);
      expect(pageableApi._computeNumberOfPagesToRequest(0)).to.be.equals(0);
    });

    it('11 count -> 2 pages', async () => {
      const fakeApi = {};
      fakeApi.url = null;
      const pageableApi = new PageableApi(10, fakeApi);
      expect(pageableApi._computeNumberOfPagesToRequest(0)).to.be.equals(0);
    });
  });

  describe('_extractAndAggregateResults tests', function() {
    it('aggregation of a response without results', async () => {

      const fakeApi = {};
      fakeApi.url = null;
      const pageableApi = new PageableApi(10, fakeApi);

      const responses = [];
      responses.push({
        status: 200,
        data: {
          count: 0,
          result: []
        }
      });
      expect(pageableApi._extractAndAggregateResults(responses)).to.be.an('array').that.is.empty;
    });
    it('aggregation of a response with one page', async () => {

      const fakeApi = {};
      fakeApi.url = null;
      const pageableApi = new PageableApi(10, fakeApi);

      const responses = [];
      responses.push({
        status: 200,
        data: {
          count: 0,
          result: [1, 2, 3]
        }
      });
      expect(pageableApi._extractAndAggregateResults(responses)).to.be.an('array').to.deep.equal([1, 2, 3]);

    });
    it('aggregation of mutliple responses', async () => {

      const fakeApi = {};
      fakeApi.url = null;
      const pageableApi = new PageableApi(10, fakeApi);

      const responses = [];
      responses.push({
        status: 200,
        data: {
          count: 0,
          result: [1, 2, 3]
        }
      }, {
        status: 200,
        data: {
          count: 0,
          result: [4, 5, 6]
        }
      }, {
        status: 200,
        data: {
          count: 0,
          result: [7, 8, 9, 10]
        }
      });
      expect(pageableApi._extractAndAggregateResults(responses)).to.be.an('array').to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });
  describe('_copyOfRequestWithPagingParameters tests', function() {
    it('request without params', async () => {
      const fakeApi = {};
      fakeApi.url = null;
      const pageableApi = new PageableApi(10, fakeApi);

      expect(pageableApi._copyOfRequestWithPagingParameters({}, 0)).to.deep.equal({params: {Limit: 10, Skip: 0}});
    });

    it('request with params', async () => {
      const fakeApi = {};
      fakeApi.url = null;
      const pageableApi = new PageableApi(10, fakeApi);

      expect(pageableApi._copyOfRequestWithPagingParameters({params: {Limit: 3, Skip: 2}}, 0)).to.deep.equal({
        params: {
          Limit: 10,
          Skip: 0
        }
      });
    });
    it('3 skipped pages', async () => {
      const fakeApi = {};
      fakeApi.url = null;
      const pageableApi = new PageableApi(10, fakeApi);

      expect(pageableApi._copyOfRequestWithPagingParameters({}, 3)).to.deep.equal({params: {Limit: 10, Skip: 30}});
    });
  });

  describe('_requestAllPages tests', function() {
    it('request one page', async () => {
      const fakeApi = {};
      fakeApi.url = null;
      const pageableApi = new PageableApi(10, fakeApi);

      expect(await pageableApi._requestAllPages({}, 0)).to.deep.equal([]);
    });
    it('request one page', async () => {
      const fakeApi = {};
      const reponse1 = {
        status: 200,
        data: {count: 1, result: []}
      };

      fakeApi.send = sinon.fake.returns(reponse1);
      fakeApi.url = null;
      const pageableApi = new PageableApi(10, fakeApi);

      expect(await pageableApi._requestAllPages({}, 1)).to.deep.equal([reponse1]);
    });
    it('request mutliple pages', async () => {
      const fakeApi = {};
      const response1 = {
        status: 200,
        data: {count: 1, result: [1]}
      };
      const response2 = {
        status: 200,
        data: {count: 1, result: [2]}
      };
      fakeApi.send = sinon.stub();
      fakeApi.send.onFirstCall().returns(response1);
      fakeApi.send.onSecondCall().returns(response2);
      fakeApi.url = null;
      const pageableApi = new PageableApi(10, fakeApi);
      expect(await pageableApi._requestAllPages({}, 2)).to.deep.equal([response1, response2]);
    });
  });
  describe('send tests', function() {
    it('no results to read', async () => {
      const fakeApi = {};
      fakeApi.url = null;
      fakeApi.send = sinon.stub();

      fakeApi.send.returns({
        status: 200,
        data: {count: 0, result: []}
      });

      const pageableApi = new PageableApi(10, fakeApi);
      expect(await pageableApi.send({method: 'GET'})).to.deep.equal(
        {
          data: {
            count: 0,
            result: []
          },
          status: 200
        }
      );
    });

    it('request mutliple pages', async () => {
      const fakeApi = {};
      const response1 = {
        status: 200,
        data: {count: 2, result: [1]}
      };
      const response2 = {
        status: 200,
        data: {count: 2, result: [2]}
      };
      fakeApi.send = sinon.stub();
      fakeApi.send.onCall(0).returns(response1);
      fakeApi.send.onCall(1).returns(response1);
      fakeApi.send.onCall(2).returns(response2);
      fakeApi.url = null;
      const pageableApi = new PageableApi(1, fakeApi);
      expect(await pageableApi.send({method: 'GET'})).to.deep.equal(
        {
          data: {
            count: 2,
            result: [1, 2]
          },
          status: 200
        }
      );
    });
  });

});
