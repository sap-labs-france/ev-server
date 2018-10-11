const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const AppError = require('../../exception/AppError');

class VariantStorage {
  static async getVariantByID(name, viewID, userID) {
    const Variant = require('../../model/Variant');
    // Create Aggregation
    let aggregation = [];
    // Filters
    aggregation.push({
      $match: { $and: [{ name: name }, { viewID: viewID }, { userID: userID }] },
    });
    // Read DB
    let variantsMDB = await global.db
      .collection('variant')
      .aggregate(aggregation)
      .toArray();
    // Set
    let variant = null;
    if (variantsMDB && variantsMDB.length > 0) {
      // Create
      variant = new Variant(variantsMDB[0]);
    }
    return variant;
  }

  static async saveVariant(variantToSave) {
    const Variant = require('../../model/Variant');

    // Check if Name/Model is provided
    if (!variantToSave.name && !variantToSave.model) {
      //  Name must be provided!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Variant has no Name and no Model`,
        550,
        'VariantStorage',
        'saveVariant',
      );
    }

    // Check if viewID/Model is provided
    if (!variantToSave.viewID && !variantToSave.model) {
      // ViewID must be provided!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Variant has no View ID and no Model`,
        550,
        'VariantStorage',
        'saveVariant',
      );
    }

    let variantFilter = {};
    // Build Request
    if (variantToSave.name) {
      variantFilter.name = variantToSave.name;
    }
    if (variantToSave.viewID) {
      variantFilter.viewID = variantToSave.viewID;
    }
    // Transfer
    let variant = {};
    Database.updateVariant(variantToSave, variant, false);
    // Modify
    let result = await global.db
      .collection('variant')
      .findOneAndUpdate(
        variantFilter,
        { $set: variant },
        { upsert: true, new: true, returnOriginal: false },
      );
    // Create
    return new Variant(result.value);
  }

  // Delegate
  static async getVariants(params = {}, limit, skip, sort) {
    const Variant = require('../../model/Variant');
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    let filters = {};
    // Set name
    if (params.name) {
      // Build filter
      filters.name = params.name;
    }
    // Set viewID?
    if (params.viewID) {
      // Build filter
      filters.viewID = params.viewID;
    }

    if (params.global && params.global == true) {
      // Include global variants
      // Set User?
      if (params.userID) {
        filters = {
          $and: [
            filters,
            {
              $or: [
                { userID: Utils.convertToObjectID(params.userID) },
                { userID: null },
              ],
            },
          ],
        };
      }
    } else {
      // Add only user if set
      if (params.userID) {
        filters.userID = Utils.convertToObjectID(params.userID);
      }
    }
    // Create Aggregation
    let aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters,
      });
    }
    // Count Records
    let variantsCountMDB = await global.db
      .collection('variant')
      .aggregate([...aggregation, { $count: 'count' }])
      .toArray();
    // Sort
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort,
      });
    } else {
      // Default
      aggregation.push({
        $sort: {
          name: 1,
          viewID: 1,
          userID: 1,
        },
      });
    }
    // Skip
    aggregation.push({
      $skip: skip,
    });
    // Limit
    aggregation.push({
      $limit: limit,
    });
    // Read DB
    let variantsMDB = await global.db
      .collection('variant')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
      })
      .toArray();
    let variants = [];
    // Check
    if (variantsMDB && variantsMDB.length > 0) {
      // Create
      for (const variantMDB of variantsMDB) {
        // Add
        variants.push(new Variant(variantMDB));
      }
    }
    // Ok
    return {
      count: variantsCountMDB.length > 0 ? variantsCountMDB[0].count : 0,
      result: variants,
    };
  }

  static async deleteVariant(name, viewID, userID) {
    // Delete Variants
    await global.db.collection('variant').findOneAndDelete({
      $and: [{ name: name }, { viewID: viewID }, { userID: userID }],
    });
  }
}

module.exports = VariantStorage;
