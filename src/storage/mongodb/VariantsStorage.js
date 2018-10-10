const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const AppError = require('../../exception/AppError');

class VariantsStorage {
  static async getGlobalVariantsByID(viewID) {
    const Variants = require('../../model/Variants'); // Avoid fucking circular deps!!!
    // Create Aggregation
    let aggregation = [];
    // Filters
    aggregation.push({
      $match: {$and: [{viewID: viewID}, {userID: null}]}
    });
    // Read DB
    let variantsMDB = await global.db
      .collection('variants')
      .aggregate(aggregation)
      .toArray();
    // Set
    let variants = null;
    if (variantsMDB && variantsMDB.length > 0) {
      // Create
      variants = new Variants(variantsMDB[0]);
    }
    return variants;
  }

  static async getUserVariantsByID(viewID, userID, global) {
    const Variants = require('../../model/Variants'); // Avoid fucking circular deps!!!
    // Create Aggregation
    let aggregation = [];
    let filters = {};
    // Filters
    if (global) {
      filters = {
        $and: [{viewID: viewID}, {$or: [{userID: userID}, {userID: null}]}]
      };
    } else {
      filters = {$and: [{viewID: viewID}, {userID: userID}]};
    }
    aggregation.push({
      $match: filters
    });
    // Read DB
    let variantsMDB = await global.db
      .collection('variants')
      .aggregate(aggregation)
      .toArray();
    // Set
    let variants = null;
    if (variantsMDB && variantsMDB.length > 0) {
      // Create
      variants = new Variants(variantsMDB[0]);
    }
    return variants;
  }

  static async saveVariants(variantsToSave) {
    const Variants = require('../../model/Variants'); // Avoid fucking circular deps!!!
    // Check if ID/Model is provided
    if (!variantsToSave.viewID && !variantsToSave.model) {
      // ID must be provided!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Variants has no View ID and no Model`,
        550,
        'VariantsStorage',
        'saveVariants'
      );
    }
    let variantsFilter = {};
    // Build Request
    if (variantsToSave.viewID) {
      vehicleFilter.viewID = variantsToSave.viewID;
    }
    // Transfer
    let variants = {};
    Database.updateVariants(variantsToSave, variants, false);
    // Modify
    let result = await global.db
      .collection('variants')
      .findOneAndUpdate(
        variantsFilter,
        {$set: variants},
        {upsert: true, new: true, returnOriginal: false}
      );
    // Create
    return new Variants(result.value);
  }

  // Delegate
  static async getVariants(params = {}, limit, skip, sort) {
    const Variants = require('../../model/Variants'); // Avoid fucking circular deps!!!
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    let filters = {};
    // Source?
    if (params.viewID) {
      // Build filter
      filters.viewID = params.viewID;
    }
    // Set User?
    if (params.userID) {
      filters.userID = Utils.convertToObjectID(params.userID);
    }
    // Create Aggregation
    let aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Count Records
    let variantsCountMDB = await global.db
      .collection('variants')
      .aggregate([...aggregation, {$count: 'count'}])
      .toArray();
    // Sort
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
      });
    } else {
      // Default
      aggregation.push({
        $sort: {
          viewID: 1,
          userID: 1
        }
      });
    }
    // Skip
    aggregation.push({
      $skip: skip
    });
    // Limit
    aggregation.push({
      $limit: limit
    });
    // Read DB
    let variantsMDB = await global.db
      .collection('variants')
      .aggregate(aggregation, {
        collation: {locale: Constants.DEFAULT_LOCALE, strength: 2}
      })
      .toArray();
    let variants = [];
    // Check
    if (variantsMDB && variantsMDB.length > 0) {
      // Create
      for (const variantMDB of variantsMDB) {
        // Add
        variants.push(new Variants(variantMDB));
      }
    }
    // Ok
    return {
      count: variantsCountMDB.length > 0 ? variantsCountMDB[0].count : 0,
      result: variants
    };
  }

  static async deleteVariants(viewID, userID) {
    // Delete Variants
    await global.db
      .collection('variants')
      .findOneAndDelete({$and: [{viewID: viewID}, {userID: userID}]});
  }
}

module.exports = VariantsStorage;
