import Constants from '../../utils/Constants';
import MigrationTask from '../MigrationTask';
import { ObjectId } from 'mongodb';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddLevelTemplateToChargingStationTemplateTask';

export default class AddLevelTemplateToChargingStationTemplateTask extends MigrationTask {

  public async migrate() {
    const templates = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'chargingstationtemplates').find({})
      // .project({ carID: 1, userID: 1, default: 1 })
      .toArray();
    if (!Utils.isEmptyArray(templates)) {
      for (const template of templates) {
        // Put _id in id const and get template without id
        const { ['_id']: id, ...noIdTemplate } = template;
        // Delete template
        const currentTemplate = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'chargingstationtemplates').findOneAndDelete(
          // Find by current id
          { _id: id },
        );
        console.log(currentTemplate);
        await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'chargingstationtemplates').insertOne(
          // Generate new id and create new template document with "template" level and date
          {
            _id: new ObjectId(),
            lastChangedOn: new Date(),
            template : noIdTemplate,
          },
        );
      }
    }
  }

  public getVersion(): string {
    return '0.2';
  }

  public getName(): string {
    return 'AddLevelTemplateToChargingStationTemplateTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }
}
