import { StatusCodes } from 'http-status-codes';
import Utils from '../../../utils/Utils';
import _ from 'lodash';
import moment from 'moment-timezone';

export default abstract class AbstractODataEntities {
  public buildParams(query) {
    // Check limit parameter
    const limit = query.$limit ? query.$limit : 0;
    const params: any = {};
    params.Skip = query.$skip;
    params.Limit = limit;
    return params;
  }

  public moveAddressToRoot(entity: any): any {
    if (!entity) {
      return null;
    }
    // Handle address
    if (entity.address) {
      entity = _.merge(entity, entity.address);
      // Handle coordinates
      this.moveCoordinatesToRoot(entity, entity.address);
    }
    return entity;
  }

  public moveCoordinatesToRoot(entity: any, coordinatesEntity?: any): any {
    if (!entity) {
      return null;
    }
    if (!coordinatesEntity) {
      coordinatesEntity = entity;
    }
    if (coordinatesEntity.coordinates && Array.isArray(coordinatesEntity.coordinates) && coordinatesEntity.coordinates.length === 2) {
      entity.latitude = coordinatesEntity.coordinates[1];
      entity.longitude = coordinatesEntity.coordinates[0];
    } else {
      entity.latitude = '';
      entity.longitude = '';
    }
    return entity;
  }

  public convert(object, req) {
    // This implementation is necessary as the OData-imple-server do not support multiple key
    // We have to build a unique key based on tenant and object real key
    const uniqueID = this.getObjectKey(object);
    // Set tenant
    return _.merge({ uniqueID: `${req.tenant}-${uniqueID}`, tenant: req.tenant }, object);
  }

  public convertTimestamp(timestampUTC, req) {
    return (req.timezone && timestampUTC) ? moment(timestampUTC).tz(req.timezone).format() : timestampUTC;
  }

  public buildDateObject(timestamp, req) {
    if (!timestamp) {
      return;
    }
    // Date object: Date/DayOfTheWeek/HourOfTheDay
    const date = moment(timestamp).tz(req.timezone);
    return {
      date: date.format('YYYY-MM-DD'),
      dayOfTheWeek: Utils.convertToInt(date.format('d')),
      hourOfTheDay: date.hours(),
      weekOfTheYear: Utils.convertToInt(date.format('W'))
    };
  }

  public returnResponse(response, query, req, cb) {
    let count = 0;
    let result = [];
    let fields = [];
    // Check if error
    if (response.status !== StatusCodes.OK) {
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
          result = result.map((object) => _.pick(this.convert(object, req), fields));
        } else {
          result = [_.pick(this.convert(result, req), fields)];
        }
      } else {
        // eslint-disable-next-line no-lonely-if
        if (Array.isArray(result)) {
          result = result.map((object) => this.convert(object, req));
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

  public abstract getObjectKey(object: any): string;
}
