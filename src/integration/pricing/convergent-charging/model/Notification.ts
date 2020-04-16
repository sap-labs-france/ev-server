export class Notification {
  public instanceId: any;
  public timestamp: any;
  public descUid: any;
  public name: any;
  public prettyName: any;
  public severityLevel: any;
  public properties: any;

  constructor(model) {
    this.instanceId = model['$attributes'].instanceId;
    this.timestamp = model['$attributes'].timestamp;
    this.descUid = model['$attributes'].descUid;
    this.name = model['$attributes'].name;
    this.prettyName = model['$attributes'].prettyName;
    this.severityLevel = model['$attributes'].severityLevel;

    model.arg.map((detail) => detail['$attributes']).forEach((detail) => this[detail.name] = detail.value);
    if (this.properties) {
      const props: any = {};
      this.properties.split('\n').filter((s) => s.length > 0)
        .forEach((propString) => {
          const array = propString.split(' = ');
          props[array[0]] = array[1];
        });
      this.properties = props;
    }
  }
}
