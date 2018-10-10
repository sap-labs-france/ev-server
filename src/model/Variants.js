const Database = require('../utils/Database');
const User = require('./User');
const AppError = require('../exception/AppError');
const UserStorage = require('../storage/mongodb/UserStorage');
const VariantsStorage = require('../storage/mongodb/VariantsStorage');

class Variants {
  constructor(variants) {
    // Init model
    this._model = {};

    // Set it
    Database.updateVariants(site, this._model);
  }

  getModel() {
    return this._model;
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

  setVariants(variants) {
    this._model.variants = variants;
  }

  getVariants() {
    return this._model.variants;
  }

  getVariant() {
    let index = -1;
    if (this._model.variants) {
      // Search
      for (var i = 0; i < this._model.variants.length; i++) {
        if (this._model.variants[i].name == variant.getName()) {
          // Remove
          index = i;
          break;
        }
      }
    }
    return index;
  }

  addVariant(variant) {
    this._model.variants.push(variant);
  }

  removeVariant(variant) {
    if (this._model.variants) {
      // Search
      for (var i = 0; i < this._model.variants.length; i++) {
        if (this._model.variants[i].name == variant.getName()) {
          // Remove
          this._model.variants.splice(i, 1);
          break;
        }
      }
    }
  }

  setFilters(variant, filters) {
    // Find variant
    let index = this.getVariant(variant);
    if (index > -1) {
      this._model.variants[index].filters = filters;
    }
  }

  getFilters(variant) {
    // Find variant
    let index = this.getVariant(variant);
    if (index > -1) {
      return this._model.variants[index].filters;
    }
  }

  getFilter(variant, filter) {
    let filterIndex = -1;
    // Find variant
    const variantIndex = this.getVariant(variant);

    if (variantIndex > -1) {
      // Find filter
      for (
        var i = 0;
        i < this._model.variants[variantIndex].filters.length;
        i++
      ) {
        if (
          this._model.variants[variantIndex].filters[i].filterID ==
          filter.filterID
        ) {
          // Remove
          filterIndex = i;
          break;
        }
      }
    }
    // Return
    return filterIndex;
  }

  addFilter(variant, filter) {
    // Find variant
    let index = this.getVariant(variant);
    if (index > -1) {
      this._model.variants[index].filters.push(filter);
    }
  }

  removeFilter(variant, filter) {
    // Find variant
    const variantIndex = this.getVariant(variant);
    if (variantIndex > -1) {
      for (
        var i = 0;
        i < this._model.variants[variantIndex].filters.length;
        i++
      ) {
        if (
          this._model.variants[variantIndex].filters[i].filterID ==
          filter.filterID
        ) {
          // Remove
          this._model.variants[variantIndex].filters.splice(i, 1);
          break;
        }
      }
    }
  }

  static checkIfVariantsValid(filteredRequest, request) {
    // Update model?
    if (request.method !== 'POST' && !filteredRequest.viewID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `View ID is mandatory`,
        500,
        'Site',
        'checkIfVariantsValid'
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
    return VariantsStorage.saveVariants(this.getModel());
  }

  delete() {
    return VariantsStorage.deleteVariants(this.getViewID(), this.getUserID());
  }
}

module.exports = Variants;
