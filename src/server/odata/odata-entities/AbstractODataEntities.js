// const moment = require('moment');
const moment = require('moment-timezone');
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

  static convert(object,req) {
    // get Object Key
    // this implementation is necessary as the OData-imple-server do not support multiple key
    // we have to build a unique key based on tenant and object real key
    const uniqueID = this.getObjectKey(object);

    // set tenant
    return _.merge({ uniqueID: `${req.tenant}-${uniqueID}`, tenant: req.tenant}, object);
  }

  // Abstract - should be implemented in class
  // eslint-disable-next-line no-unused-vars
  static getObjectKey(object) {
    throw new Error("Abstract Implementation");
  }

  // convert timestamp based on time eg: 'Europe/Paris'
  static convertTimestamp(timestampUTC, req) {
    return  (req.timezone && timestampUTC) ? moment(timestampUTC).tz(req.timezone).format() : timestampUTC; 
  }

  static buildDateObject(timestamp,req) {
    if (!timestamp) {
      return;
    }
    
    // date object: Date/DayOfTheWeek/ourOfTheDay
    const date = moment(timestamp).tz(req.timezone);
    return {
      date: date.format('YYYY-MM-DD'),
      dayOfTheWeek: parseInt(date.format("d")),
      hourOfTheDay: date.hours(),
      weekOfTheYear: parseInt(date.format("W"))
    }
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
          result = result.map((object)=> {return _.pick(this.convert(object,req),fields)});
        } else {
          result = _.pick(this.convert(result,req), fields);
        }
      } else {
        if (Array.isArray(result)) {
          result = result.map((object)=> {return this.convert(object,req)});
        } else {
          result = this.convert(result,req);
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