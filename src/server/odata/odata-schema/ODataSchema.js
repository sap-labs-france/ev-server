const fs = require('fs');
require('source-map-support').install();

class ODataSchema {
  /**
   * Specific implementation to return Atom Schema
   */
  static getSchema(req, res, next) {
    // read schema file
    // const schema = fs.readFileSync('schema/ODataSchema.xml', 'utf-8');
    const schema = fs.readFileSync('src/server/odata/odata-schema/ODataSchema.xml', 'utf-8');

    // send available versions
    if (req.path === '/') {
      res.set('Content-Type', 'text/xml');
      res.send(schema);
    } else {
      next();
    }
  }
}

module.exports = ODataSchema;