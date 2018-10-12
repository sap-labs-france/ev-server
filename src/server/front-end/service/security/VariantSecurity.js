const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const UtilsSecurity = require('./UtilsSecurity');

class VariantSecurity {
  static filterVariantDeleteRequest(request) {
    let filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterVariantRequest(request, loggedUser) {
    let filteredRequest = {};
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterVariantsRequest(request, loggedUser) {
    let filteredRequest = {};
    filteredRequest.Name = sanitize(request.Name);
    filteredRequest.ViewID = sanitize(request.ViewID);
    filteredRequest.UserID = sanitize(request.UserID);
    filteredRequest.WithGlobal = UtilsSecurity.filterBoolean(
      request.WithGlobal
    );
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterVariantUpdateRequest(request, loggedUser) {
    // Set
    let filteredRequest = VariantSecurity._filterVariantRequest(
      request,
      loggedUser
    );
    filteredRequest.id = sanitize(request.id);
    filteredRequest.name = sanitize(request.name);
    filteredRequest.viewID = sanitize(request.viewID);
    filteredRequest.userID = sanitize(request.userID);
    return filteredRequest;
  }

  static filterVariantCreateRequest(request, loggedUser) {
    let filteredRequest = VariantSecurity._filterVariantRequest(
      request,
      loggedUser
    );
    filteredRequest.name = sanitize(request.name);
    filteredRequest.viewID = sanitize(request.viewID);
    filteredRequest.userID = sanitize(request.userID);
    return filteredRequest;
  }

  static _filterVariantRequest(request) {
    let filteredRequest = {};
    filteredRequest.filters = [];
    for (var i = 0; i < request.filters.length; i++) {
      let filter = {
        filterID: sanitize(request.filters[i].filterID),
        filterContent: sanitize(request.filters[i].filterContent)
      };
      filteredRequest.filters.push(filter);
    }
    return filteredRequest;
  }

  static filterVariantResponse(variant, loggedUser) {
    let filteredVariant;

    if (!variant) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadVariant(loggedUser, variant)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredVariant = variant;
      } else {
        // Set only necessary info
        filteredVariant = variant;
      }
    }
    return filteredVariant;
  }

  static filterVariantsResponse(variants, loggedUser) {
    let filteredVariants = [];

    if (!variants) {
      return null;
    }
    if (!Authorizations.canListVariants(loggedUser)) {
      return null;
    }
    for (const variant of variants) {
      // Filter
      let filteredVariant = VariantSecurity.filterVariantResponse(
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

module.exports = VariantSecurity;
