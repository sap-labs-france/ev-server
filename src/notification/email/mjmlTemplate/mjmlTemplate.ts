import mjml2html from 'mjml';
import mjmlContext from '../mjmlContext/mjmlContext';
import { getResolverData } from './utils';

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
    let selectors = [];
    for (const match of matches) {
      selectors.push(match[1]);
    }
    return selectors;
  }

  private splitSelector(selector: string): string[] {
    return selector.split('.');
  }

  private getValue(keys: string[], context: any) {
    let value = context;
    for (const key of keys) {
      value = value[key];
    }

    return value;
  }

  public resolve(context: any): void {
    const selectors = this.getSelectors();
    for (const selector of selectors) {
      const keys = this.splitSelector(selector);
      const value = this.getValue(keys, context);
      this.replace(selector, value);
    }
  }
}
