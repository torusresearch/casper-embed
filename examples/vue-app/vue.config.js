const path = require("path");
const { ProvidePlugin } = require("webpack");

module.exports = {
  transpileDependencies: true,
  configureWebpack: (config) => {
    config.resolve.fallback = {
      crypto: false,
      stream: false,
      assert: false,
      zlib: false,
      https: false,
      http: false,
      // os: require.resolve("os-browserify/browser"),
      // https: require.resolve("https-browserify"),
      // http: require.resolve("stream-http"),
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      "bn.js": path.resolve(__dirname, "node_modules/bn.js"),
      lodash: path.resolve(__dirname, "node_modules/lodash"),
    };
    config.plugins.push(new ProvidePlugin({ Buffer: ["buffer", "Buffer"] }));
    config.plugins.push(new ProvidePlugin({ process: ["process/browser"] }));
  },
};
