const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const UtilsSecurity = require('./UtilsSecurity');

class VariantsSecurity {
  static filterVariantsDeleteRequest(request) {
    let filteredRequest = {};
    // Set
    filteredRequest.viewID = sanitize(request.viewID);
    filteredRequest.userID = sanitize(request.userID);
    return filteredRequest;
  }

  static filterVariantsRequest(request, loggedUser) {
    let filteredRequest = {};
    filteredRequest.ViewID = sanitize(request.ViewID);
    filteredRequest.UserID = sanitize(request.UserID);
    filteredRequest.Global = sanitize(request.Global);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterVariantsUpdateRequest(request, loggedUser) {
    // Set
    let filteredRequest = VariantsSecurity._filterVariantsRequest(
      request,
      loggedUser
    );
    filteredRequest.viewID = sanitize(request.viewID);
    filteredRequest.userID = sanitize(request.userID);
    return filteredRequest;
  }

  static filterVariantsCreateRequest(request, loggedUser) {
    let filteredRequest = VariantsSecurity._filterVariantsRequest(
      request,
      loggedUser
    );
    filteredRequest.viewID = sanitize(request.viewID);
    filteredRequest.userID = sanitize(request.userID);
    return filteredRequest;
  }

  static _filterVariantsRequest(request) {
    let filteredRequest = {};
    for (var i = 0; i < request.variants.length; i++) {
      filteredRequest.variants.push(sanitize(request.variants[i]).variantName);
      for (var j = 0; j < request.variants[i].filters.length; j++) {
        filteredRequest.variants[i].filters.push(
          sanitize(request.variants[i].filters[j]).variantName
        );
      }
    }
    return filteredRequest;
  }

  static filterVariantsResponse(variants, loggedUser) {
    let filteredVariants;

    if (!variants) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadVariants(loggedUser, variants)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredVariants = variants;
      } else {
        // Set only necessary info
        filteredVariants = variants;
      }
    }
    return filteredVariants;
  }

  static filterVariantsListResponse(variants, loggedUser) {
    let filteredVariants = [];

    if (!variants) {
      return null;
    }
    if (!Authorizations.canListVariants(loggedUser)) {
      return null;
    }
    for (const variant of variants) {
      // Filter
      let filteredVariant = VariantsSecurity.filterVariantsResponse(
        variant,
        loggedUser
      );
      // Ok?
      if (filteredVariants) {
        // Add
        filteredVariants.push(filteredVariant);
      }
    }
    return filteredVariants;
  }
}

module.exports = VariantsSecurity;
