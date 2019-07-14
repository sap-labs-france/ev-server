import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import Utils from '../../../../utils/Utils';
import UserToken from '../../../../types/UserToken';

export default class UtilsSecurity {
  static filterBoolean(value) {
    let result = false;
    // Check boolean
    if (value) {
      // Sanitize
      value = sanitize(value);
      // Check the type
      if (typeof value === 'boolean') {
        // Already a boolean
        result = value;
      } else {
        // Convert
        result = (value === 'true');
      }
    }
    return result;
  }

  static filterSort(request, filteredRequest) {
    // Exist?
    if (request.SortFields) {
      // Sanitize
      request.SortFields = sanitize(request.SortFields);
      request.SortDirs = sanitize(request.SortDirs);
      // Array?
      if (Array.isArray(request.SortFields) && request.SortFields.length > 0) {
        // Init
        filteredRequest.Sort = {};
        // Build
        for (let i = 0; i < request.SortFields.length; i++) {
          let sortField = request.SortFields[i];
          // Check field ID
          if (sortField === 'id') {
            // In MongoDB it's '_id'
            sortField = '_id';
          }
          // Set
          filteredRequest.Sort[sortField] = (request.SortDirs[i] === 'asc' ? 1 : -1);
        }
      } else {
        // Init
        filteredRequest.Sort = {};
        // Check field ID
        if (request.SortFields === 'id') {
          // In MongoDB it's '_id'
          request.SortFields = '_id';
        }
        // Set
        filteredRequest.Sort[request.SortFields] = (request.SortDirs === 'asc' ? 1 : -1);
      }
    }
  }

  static filterSkipAndLimit(request, filteredRequest) {
    // Limit
    UtilsSecurity.filterLimit(request, filteredRequest);
    // Skip
    UtilsSecurity.filterSkip(request, filteredRequest);
    // Count Only?
    if (request.hasOwnProperty('OnlyRecordCount')) {
      filteredRequest.OnlyRecordCount = sanitize(request.OnlyRecordCount);
    }
  }

  static filterLimit(request, filteredRequest) {
    // Exist?
    if (!request.Limit) {
      // Default
      filteredRequest.Limit = Constants.DEFAULT_DB_LIMIT;
    } else {
      // Parse
      filteredRequest.Limit = parseInt(sanitize(request.Limit));
      if (isNaN(filteredRequest.Limit)) {
        filteredRequest.Limit = Constants.DEFAULT_DB_LIMIT;
        // Negative limit?
      } else if (filteredRequest.Limit < 0) {
        filteredRequest.Limit = Constants.DEFAULT_DB_LIMIT;
      }
    }
  }

  static filterSkip(request, filteredRequest) {
    // Exist?
    if (!request.Skip) {
      // Default
      filteredRequest.Skip = 0;
    } else {
      // Parse
      filteredRequest.Skip = parseInt(sanitize(request.Skip));
      if (isNaN(filteredRequest.Skip)) {
        filteredRequest.Skip = 0;
        // Negative?
      } else if (filteredRequest.Skip < 0) {
        filteredRequest.Skip = 0;
      }
    }
  }

  static filterAddressRequest(address) {
    const filteredAddress: any = {};
    if (address) {
      filteredAddress.address1 = sanitize(address.address1);
      filteredAddress.address2 = sanitize(address.address2);
      filteredAddress.postalCode = sanitize(address.postalCode);
      filteredAddress.city = sanitize(address.city);
      filteredAddress.department = sanitize(address.department);
      filteredAddress.region = sanitize(address.region);
      filteredAddress.country = sanitize(address.country);
      filteredAddress.latitude = sanitize(address.latitude);
      filteredAddress.longitude = sanitize(address.longitude);
    }
    return filteredAddress;
  }

  static filterCreatedAndLastChanged(filteredEntity, entity, loggedUser: UserToken) {
    if (entity.createdBy && typeof entity.createdBy === 'object' &&
      entity.createdBy.id && Authorizations.canReadUser(loggedUser, entity.createdBy.id)) {
      // Build user
      filteredEntity.createdBy = Utils.buildUserFullName(entity.createdBy, false);
    }
    if (entity.lastChangedBy && typeof entity.lastChangedBy === 'object' &&
      entity.lastChangedBy.id && Authorizations.canReadUser(loggedUser, entity.lastChangedBy.id)) {
      // Build user
      filteredEntity.lastChangedBy = Utils.buildUserFullName(entity.lastChangedBy, false);
    }
    if (entity.lastChangedOn) {
      filteredEntity.lastChangedOn = entity.lastChangedOn;
    }
    if (entity.createdOn) {
      filteredEntity.createdOn = entity.createdOn;
    }
  }
}

