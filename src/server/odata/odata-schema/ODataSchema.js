const oDataSchema = require('./ODataSchema.xml');
require('source-map-support').install();

class ODataSchema {
  /**
   * Specific implementation to return Atom Schema
   */
  static getSchema(req, res, next) {
    // Debug - display requested path
    console.log('Requested path:' + req.path + ' | Original URL: ' + req.originalUrl);
    // set default header
    res.setHeader('OData-Version', '4.0');
    res.setHeader('Cache-Control', 'no-cache');

    // send available versions
    if (req.path === '/' || req.path === '//') {
      res.set('Content-Type', 'text/xml');
      res.send(oDataSchema);
    } else {
      next();
    }
  }
}

module.exports = ODataSchema;