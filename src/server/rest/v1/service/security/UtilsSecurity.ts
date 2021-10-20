import Address from '../../../../../types/Address';
import Constants from '../../../../../utils/Constants';
import Utils from '../../../../../utils/Utils';
import sanitize from 'mongo-sanitize';

export default class UtilsSecurity {
  public static filterBoolean(value): boolean {
    let result = false;
    // Check boolean
    if (value) {
      // Sanitize
      value = sanitize(value);
      // Check the type
      if (Utils.isBoolean(value)) {
        // Already a boolean
        result = value;
      } else {
        // Convert
        result = (value === 'true');
      }
    }
    return result;
  }

  public static filterSort(request: any, filteredRequest): void {
    // Exist?
    if (Utils.objectHasProperty(request, 'SortFields')) {
      // Sanitize
      request.SortFields = sanitize(request.SortFields);
      const sortFields = request.SortFields.split('|');
      if (!Utils.isEmptyArray(sortFields)) {
        filteredRequest.SortFields = {};
        // Build
        for (let i = 0; i < sortFields.length; i++) {
          let sortField: string = sortFields[i];
          const order = sortField.startsWith('-') ? -1 : 1;
          // Remove ordering prefix
          sortField = sortField.startsWith('-') ? sortField.substr(1) : sortField;
          // Check field ID
          if (sortField === 'id') {
            // In MongoDB it's '_id'
            sortField = '_id';
          }
          // Set
          filteredRequest.SortFields[sortField] = order;
        }
      }
    }
  }

  public static filterProject(request: any, filteredRequest: any): void {
    if (Utils.objectHasProperty(request, 'ProjectFields')) {
      filteredRequest.ProjectFields = sanitize(request.ProjectFields);
    }
  }

  public static filterSkipAndLimit(request: any, filteredRequest: any): void {
    // Limit
    UtilsSecurity.filterLimit(request, filteredRequest);
    // Skip
    UtilsSecurity.filterSkip(request, filteredRequest);
    // Count Only?
    if (Utils.objectHasProperty(request, 'OnlyRecordCount')) {
      filteredRequest.OnlyRecordCount = UtilsSecurity.filterBoolean(request.OnlyRecordCount);
    }
  }

  public static filterLimit(request: any, filteredRequest: any): void {
    // Exist?
    if (!Utils.objectHasProperty(request, 'Limit')) {
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

  public static filterSkip(request: any, filteredRequest: any): void {
    // Exist?
    if (!Utils.objectHasProperty(request, 'Skip')) {
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

  public static filterAddressRequest(address: Address): Address {
    const filteredAddress: Address = {} as Address;
    if (address) {
      filteredAddress.address1 = sanitize(address.address1);
      filteredAddress.address2 = sanitize(address.address2);
      filteredAddress.postalCode = sanitize(address.postalCode);
      filteredAddress.city = sanitize(address.city);
      filteredAddress.department = sanitize(address.department);
      filteredAddress.region = sanitize(address.region);
      filteredAddress.country = sanitize(address.country);
      filteredAddress.coordinates = UtilsSecurity.filterAddressCoordinatesRequest(address);
    }
    return filteredAddress;
  }

  public static filterAddressCoordinatesRequest(address: Address): number[] {
    if (address && Utils.objectHasProperty(address, 'coordinates') && !Utils.isEmptyArray(address.coordinates) && address.coordinates.length === 2) {
      return [
        sanitize(address.coordinates[0]),
        sanitize(address.coordinates[1])
      ];
    }
    return [];
  }
}

