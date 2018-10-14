const Database = require('../utils/Database');
const User = require('./User');
const AppError = require('../exception/AppError');
const Constants = require('../utils/Constants');
const UserStorage = require('../storage/mongodb/UserStorage');
const VariantStorage = require('../storage/mongodb/VariantStorage');

class Variant {
  constructor(variant) {
    // Init model
    this._model = {};

    // Set it
    Database.updateVariant(variant, this._model);
  }

  getModel() {
    return this._model;
  }

  getID() {
    return this._model.id;
  }

  setName(name) {
    this._model.name = name;
  }

  getName() {
    return this._model.name;
  }

  setViewID(viewID) {
    this._model.viewID = viewID;
  }

  getViewID() {
    return this._model.viewID;
  }

  setUserID(userID) {
    this._model.userID = userID;
  }

  getUserID() {
    return this._model.userID;
  }

  setFilters(filters) {
    this._model.filters = filters;
  }

  getFilters() {
    return this._model.filters;
  }

  getFilter(filterID) {
    if (this._model.filters) {
      // Search
      for (var i = 0; i < this._model.filters.length; i++) {
        if (this._model.filters[i].filterID == filterID) {
          // Return
          return filters[i];
        }
      }
    }
  }

  addFilter(filter) {
    this._model.filters.push(filter);
  }

  removeFilter(filter) {
    if (this._model.filters) {
      // Search
      for (var i = 0; i < this._model.filters.length; i++) {
        if (this._model.filters[i].filterID == filter.filterID) {
          // Remove
          this._model.filters.splice(i, 1);
          break;
        }
      }
    }
  }

  static checkIfVariantValid(request, httpRequest) {
    // ID?
    if (httpRequest.method !== 'POST' && !request.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Variant ID is mandatory`,
        500,
        'Variant',
        'checkIfVariantValid'
      );
    }
    // ViewID
    if (!request.viewID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `View ID is mandatory`,
        500,
        'Variant',
        'checkIfVariantValid'
      );
    }

    if (!request.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Variant name is mandatory`,
        500,
        'Variant',
        'checkIfVariantValid'
      );
    }

    if (!request.filters) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Filters are mandatory`,
        500,
        'Variant',
        'checkIfVariantValid'
      );
    }
  }

  async getUser() {
    if (this._model.user) {
      return new User(this._model.user);
    } else if (this._model.userID) {
      // Get from DB
      let user = await UserStorage.getUser(his._model.userID);
      // Keep it
      this.setUser(user);
      return user;
    }
  }

  setUser(user) {
    if (user) {
      this._model.user = user.getModel();
      this._model.userID = user.getID();
    } else {
      this._model.user = null;
    }
  }

  save() {
    return VariantStorage.saveVariant(this.getModel());
  }

  delete() {
    return VariantStorage.deleteVariant(this.getID());
  }
}

module.exports = Variant;
