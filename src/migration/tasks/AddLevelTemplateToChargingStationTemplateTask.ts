import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ObjectId } from 'mongodb';
import { ServerAction } from '../../types/Server';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddLevelTemplateToChargingStationTemplateTask';

export default class AddLevelTemplateToChargingStationTemplateTask extends MigrationTask {

  public async migrate(): Promise<void> {
    const templates = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'chargingstationtemplates').find({})
      .toArray();
    if (!Utils.isEmptyArray(templates)) {
      for (const template of templates) {
        if (template.template) {
          // skip this one as it has already ran
          continue
        }
        // Put _id in id const and get template without id
        const {
          ['_id']: id,
          ['hash']: hash,
          ['hashTechnical']: hashTechnical,
          ['hashCapabilities']: hashCapabilities,
          ['hashOcppStandard']: hashOcppStandard,
          ['hashOcppVendor']: hashOcppVendor,
          ...noIdTemplate } = template;
        // Delete template
        await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'chargingstationtemplates').findOneAndDelete(
          // Find and delete by current id
          { _id: id },
        );
        await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'chargingstationtemplates').insertOne(
          // Generate new id and create new template document and date then "template" level
          {
            _id: new ObjectId(),
            lastChangedOn: new Date(),
            template : noIdTemplate,
            hash,
            hashTechnical,
            hashCapabilities,
            hashOcppStandard,
            hashOcppVendor,
          },
        );
      }
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT_ID,
        module: MODULE_NAME, method: 'migrate',
        action: ServerAction.MIGRATION,
        message: `ChargingStationTemplates have been migrated with template level on ${Constants.DEFAULT_TENANT_ID} tenant`
      });
    }
  }

  public getVersion(): string {
    return '1.0';
  }

  public getName(): string {
    return 'AddLevelTemplateToChargingStationTemplateTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }
}
