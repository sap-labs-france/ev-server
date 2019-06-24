import moment from 'moment-timezone';
import _ from 'lodash';

export default class AbstractODataEntities {
  static buildParams(query) {
    // Check limit parameter
    const limit = query.$limit ? query.$limit : 0;
    const params: any = {};
    params.Skip = query.$skip;
    params.Limit = limit;
    return params;
  }

  static convert(object, req) {
    // This implementation is necessary as the OData-imple-server do not support multiple key
    // We have to build a unique key based on tenant and object real key
    const uniqueID = this.getObjectKey(object);

    // Set tenant
    return _.merge({ uniqueID: `${req.tenant}-${uniqueID}`, tenant: req.tenant }, object);
  }

  // eslint-disable-next-line no-unused-vars
  static getObjectKey(object) {
    throw new Error("Abstract Implementation");
  }

  static convertTimestamp(timestampUTC, req) {
    return (req.timezone && timestampUTC) ? moment(timestampUTC).tz(req.timezone).format() : timestampUTC;
  }

  static buildDateObject(timestamp, req) {
    if (!timestamp) {
      return;
    }
    // Date object: Date/DayOfTheWeek/HourOfTheDay
    const date = moment(timestamp).tz(req.timezone);
    return {
      date: date.format('YYYY-MM-DD'),
      dayOfTheWeek: parseInt(date.format("d")),
      hourOfTheDay: date.hours(),
      weekOfTheYear: parseInt(date.format("W"))
    };
  }

  static returnResponse(response, query, req, cb) {
    let count = 0;
    let result = [];
    let fields = [];
    // Check if error
    if (response.status !== 200) {
      cb({ message: response.data.message });
      return;
    }
    // Get fields to filter
    if (query.$select) {
      fields = Object.keys(query.$select);
    }
    // Reduce returned object attribute
    if (response.data && response.data.result && response.data.count) {
      count = response.data.count;
      result = response.data.result;
      if (fields.length !== 0) {
        if (Array.isArray(result)) {
          result = result.map((object) => {
            return _.pick(this.convert(object, req), fields);
          });
        } else {
          result = [_.pick(this.convert(result, req), fields)];
        }
      } else {
        // eslint-disable-next-line no-lonely-if
        if (Array.isArray(result)) {
          result = result.map((object) => {
            return this.convert(object, req);
          });
        } else {
          result = this.convert(result, req);
        }
      }
    }
    // Return response
    if (query.$inlinecount) {
      cb(null, {
        count: count,
        value: result
      });
    } else {
      // pragma cb(null, response.data.result);
      cb(null, result);
    }
  }
}
