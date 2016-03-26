module.exports = function(filePath, options) {
  var fs = require("fs"),
  execSync = require("child_process").execSync,
  path = require("path"),
  shelljs = require("shelljs"),
  loadScriptsPath = path.join(__dirname, "load-scripts");

  cleanLaunchEnvironment();
  browserifyTestFile(path.join(process.cwd(), filePath));
  makeFileComplyWithCSP();
  makeRunner();

  function cleanLaunchEnvironment() {
    var tempChromeDataPath = path.join(__dirname, "temp-data-dir");
    shelljs.rm("-f", path.join(__dirname, "test-browserified.js"));
    shelljs.rm("-f", path.join(__dirname, "test-runner.html"));
    shelljs.rm("-rf", tempChromeDataPath);
    shelljs.mkdir(tempChromeDataPath);
    shelljs.rm("-rf", loadScriptsPath);
    shelljs.mkdir(loadScriptsPath);
    shelljs.cp(path.join(__dirname, "First Run"), tempChromeDataPath);
  }

  function browserifyTestFile(file) {
    return execSync("browserify -t browserify-istanbul -t coffeeify --extension=\".coffee\" " + file + " -o " + path.join(__dirname, "test-browserified.js"), {cwd: __dirname});
  }

  function makeFileComplyWithCSP() {
    var fileText = fs.readFileSync(path.join(__dirname, "test-browserified.js"), "utf-8");
    fs.writeFileSync(path.join(__dirname, "test-browserified.js"), fileText.replace(/= \(Function\('return this'\)\)\(\);/g, "= window;"));
  }

  function makeRunner() {
    var fileText = fs.readFileSync(path.join(__dirname, "test-runner.html.tmpl"), "utf-8");
    var newText = "";
    var scripts = options["load-scripts"];
    if (scripts) {
      scripts = scripts.split(",");
      for (index in scripts) {
        script = scripts[index];
        name = path.basename(script);
        shelljs.cp(script, path.join(loadScriptsPath, name));
        newText += "<script src=\"load-scripts/" + name + "\" charset=\"utf-8\"></script>";
      }
    }
    fs.writeFileSync(path.join(__dirname, "test-runner.html"), fileText.replace("<!--LOAD-SCRIPTS-->", newText));
  }

};
