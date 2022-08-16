import mjmlTemplate from '../MjmlTemplate/MjmlTemplate';

export default class MjmlBuilder {
  private header: string;
  private body: string[];
  private footer: string;
  private config: string;

  public constructor() {
    this.header = '';
    this.footer = '';
    this.body = [];
    this.config = '';
  }

  public addHeader(header: string): this {
    this.header = header;
    return this;
  }

  public addToBody(component: string): this {
    this.body.push(component);
    return this;
  }

  public addFooter(footer: string): this {
    this.footer = footer;
    return this;
  }

  public addConfig(config: string): this {
    this.config = config;
    return this;
  }

  public buildTemplate(): mjmlTemplate {
    const template =
      '<mjml>' +
      this.config +
      '<mj-body>' +
      this.header +
      this.body.join() +
      this.footer +
      '</mj-body>' +
      '</mjml>';
    return new mjmlTemplate(template);
  }
}
