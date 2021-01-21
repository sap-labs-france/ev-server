import Address from '../../../../../types/Address';
import Authorizations from '../../../../../authorization/Authorizations';
import Constants from '../../../../../utils/Constants';
import UserToken from '../../../../../types/UserToken';
import Utils from '../../../../../utils/Utils';
import sanitize from 'mongo-sanitize';

export default class UtilsSecurity {
  static filterBoolean(value): boolean {
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

  static filterSort(request, filteredRequest): void {
    // Deprecated sorting?
    if (Utils.objectHasProperty(request, 'SortDirs')) {
      this.filterOldSort(request, filteredRequest);
      return;
    }
    // Exist?
    if (request.SortFields) {
      // Sanitize
      request.SortFields = sanitize(request.SortFields);
      request.SortFields = request.SortFields.split('|');
      // Array?
      if (request.SortFields.length > 0) {
        // Init
        filteredRequest.Sort = {};
        // Build
        for (let i = 0; i < request.SortFields.length; i++) {
          let sortField: string = request.SortFields[i];
          const order = sortField.startsWith('-') ? -1 : 1;
          // Remove ordering prefix
          sortField = sortField.startsWith('-') ? sortField.substr(1) : sortField;
          // Check field ID
          if (sortField === 'id') {
            // In MongoDB it's '_id'
            sortField = '_id';
          }
          // Set
          filteredRequest.Sort[sortField] = order;
        }
      }
    }
  }

  // TODO: To remove in the next mobile deployment > 1.3.22
  static filterOldSort(request, filteredRequest): void {
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

  static filterSkipAndLimit(request: any, filteredRequest: any): void {
    // Limit
    UtilsSecurity.filterLimit(request, filteredRequest);
    // Skip
    UtilsSecurity.filterSkip(request, filteredRequest);
    // Count Only?
    if (Utils.objectHasProperty(request, 'OnlyRecordCount')) {
      filteredRequest.OnlyRecordCount = UtilsSecurity.filterBoolean(request.OnlyRecordCount);
    }
  }

  static filterLimit(request: any, filteredRequest: any): void {
    // Exist?
    if (!request.Limit) {
      // Default
      filteredRequest.Limit = Constants.DB_RECORD_COUNT_DEFAULT;
    } else {
      // Parse
      filteredRequest.Limit = Utils.convertToInt(sanitize(request.Limit));
      if (isNaN(filteredRequest.Limit)) {
        filteredRequest.Limit = Constants.DB_RECORD_COUNT_DEFAULT;
        // Negative limit?
      } else if (filteredRequest.Limit < 0) {
        filteredRequest.Limit = Constants.DB_RECORD_COUNT_DEFAULT;
      }
    }
  }

  static filterSkip(request: any, filteredRequest: any): void {
    // Exist?
    if (!request.Skip) {
      // Default
      filteredRequest.Skip = 0;
    } else {
      // Parse
      filteredRequest.Skip = Utils.convertToInt(sanitize(request.Skip));
      if (isNaN(filteredRequest.Skip)) {
        filteredRequest.Skip = 0;
        // Negative?
      } else if (filteredRequest.Skip < 0) {
        filteredRequest.Skip = 0;
      }
    }
  }

  static filterAddressRequest(address: Address): Address {
    const filteredAddress: Address = {} as Address;
    if (address) {
      filteredAddress.address1 = sanitize(address.address1);
      filteredAddress.address2 = sanitize(address.address2);
      filteredAddress.postalCode = sanitize(address.postalCode);
      filteredAddress.city = sanitize(address.city);
      filteredAddress.department = sanitize(address.department);
      filteredAddress.region = sanitize(address.region);
      filteredAddress.country = sanitize(address.country);
      if (address.coordinates && address.coordinates.length === 2) {
        filteredAddress.coordinates = [
          sanitize(address.coordinates[0]),
          sanitize(address.coordinates[1])
        ];
      }
    }
    return filteredAddress;
  }

  static filterAddressCoordinatesRequest(address: Address): Address {
    const filteredAddress: Address = {} as Address;
    if (address) {
      if (address.coordinates && address.coordinates.length === 2) {
        filteredAddress.coordinates = [
          sanitize(address.coordinates[0]),
          sanitize(address.coordinates[1])
        ];
      }
    }
    return filteredAddress;
  }

  static filterCreatedAndLastChanged(filteredEntity: any, entity: any, loggedUser: UserToken): void {
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

