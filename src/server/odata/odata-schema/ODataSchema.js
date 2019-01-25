const fs = require('fs');
require('source-map-support').install();

class ODataSchema {
  /**
   * Specific implementation to return Atom Schema
   */
  static getSchema(req, res, next) {
    // send available versions
    if (req.path === '/') {
      const schemaFile = __dirname + '/ODataSchema.xml';
      console.log(schemaFile);
      const schema = fs.readFileSync(schemaFile, 'utf-8');
      res.set('Content-Type', 'text/xml');
      res.send(schema);
    } else {
      next();
    }
  }
}

module.exports = ODataSchema;