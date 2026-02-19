(function initIcsExport(globalScope) {
  function padIcsNumber(value) {
    return String(value).padStart(2, "0");
  }

  function toIcsUtcTimestamp(date) {
    var d = date || new Date();
    return (
      "" +
      d.getUTCFullYear() +
      padIcsNumber(d.getUTCMonth() + 1) +
      padIcsNumber(d.getUTCDate()) +
      "T" +
      padIcsNumber(d.getUTCHours()) +
      padIcsNumber(d.getUTCMinutes()) +
      padIcsNumber(d.getUTCSeconds()) +
      "Z"
    );
  }

  function toIcsDateValue(dueDateValue) {
    var dueDate = dueDateValue ? new Date(dueDateValue) : null;
    if (!dueDate || Number.isNaN(dueDate.getTime())) {
      return null;
    }
    return (
      "" +
      dueDate.getFullYear() +
      padIcsNumber(dueDate.getMonth() + 1) +
      padIcsNumber(dueDate.getDate())
    );
  }

  function escapeIcsText(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\n|\r/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function foldIcsLine(line, maxLength) {
    var max = maxLength || 75;
    if (line.length <= max) {
      return line;
    }
    var chunks = [];
    for (var index = 0; index < line.length; index += max) {
      chunks.push(line.slice(index, index + max));
    }
    return chunks.join("\r\n ");
  }

  function buildIcsContentForTodos(todoList) {
    var dtStamp = toIcsUtcTimestamp();
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//todos-api//Todos Export//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    for (var i = 0; i < todoList.length; i++) {
      var todo = todoList[i];
      var eventDate = toIcsDateValue(todo.dueDate);
      if (!eventDate) continue;

      var summary = escapeIcsText(todo.title || "Untitled task");
      var detailParts = [];
      if (todo.description && String(todo.description).trim()) {
        detailParts.push(String(todo.description).trim());
      }
      if (todo.notes && String(todo.notes).trim()) {
        detailParts.push(String(todo.notes).trim());
      }
      var description = escapeIcsText(detailParts.join("\n\n"));

      lines.push("BEGIN:VEVENT");
      lines.push("UID:" + escapeIcsText(todo.id + "@todos-api"));
      lines.push("DTSTAMP:" + dtStamp);
      lines.push("DTSTART;VALUE=DATE:" + eventDate);
      lines.push("SUMMARY:" + summary);
      if (description) {
        lines.push("DESCRIPTION:" + description);
      }
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return (
      lines
        .map(function (line) {
          return foldIcsLine(line);
        })
        .join("\r\n") + "\r\n"
    );
  }

  function buildIcsFilename(date) {
    var d = date || new Date();
    var year = d.getFullYear();
    var month = padIcsNumber(d.getMonth() + 1);
    var day = padIcsNumber(d.getDate());
    return "todos-" + year + "-" + month + "-" + day + ".ics";
  }

  globalScope.IcsExport = {
    padIcsNumber: padIcsNumber,
    toIcsUtcTimestamp: toIcsUtcTimestamp,
    toIcsDateValue: toIcsDateValue,
    escapeIcsText: escapeIcsText,
    foldIcsLine: foldIcsLine,
    buildIcsContentForTodos: buildIcsContentForTodos,
    buildIcsFilename: buildIcsFilename,
  };
})(window);
