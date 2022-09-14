import { promises as fs } from 'fs';
import global from '../../../types/GlobalType';

export enum EmailComponent {
  FOOTER = 'footer.mjml',
  HEADER = 'header.mjml',
  CONFIG = 'config.mjml',

  BUTTON = 'button.mjml',
  TITLE = 'title.mjml',
  TEXT1 = 'text1.mjml',

  TABLE='table.mjml',
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
    try {
      const fileName = `${global.appRoot}/notification/email/mjml-components/` + componentName;
      const content = await fs.readFile(fileName, 'utf8');
      return content;
    } catch (error) {
      // Do not log that one - an exception is thrown by the caller when null is returned
    }
    return null;
  }
}
