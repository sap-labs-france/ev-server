const _ = require('lodash');

class AbstractODataEntities {
  static buildParams(query) {
    // check limit parameter
    const limit = query.$limit ? query.$limit : 0;

    const params = {};
    params.Skip = query.$skip;
    params.Limit = limit;

    return params;
  }

  static convert(object) {
    return object;
  }

  static returnResponse(response, query, req, cb) {
    let count = 0;
    let result = [];
    let fields = [];

    // check if error
    if (response.status != 200) {
      cb({ message: response.data.message });
      return;
    }

    // get fields to filter
    if (query.$select) {
      fields = Object.keys(query.$select);
    }

    // reduce returned object attribute
    if (response.data && response.data.result && response.data.count) {
      count = response.data.count;
      result = response.data.result;

      if (fields.length != 0) {
        if (Array.isArray(result)) {
          result = result.map((object)=> {return _.pick(this.convert(object),fields)});
        } else {
          result = _.pick(this.convert(result), fields);
        }
      } else {
        if (Array.isArray(result)) {
          result = result.map((object)=> {return this.convert(object)});
        } else {
          result = this.convert(result);
        }
      }
    }

    // return response
    if (query.$inlinecount) {
      cb(null, {
        count: count,
        value: result
      });
    } else {
      // cb(null, response.data.result);
      cb(null, result);
    }
  }
}

module.exports = AbstractODataEntities;