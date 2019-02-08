
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
    // return response
    if (query.$inlinecount) {
      cb(null, {
        count: response.data.count,
        value: response.data.result
      });
    } else {
      cb(null, response.data.result);
    }
  }
}

module.exports = AbstractODataEntities;