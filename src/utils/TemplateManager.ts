import Constants from './Constants';
import Utils from './Utils';
import { promises as fs } from 'fs';
import global from '../types/GlobalType';

export default class TemplateManager {
  private static instances = new Map<string, TemplateManager>();
  private language: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parsedTemplates = new Map<string, any>();

  private constructor(locale: string) {
    // Get language
    this.language = Utils.getLanguageFromLocale(locale);
    // Supported languages?
    if (!this.language || !Constants.SUPPORTED_LANGUAGES.includes(this.language)) {
      // Default
      this.language = Constants.DEFAULT_LANGUAGE;
    }
  }

  // Get a template manager instance for a particular locale
  public static getInstanceForLocale(locale: string = Constants.DEFAULT_LOCALE): TemplateManager {
    let templateManager = TemplateManager.instances.get(locale);
    if (!templateManager) {
      templateManager = new TemplateManager(locale);
      TemplateManager.instances.set(locale, templateManager);
    }
    return templateManager;
  }

  // Get the template from the cache or load it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async getTemplate(templateName: string) : Promise<any> {
    let parsedTemplate = this.parsedTemplates.get(templateName);
    if (!parsedTemplate) {
      parsedTemplate = await this.loadTemplateAndParse(templateName);
      this.parsedTemplates.set(templateName, parsedTemplate);
    }
    // Very important here - Make sure to return a clone!
    return Utils.cloneObject(parsedTemplate);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async loadTemplateAndParse(templateName: string) : Promise<any> {
    try {
      const fileName = `${global.appRoot}/assets/server/notification/email/${this.language}/${templateName}.json`;
      const content = await fs.readFile(fileName, 'utf8');
      const parsedContent = JSON.parse(content);
      return parsedContent;
    } catch (error) {
      // Do not log that one - an exception is thrown by the caller when null is returned
    }
    return null;
  }
}
