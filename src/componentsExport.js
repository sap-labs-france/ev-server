const fs = require('fs');

class Components {
  static exportConcurRefundIntegrationImpl() {
    const indexModuleFile = __dirname + '/integration/refund/export/concur/index.ts';
    let exportModuleString
    if (fs.existsSync(__dirname + '/integration/refund/concur/index.ts')) {
      exportModuleString = 'export { default } from \'../../concur\';\n';
    } else {
      exportModuleString = 'export { default } from \'../../dummy/DummyRefundIntegration\';\n';
    }
    fs.writeFileSync(indexModuleFile, exportModuleString);
  }

  static exportSapSmartChargingIntegrationImpl() {
    const indexModuleFile = __dirname + '/integration/smart-charging/export/sap-smart-charging/index.ts';
    let exportModuleString
    if (fs.existsSync(__dirname + '/integration/smart-charging/sap-smart-charging/index.ts')) {
      exportModuleString = 'export { default } from \'../../sap-smart-charging\';\n';
    } else {
      exportModuleString = 'export { default } from \'../../dummy/DummySmartChargingIntegration\';\n';
    }
    fs.writeFileSync(indexModuleFile, exportModuleString);
  }

  static exportConvergentChargingIntegrationImpl() {
    const indexModuleFile = __dirname + '/integration/pricing/export/convergent-charging/index.ts';
    let exportModuleString
    if (fs.existsSync(__dirname + '/integration/pricing/convergent-charging/index.ts')) {
      exportModuleString = 'export { default } from \'../../convergent-charging\';\n';
    } else {
      exportModuleString = 'export { default } from \'../../dummy/DummyPricingIntegration\';\n';
    }
    fs.writeFileSync(indexModuleFile, exportModuleString);
  }

  static export() {
    this.exportConcurRefundIntegrationImpl()
    this.exportSapSmartChargingIntegrationImpl()
    this.exportConvergentChargingIntegrationImpl()
  }
}

Components.export()
