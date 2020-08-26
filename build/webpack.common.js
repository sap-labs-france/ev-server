const nodeExternals = require('webpack-node-externals');
const commonPaths = require('./webpack.common.paths');
const webpack = require('webpack');
const WebpackShellPluginNext = require('webpack-shell-plugin-next');
const CopyPlugin = require('copy-webpack-plugin');

const config = {
  entry: commonPaths.srcPath + '/start.ts',
  devtool: 'source-map',
  target: 'node',
  node: {
    console: false,
    global: false,
    process: false,
    Buffer: false,
    __filename: false,
    __dirname: false
  },
  externals: [nodeExternals()],
  output: {
    filename: 'start.js',
    path: commonPaths.outputPath
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.json']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: [/node_modules/]
      }
    ]
  },
  plugins: [
    new WebpackShellPluginNext({
      onBuildStart: {
        scripts: ['node src/componentsExport.js'],
        blocking: true,
        parallel: false,
      },
    }),
    new webpack.WatchIgnorePlugin([
      /\.js$/,
      /\.d\.ts$/
    ]),
    new webpack.ProgressPlugin(),
    new CopyPlugin({
      patterns: [
        { from: 'src/assets/', to: 'assets/', globOptions: { ignore: ['**/configs/**'] } },
        { from: 'src/integration/pricing/convergent-charging/assets/', to: 'integration/pricing/convergent-charging/assets/', noErrorOnMissing: true }
      ]
    })
  ],
  optimization: {
    minimize: false,
  },
};

module.exports = config;
