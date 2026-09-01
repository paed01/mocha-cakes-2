'use strict';

var Mocha = unwrap(require('mocha')),
    Test  = Mocha.Test,
    createCommon = loadCommon();

Mocha.interfaces['mocha-cakes-2'] = module.exports = mochaCakes;

function mochaCakes(suite) {
  var suites = [suite];

  function registerDescendantsHook(hookType, suiteType) {
    var hookName = hookType + suiteType;

    return function(name, fn) {
      if (!suites[0][hookName]) suites[0][hookName] = [];

      suites[0][hookName].push([name, fn]);
    }
  }

  suite.on('pre-require', function (context, file, mocha) {
    var common = createCommon(suites, context, mocha);

    context.run = mocha.options.delay && common.runWithSuite(suite);

    var wrapperCreator = createWrapper(file, suites, common);
    var testTypeCreator = createTestType(file, suites, common, mocha);

    context.after = common.after;
    context.afterEach = common.afterEach;
    context.before = common.before;
    context.beforeEach = common.beforeEach;

    context.afterEachFeature = registerDescendantsHook('afterEach', 'Feature');
    context.afterEachScenario = registerDescendantsHook('afterEach', 'Scenario');
    context.beforeEachFeature = registerDescendantsHook('beforeEach', 'Feature');
    context.beforeEachScenario = registerDescendantsHook('beforeEach', 'Scenario');

    context.Scenario = wrapperCreator('Scenario');
    context.Feature = wrapperCreator('Feature');
    context.describe = wrapperCreator('');

    context.Given = testTypeCreator('Given');
    context.When = testTypeCreator('When');
    context.Then = testTypeCreator('Then');
    context.And = testTypeCreator('And');
    context.But = testTypeCreator('But');
    context.it = testTypeCreator('');
    context.xit = context.it.skip;

    // lower-case aliases
    context.scenario = context.Scenario;
    context.feature = context.Feature;
    context.given = context.Given;
    context.when = context.When;
    context.then = context.Then;
    context.and = context.And;
    context.but = context.But;
  });
}

// Required for `--list-interfaces`
mochaCakes.description = 'Gherkin/Cucumber style (Feature, Scenario, Given, When, Then)';

/**
 *  Helper functions
 **/

function createTestType(file, suites, common, mocha) {
  return function testTypeCreator(type) {
    function testType(title, fn) {
      var suite = suites[0];
      var testName = type ? type + ' ' + title : title;

      if (suite.isPending()) fn = null;

      var test = new Test(testName, fn);
      test.file = file;
      suite.addTest(test);

      return test;
    }

    testType.skip = function skip(title) {
      return testType(title);
    };

    testType.only = function only(title, fn) {
      return common.test.only(mocha, testType(title, fn));
    };

    return testType;
  };
}

function createWrapper(file, suites, common) {
  return function wrapperCreator(type) {
    function createLabel(title) {
      if (!type) return title;

      return  type + ': ' + title;
    }

    function wrapper(title, fn) {
      var suite = common.suite.create({
        title: createLabel(title),
        file: file,
        fn: fn
      });

      applyRegisteredHooks(suite, type);

      return suite;
    }

    wrapper.skip = function skip(title, fn) {
      return common.suite.skip({
        title: createLabel(title),
        file: file,
        fn: fn
      });
    };

    wrapper.only = function only(title, fn) {
      var suite = common.suite.only({
        title: createLabel(title),
        file: file,
        fn: fn
      });

      applyRegisteredHooks(suite, type);

      return suite;
    };

    return wrapper;
  };
}

function applyRegisteredHooks(suite, suiteType) {
  getRegisteredHooks(suite, 'beforeEach', suiteType).forEach(function(hook) {
    suite.beforeAll(hook[0], hook[1]);
  });
  getRegisteredHooks(suite, 'afterEach', suiteType).forEach(function(hook) {
    suite.afterAll(hook[0], hook[1]);
  });
}

function getRegisteredHooks(suite, hookType, suiteType) {
  var ancestors = [];
  var hooks = [];
  var parent = suite.parent;

  while (parent) {
    ancestors.push(parent);
    parent = parent.parent;
  }

  ancestors.forEach(function(ancestor) {
    if (ancestor.hasOwnProperty(hookType + suiteType)) {
      hooks = hooks.concat( ancestor[hookType + suiteType] || [] );
    }
  });

  return hooks;
}

/**
 * From mocha 12 the package entry point is an ES module. On Node 20/22
 * `require('mocha')` then returns the module namespace, where the Mocha
 * constructor is the default export; Node 24+ unwraps it automatically.
 */
function unwrap(mod) {
  return mod && typeof mod.default === 'function' ? mod.default : mod;
}

/**
 * Mocha's shared interface helpers live in `mocha/lib/interfaces/common`.
 * Up to mocha 11 the module is CommonJS and exports the factory function directly,
 * from mocha 12 it is an ES module exporting `createCommon`.
 */
function loadCommon() {
  var common = require('mocha/lib/interfaces/common');

  if (typeof common === 'function') return common;
  if (common && typeof common.createCommon === 'function') return common.createCommon;
  if (common && typeof common.default === 'function') return common.default;

  throw new Error('mocha-cakes-2: unable to load mocha/lib/interfaces/common from the installed mocha version');
}
