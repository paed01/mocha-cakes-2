'use strict';

var Mocha = require('mocha').Mocha;
var execFile = require('util').promisify(require('child_process').execFile);
var path = require('path');

var testEnv = Object.assign({}, process.env, { NODE_PATH: __dirname });
// Run mocha's CLI with the same node binary as this process so it works
// outside npm scripts (where node_modules/.bin is not on PATH).
var mochaBin = require.resolve('mocha/bin/mocha.js');

var defaultOpts = {
  reporter: 'spec'
};

var formatRegexp = /%[ds]/

var interfaces = {
  cli: function(file, opts) {
    opts = Object.assign({}, defaultOpts, opts);
    var args = [
      '--no-config',
      '--require', path.join(__dirname, 'setup.js'),
      '--require', path.join(__dirname, '../mocha-cakes.js'),
      '--ui', 'mocha-cakes-2',
      '--reporter', opts.reporter,
      path.join(__dirname, file)
    ];
    return execFile(process.execPath, [mochaBin].concat(args), { env: testEnv })
      .then(function (result) {
        return result.stdout;
      });
  },

  api: function(file, opts) {
    return new Promise(function(resolve) {
      opts = Object.assign({}, defaultOpts, opts);

      // The set up from requiring mocha-cakes and running chai.should() in `run-api.js`
      // is inherited here so we don't need to set them up for each file we run.

      var mocha = new Mocha({
        ui: 'mocha-cakes-2',
        reporter: opts.reporter,
        // Since we're intercepting the console messages before they're formatted
        // we would get the color strings in the output, but that doesn't happen
        // in the CLI output since the colors are formatted and won't appear in the
        // strings, so we disable colors here so we don't have to strip them from
        // the output, and we can use the same test assertions with both interfaces.
        color: false
      });

      mocha.addFile(path.join(__dirname, file));

      // Capture the reporter output. Mocha's reporters write through
      // `Base.consoleLog` (a reference to console.log taken at load time),
      // while the sample test files log through console.log directly, so
      // both are intercepted to preserve the relative ordering.
      var logs = [];
      var Base = Mocha.reporters.Base;
      var originalLog = console.log;
      var originalBaseLog = Base.consoleLog;
      var captureLog = function() {
        var args = Array.prototype.slice.call(arguments);
        if (args.length < 2) {
          logs.push(args[0] || '');
        } else {
          var str = args.reduce(function(str, arg) {
            if (formatRegexp.test(str)) {
              return str.replace(formatRegexp, arg);
            }
            return str + ' ' + arg;
          });
          logs.push(str);
        }
      };
      console.log = captureLog;
      Base.consoleLog = captureLog;

      // Mocha.run() will store the 'color' option internally, outside of the
      // options we've set for this instance, so if the Mocha instance that's
      // running this has a different 'color' value it won't be restored.
      var previousUseColors = Base.useColors;

      mocha.run(function() {
        console.log = originalLog;
        Base.consoleLog = originalBaseLog;
        Base.useColors = previousUseColors;
        resolve(logs.join('\n'));
      });
    });
  }
}

// Mocha colors its pass/fail symbols at load time (based on whether stdout is
// a TTY), independently of the `color` option, so the captured output may
// contain ANSI escape codes when run from a terminal. Strip them so the
// assertions can match plain text regardless of where the tests are run.
var ansiRegexp = /\u001b\[[0-9;]*m/g;

function stripAnsi(str) {
  return str.replace(ansiRegexp, '');
}

function execTestFile(file, opts) {
  var interfaceName = process.env.MOCHA_INTERFACE || 'cli';
  var func = interfaces[interfaceName];
  if (!func) {
    var actual = typeof interfaceName !== 'undefined' ? JSON.stringify(interfaceName) : 'undefined';
    var valid = Object.keys(interfaces).join(', ');
    throw new Error('The MOCHA_INTERFACE environment variable is set to ' + actual + ', valid values are: ' + valid);
  }
  return func(file, opts).then(stripAnsi);
}

module.exports = {
  execTestFile: execTestFile
};
