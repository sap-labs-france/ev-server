import EmailComponentManager, { EmailComponent } from '../email-component-manager/EmailComponentManager';

import mjmlTemplate from '../mjml-template/MjmlTemplate';

export default class MjmlBuilder {
  private header: string;
  private body: string[];
  private footer: string;
  private config: string;

  public constructor() {
    this.header = '';
    this.footer = '';
    this.config = '';
    this.body = [];
  }

  public async initialize(): Promise<MjmlBuilder> {
    const builder = new MjmlBuilder();
    this.addConfig(await EmailComponentManager.getComponent(EmailComponent.CONFIG));
    this.addHeader(await EmailComponentManager.getComponent(EmailComponent.HEADER));
    this.addFooter(await EmailComponentManager.getComponent(EmailComponent.FOOTER));
    return builder;
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
