/**
 * Copyright 2019 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const fs = require('fs');
const path = require('path');
const rm = require('rimraf').sync;
const GoldenUtils = require('./golden-utils');
const {Matchers} = require('../utils/testrunner/');

const YELLOW_COLOR = '\x1b[33m';
const RESET_COLOR = '\x1b[0m';

module.exports.addTests = ({testRunner, product, puppeteer, Errors, DeviceDescriptors}) => {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  const CHROME = product === 'Chromium';
  const FFOX = product === 'Firefox';

  const headless = (process.env.HEADLESS || 'true').trim().toLowerCase() === 'true';
  const slowMo = parseInt((process.env.SLOW_MO || '0').trim(), 10);

  const defaultBrowserOptions = {
    handleSIGINT: false,
    executablePath: CHROME ? process.env.CHROME : process.env.FFOX,
    slowMo,
    headless,
    dumpio: !!process.env.DUMPIO,
  };

  if (defaultBrowserOptions.executablePath) {
    console.warn(`${YELLOW_COLOR}WARN: running ${product} tests with ${defaultBrowserOptions.executablePath}${RESET_COLOR}`);
  } else {
    // Make sure the `npm install` was run after the chromium roll.
    if (!fs.existsSync(puppeteer.executablePath()))
      throw new Error(`Browser is not downloaded. Run 'npm install' and try to re-run tests`);
  }

  const GOLDEN_DIR = path.join(__dirname, 'golden-' + product.toLowerCase());
  const OUTPUT_DIR = path.join(__dirname, 'output-' + product.toLowerCase());
  if (fs.existsSync(OUTPUT_DIR))
    rm(OUTPUT_DIR);
  const {expect} = new Matchers({
    toBeGolden: GoldenUtils.compare.bind(null, GOLDEN_DIR, OUTPUT_DIR)
  });

  const testOptions = {
    testRunner,
    product,
    FFOX,
    CHROME,
    puppeteer,
    Errors,
    DeviceDescriptors,
    expect,
    defaultBrowserOptions,
    headless: !!defaultBrowserOptions.headless,
  };

  beforeAll(async() => {
    if (FFOX && defaultBrowserOptions.executablePath)
      await require('../experimental/puppeteer-firefox/misc/install-preferences')(defaultBrowserOptions.executablePath);
  });

  describe('Browser', function() {
    beforeAll(async state => {
      state.browser = await puppeteer.launch(defaultBrowserOptions);
    });

    afterAll(async state => {
      await state.browser.close();
      state.browser = null;
    });

    beforeEach(async(state, test) => {
      const rl = require('readline').createInterface({input: state.browser.process().stderr});
      test.output = '';
      rl.on('line', onLine);
      state.tearDown = () => {
        rl.removeListener('line', onLine);
        rl.close();
      };
      function onLine(line) {
        test.output += line + '\n';
      }
    });

    afterEach(async state => {
      state.tearDown();
    });

    describe('Page', function() {
      beforeEach(async state => {
        state.context = await state.browser.createIncognitoBrowserContext();
        state.page = await state.context.newPage();
      });

      afterEach(async state => {
        // This closes all pages.
        await state.context.close();
        state.context = null;
        state.page = null;
      });

      // Page-level tests that are given a browser, a context and a page.
      // Each test is launched in a new browser context.
      require('./browser.spec.js').addTests(testOptions);
      require('./click.spec.js').addTests(testOptions);
      require('./cookies.spec.js').addTests(testOptions);
      require('./dialog.spec.js').addTests(testOptions);
      require('./elementhandle.spec.js').addTests(testOptions);
      require('./emulation.spec.js').addTests(testOptions);
      require('./evaluation.spec.js').addTests(testOptions);
      require('./frame.spec.js').addTests(testOptions);
      require('./input.spec.js').addTests(testOptions);
      require('./jshandle.spec.js').addTests(testOptions);
      require('./keyboard.spec.js').addTests(testOptions);
      require('./mouse.spec.js').addTests(testOptions);
      require('./navigation.spec.js').addTests(testOptions);
      require('./network.spec.js').addTests(testOptions);
      require('./page.spec.js').addTests(testOptions);
      require('./screenshot.spec.js').addTests(testOptions);
      require('./queryselector.spec.js').addTests(testOptions);
      require('./target.spec.js').addTests(testOptions);
      require('./touchscreen.spec.js').addTests(testOptions);
      require('./waittask.spec.js').addTests(testOptions);
      require('./worker.spec.js').addTests(testOptions);
      if (CHROME) {
        require('./accessibility.spec.js').addTests(testOptions);
        require('./CDPSession.spec.js').addTests(testOptions);
        require('./coverage.spec.js').addTests(testOptions);
        require('./chromiumonly.spec.js').addTests(testOptions);
      } else {
        require('./firefoxonly.spec.js').addTests(testOptions);
      }
    });

    // Browser-level tests that are given a browser.
    require('./browsercontext.spec.js').addTests(testOptions);
  });

  // Top-level tests that launch Browser themselves.
  require('./ignorehttpserrors.spec.js').addTests(testOptions);
  require('./launcher.spec.js').addTests(testOptions);
  if (CHROME) {
    require('./headful.spec.js').addTests(testOptions);
    require('./tracing.spec.js').addTests(testOptions);
  }
};
