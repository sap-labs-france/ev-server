import { promises as fs } from 'fs';

type Component = string;

export default class EmailComponentsManager {
  private static components = new Map<string, Component>();

  // Get the component from the cache or load it
  public static async getComponent(componentName: Component): Promise<Component> {
    let cachedComponent = EmailComponentsManager.components.get(componentName);
    if (!cachedComponent) {
      cachedComponent = await EmailComponentsManager.loadComponent(componentName);
      EmailComponentsManager.components.set(componentName, cachedComponent);
    }

    return cachedComponent;
  }

  public static async loadComponent(componentName: string): Promise<Component> {
    try {
      const fileName = 'src/notification/email/MjmlComponents/' + componentName;
      const content = await fs.readFile(fileName, 'utf8');
      return content;
    } catch (error) {
      // Do not log that one - an exception is thrown by the caller when null is returned
    }
    return null;
  }
}
