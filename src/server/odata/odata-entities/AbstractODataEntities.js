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

  static returnResponse(response,query,req,cb) {
    let count = 0;
    let result = [];

    // reduce returned object attribute
    if (response.data && response.data.result && response.data.count) {
      count = response.data.count;
      result = response.data.result;
      const fields = Object.keys(query.$select);

      if (fields.length != 0) {
        if (Array.isArray(result)) {
          result = result.map((object)=> {return _.pick(object,fields)});
        } else {
          result = _.pick(result, fields);
        }
      }
    }

    // return response
    if (query.$inlinecount) {
      cb(null, {
        // count: response.data.count,
        // value: response.data.result
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