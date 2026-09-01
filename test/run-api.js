'use strict';

var Mocha = require('mocha').Mocha;
var chai = require('chai');
var path = require('path');

require('../mocha-cakes');

chai.should();

var mocha = new Mocha({
  ui: 'mocha-cakes-2',
  reporter: 'spec'
});

mocha.addFile(path.join(__dirname, 'feature/tests.js'));

mocha.run(function(failureCount) {
  process.on("exit", function() {
    process.exit(failureCount);
  });
});
