#!/usr/bin/env node
var cliOptions = require("minimist")(process.argv.slice(2)),
testFiles = cliOptions._,
includeOveralCoverageSummary = testFiles.length > 1,
path = require("path"),
coverageReporter = require("./coverageReporter.js"),
spawn = require("child_process").spawn,
serverHandler = require("./serverHandler.js"),
remoteDebugger = require("./remote-debugger.js"),
chromePath = require("./chromeFinder.js")(),
shelljs = require("shelljs");

if (!chromePath) {console.log("Chrome could not be found"); return;}

runTests(testFiles.shift());

function runTests(filePath) {
  var dir;

  if (!filePath) {
    if (includeOveralCoverageSummary) {
      coverageReporter();
    }

    return;
  }

  dir = require("./testFilePrep.js")(filePath, cliOptions);
  if (!dir) {
    return;
  }

  function cleanup() {
    shelljs.rm("-rf", dir);
  }

  serverHandler.startServer(cliOptions["mock-server"])
  .then(function() {
    var chromeProcess;

    console.log("Running test " + path.join(process.cwd(), filePath));

    chromeProcess = spawn(chromePath, 
    ["--remote-debugging-port=9222",
    "--user-data-dir=" + path.join(dir, "data"),
    " --load-and-launch-app=" + dir], {detached: true})
    .on('error', function( err ){ throw err; });

    remoteDebugger.setDebugHandler(function(data) {
      var message = "";
      try {
        data.params.message.parameters.forEach(function(param) {
          message += param.value;
        });
        console.log(message);
        if (message === "All tests passed!") {
          passedTestHandler();
        }
        if (/Failure count: [\d]+/.test(message)) {
          failedTestHandler();
        }
      } catch(e) {}
    });

    function passedTestHandler() {
      serverHandler.stopServer();
      remoteDebugger.evaluate("window.__coverage__")
      .then(function(resp) {
        saveCoverage(JSON.stringify(resp), path.basename(filePath));
        next = function() {
          setTimeout(function() {
            cleanup();
            runTests(testFiles.shift());
          }, 800);
        };
        if (!cliOptions["keep-chrome"]) {
          chromeProcess.kill();
          next();
        } else {
          chromeProcess.on('exit', next);
        }
      })
      .catch(function(e) {
        console.log(e);
      });
    }

    function failedTestHandler() {
      serverHandler.stopServer();
      if (!cliOptions["keep-chrome"]) {
        chromeProcess.kill();
      }
      cleanup();
      process.exitCode = 1;
    }

    chromeProcess.stdout.pipe(process.stdout);
    return remoteDebugger.attach();
  })
  .catch(function(e) {
    console.log(e);
    serverHandler.stopServer();
  });

  function saveCoverage(coverageJson, fileName) {
    var filePath = path.join(__dirname, "coverage", "coverage-" + fileName + ".json");
    require("fs").writeFileSync(filePath, coverageJson);

    coverageReporter("coverage-" + fileName + ".json")
  }
}
