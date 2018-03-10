/* global __dirname:true */
/* global module:true */

module.exports = {
  entry: "./src/sidebar/tabcenter.js",
  output: {
    filename: "bundle.js",
    path: `${__dirname}/src/sidebar/dist`
  }
};
