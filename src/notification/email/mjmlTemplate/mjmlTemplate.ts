import I18nManager from '../../../utils/I18nManager';
/* eslint-disable @typescript-eslint/member-ordering */
import { flatten } from './utils';
import mjml2html from 'mjml';
import mjmlContext from '../mjmlContext/mjmlContext';

export default class mjmlTemplate {
  private template: string;

  public constructor(template: string) {
    this.template = template;
  }

  public getTemplate(): string {
    return this.template;
  }

  public getHtml(): string {
    return mjml2html(this.template).html;
  }

  private replace(selector: string, value: string): void {
    this.template = this.template.replace('{{' + selector + '}}', value);
  }

  private getSelectors(): string[] {
    const regex = new RegExp(/\{\{(.*)\}\}/, 'g');
    const matches = this.template.matchAll(regex);
    const selectors = [];
    for (const match of matches) {
      selectors.push(match[1]);
    }
    return selectors;
  }

  private splitSelector(selector: string): string[] {
    return selector.split('.');
  }

  private getValue(keys: string[], context: any): string {
    let value = context;
    for (const key of keys) {
      value = value[key];
    }
    return value;
  }

  public resolve(i18nManager: I18nManager, context?: Record<string, unknown>): void {
    // flatten
    const data = {};
    flatten(context,data);

    // replace i18n selectors
    const selectors = this.getSelectors();
    for (const selector of selectors) {
      const value = i18nManager.translate(selector,data);
      this.replace(selector, value);
    }

    // replace context selectors
    const translatedSelectors = this.getSelectors();
    for (const selector of translatedSelectors) {
      const keys = this.splitSelector(selector);
      const value = this.getValue(keys, context);
      // const value = i18nManager.translate(selector, context);
      this.replace(selector,value);
    }
    console.log(this.template);
  }
}
