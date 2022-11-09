import { promises as fs } from 'fs';
import global from '../../types/GlobalType';

export enum EmailComponent {
  MJML_CONFIG = 'email_config.mjml',
  MJML_FOOTER = 'email_footer.mjml',
  MJML_HEADER = 'email_header.mjml',
  MJML_TITLE = 'email_title.mjml',
  MJML_MAIN_MESSAGE = 'email_main_message.mjml',
  MJML_TABLE='email_table.mjml',
  MJML_MAIN_ACTION = 'email_main_action.mjml',
  MJML_EICHRECHT_TABLE='email_eichrecht_table.mjml',
}

export default class EmailComponentManager {
  private static components = new Map<string, string>();

  // Get the component from the cache or load it
  public static async getComponent(componentName: EmailComponent): Promise<string> {
    let cachedComponent = EmailComponentManager.components.get(componentName);
    if (!cachedComponent) {
      cachedComponent = await EmailComponentManager.loadComponent(componentName);
      EmailComponentManager.components.set(componentName, cachedComponent);
    }
    return cachedComponent;
  }

  public static async loadComponent(componentName: EmailComponent): Promise<string> {
    const fileName = `${global.appRoot}/assets/email/mjml-components/${componentName}`;
    const content = await fs.readFile(fileName, 'utf8');
    return content;
  }
}
