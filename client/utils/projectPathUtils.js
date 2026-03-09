(function initProjectPathUtils(globalScope) {
  var PROJECT_PATH_SEPARATOR = globalScope.Utils
    ? globalScope.Utils.PROJECT_PATH_SEPARATOR
    : " / ";
  var escapeHtml = globalScope.Utils
    ? globalScope.Utils.escapeHtml
    : function (t) {
        var d = document.createElement("div");
        d.textContent = t;
        return d.innerHTML;
      };

  function splitProjectPath(value) {
    if (typeof value !== "string") return [];
    return value
      .split("/")
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);
  }

  function normalizeProjectPath(value) {
    var parts = splitProjectPath(value);
    return parts.join(PROJECT_PATH_SEPARATOR);
  }

  function compareProjectPaths(a, b) {
    var aParts = splitProjectPath(a);
    var bParts = splitProjectPath(b);
    var maxDepth = Math.max(aParts.length, bParts.length);
    for (var i = 0; i < maxDepth; i += 1) {
      var aPart = aParts[i] || "";
      var bPart = bParts[i] || "";
      if (aPart === bPart) {
        continue;
      }
      return aPart.localeCompare(bPart);
    }
    return aParts.length - bParts.length;
  }

  function expandProjectTree(paths) {
    var expanded = new Set();
    paths.forEach(function (path) {
      var parts = splitProjectPath(path);
      for (var i = 1; i <= parts.length; i += 1) {
        expanded.add(parts.slice(0, i).join(PROJECT_PATH_SEPARATOR));
      }
    });
    return Array.from(expanded).sort(compareProjectPaths);
  }

  function getProjectDepth(projectPath) {
    return Math.max(0, splitProjectPath(projectPath).length - 1);
  }

  function getProjectLeafName(projectPath) {
    var parts = splitProjectPath(projectPath);
    return parts[parts.length - 1] || projectPath;
  }

  function renderProjectOptionEntry(projectPath, selectedValue) {
    var sel = selectedValue || "";
    var depth = getProjectDepth(projectPath);
    var prefix = depth > 0 ? "|- ".repeat(depth) : "";
    var label = prefix + getProjectLeafName(projectPath);
    return (
      '<option value="' +
      escapeHtml(projectPath) +
      '" ' +
      (projectPath === sel ? "selected" : "") +
      ">" +
      escapeHtml(label) +
      "</option>"
    );
  }

  globalScope.ProjectPathUtils = {
    splitProjectPath: splitProjectPath,
    normalizeProjectPath: normalizeProjectPath,
    compareProjectPaths: compareProjectPaths,
    expandProjectTree: expandProjectTree,
    getProjectDepth: getProjectDepth,
    getProjectLeafName: getProjectLeafName,
    renderProjectOptionEntry: renderProjectOptionEntry,
  };
})(window);
