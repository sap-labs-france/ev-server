const Tenant = require('../../entity/Tenant');
const MigrationTask = require('../MigrationTask');

class MigrateTenantSettingsTask extends MigrationTask {
  async migrate() {
    // Migrate Default Tenant's components
    const tenantsMDB = await global.database.getCollection(
      'default', 'tenants').aggregate([]).toArray();
    for (const tenantMDB of tenantsMDB) {
      let changed = false;
      // Check Components
      if (tenantMDB.components) {
        // Check
        if (tenantMDB.components.ocpi && tenantMDB.components.ocpi.active) {
          tenantMDB.components.ocpi.type = 'gireve';
          changed = true;
        }
        if (tenantMDB.components.refund && tenantMDB.components.refund.active) {
          tenantMDB.components.refund.type = 'concur';
          changed = true;
        }
        if (tenantMDB.components.sac && tenantMDB.components.sac.active) {
          tenantMDB.components.sac.type = 'sac';
          changed = true;
        }
        // Changed
        if (changed) {
          // Save it
          await global.database.getCollection('default', 'tenants').findOneAndUpdate({
            "_id": tenantMDB._id
          }, {
            $set: tenantMDB
          }, { upsert: true, new: true, returnOriginal: false });          
        }
      }
      // Delete unused settings
      await global.database.getCollection(
        tenantMDB._id, 'settings').remove({ identifier: 'chargeathome' });
      // Update Tenant's settings
      const tenantSettingsMDB = await global.database.getCollection(
        tenantMDB._id, 'settings').aggregate([]).toArray();
      for (const tenantSettingMDB of tenantSettingsMDB) {
        let settingsChanged = false;
        // Check
        if (tenantSettingMDB.identifier === "ocpi" && !tenantSettingMDB.content.type) {
          // Update properties
          if (tenantSettingMDB.content) {
            // Migrate properties
            tenantSettingMDB.content.countryCode = tenantSettingMDB.content.country_code;
            delete tenantSettingMDB.content.country_code;
            tenantSettingMDB.content.partyID = tenantSettingMDB.content.party_id;
            delete tenantSettingMDB.content.party_id;
            tenantSettingMDB.content.businessDetails = tenantSettingMDB.content.business_details;
            delete tenantSettingMDB.content.business_details;
            // Set the new content
            tenantSettingMDB.content = {
              "type" : "gireve", 
              "ocpi" : tenantSettingMDB.content
            };
            settingsChanged = true;
          }
        }
        if (tenantSettingMDB.identifier === "sac" && !tenantSettingMDB.content.type) {
          // Set the new content
          tenantSettingMDB.content = {
            "type" : "sac", 
            "sac" : tenantSettingMDB.content
          };
          settingsChanged = true;
        }
        if (tenantSettingMDB.identifier === "pricing" && !tenantSettingMDB.content.type) {
          // Set the type
          if (tenantSettingMDB.content.simple) {
            tenantSettingMDB.content.type = "simple";
          } else if (tenantSettingMDB.content.convergentCharging) {
            tenantSettingMDB.content.type = "convergentCharging";
          }
          settingsChanged = true;
        }
        if (tenantSettingMDB.identifier === "refund" && !tenantSettingMDB.content.type) {
          // Set the type
          tenantSettingMDB.content.type = "concur";
          settingsChanged = true;
        }
        if (settingsChanged) {
          // Save it
          await global.database.getCollection(tenantMDB._id, 'settings').findOneAndUpdate({
            "_id": tenantSettingMDB._id
          }, {
            $set: tenantSettingMDB
          }, { upsert: true, new: true, returnOriginal: false });          
        }
      }
    }
  }

  getVersion() {
    return "1.0";
  }

  getName() {
    return "MigrateTenantSettingsTask";
  }
}

module.exports = MigrateTenantSettingsTask;