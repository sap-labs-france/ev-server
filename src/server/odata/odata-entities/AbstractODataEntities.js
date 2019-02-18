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

  static convert(object,tenant) {
    // set tenant
    return _.merge({ tenant: tenant}, object);
  }

  static convertTimestamp(timestampUTC, tz) {
    return  (tz && timestampUTC) ? moment(timestampUTC).tz(tz).format() : timestampUTC; 
  }

  static buildDateObject(timestamplocal,tz) {
    if (!timestamplocal) {
      return;
    }
    
    // date object: Date/DayOfTheWeek/ourOfTheDay
    const date = moment(timestamplocal);
    date.utcOffset(0);
    // date.local();
    return {
      date: date.format('YYYY-MM-DD'),
      dayOfTheWeek: date.format("d"),
      hourOfTheDay: date.hours(),
      weekOfTheYear: date.format("W")
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
          result = result.map((object)=> {return _.pick(this.convert(object,req.tenant),fields)});
        } else {
          result = _.pick(this.convert(result,req.tenant), fields);
        }
      } else {
        if (Array.isArray(result)) {
          result = result.map((object)=> {return this.convert(object,req.tenant)});
        } else {
          result = this.convert(result,req.tenant);
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