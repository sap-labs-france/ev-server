import { promises as fs } from 'fs';

type Component = string;

export default class ComponentsManager {
  private static components = new Map<string, Component>();

  // Get the component from the cache or load it
  public static async getComponent(componentName: Component): Promise<Component> {
    let cachedComponent = ComponentsManager.components.get(componentName);
    if (!cachedComponent) {
      console.log(ComponentsManager.components.size);
      cachedComponent = await ComponentsManager.loadComponent(componentName);
      ComponentsManager.components.set(componentName, cachedComponent);
    }

    return cachedComponent;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static async loadComponent(componentName: string): Promise<Component> {
    try {
      const fileName = 'src/notification/email/mjmlComponents/' + componentName;
      const content = await fs.readFile(fileName, 'utf8');
      return content;
    } catch (error) {
      // Do not log that one - an exception is thrown by the caller when null is returned
    }
    return null;
  }
}
