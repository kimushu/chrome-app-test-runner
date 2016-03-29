module.exports = function(filePath, options) {
  var fs = require("fs"),
  execSync = require("child_process").execSync,
  path = require("path"),
  shelljs = require("shelljs"),
  temp = require("temp"),
  export_dir = options["export"],
  dir = export_dir || temp.mkdirSync("test-"),
  loader;

  loader = copyLaunchEnvironment();
  browserifyTestFile(path.join(process.cwd(), filePath));
  makeFileComplyWithCSP();
  makeRunner(loader);

  function copyLaunchEnvironment() {
    var tempDataPath = path.join(dir, "data"),
    tempFilePath = path.join(dir, "file"),
    scripts = options["load-scripts"],
    files = options["load-files"],
    copy = ["background-script.js", "configure-mocha.js", "manifest.json",
            "mocha.css", "mocha.js", "start-mocha.js"],
    loader = "";

    shelljs.mkdir(tempDataPath)
    shelljs.mkdir(tempFilePath)
    if (scripts) {
      scripts = scripts.split(",");
      for (index in scripts) {
        script = scripts[index];
        name = path.basename(script);
        shelljs.cp(script, path.join(tempFilePath, name));
        loader += "<script src=\"file/" + name + "\" charset=\"utf-8\"></script>";
      }
    }
    if (files) {
      files = files.split(",");
      for (index in files) {
        file = files[index];
        name = path.basename(file);
        shelljs.cp(file, path.join(tempFilePath, name));
      }
    }
    for (index in copy) {
      file = copy[index];
      name = path.basename(file);
      shelljs.cp(path.join(__dirname, file), path.join(dir, name));
    }
    shelljs.cp(path.join(__dirname, "First Run"), tempDataPath);
    return loader;
  }

  function browserifyTestFile(file) {
    return execSync("browserify -t browserify-istanbul -t coffeeify --extension=\".coffee\" " + file + " -o " + path.join(dir, "test-browserified.js"), {cwd: __dirname});
  }

  function makeFileComplyWithCSP() {
    var fileText = fs.readFileSync(path.join(dir, "test-browserified.js"), "utf-8");
    fs.writeFileSync(path.join(dir, "test-browserified.js"), fileText.replace(/= \(Function\('return this'\)\)\(\);/g, "= window;"));
  }

  function makeRunner(loader) {
    var fileText = fs.readFileSync(path.join(__dirname, "test-runner.html.tmpl"), "utf-8");
    fs.writeFileSync(path.join(dir, "test-runner.html"), fileText.replace("<!--LOAD-SCRIPTS-->", loader));
  }

  return (export_dir ? null : dir);
};
