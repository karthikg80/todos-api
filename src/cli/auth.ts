import readline from "readline";

export function promptInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function promptPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    // Disable echo for password input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode?.(true);
    }

    process.stderr.write(question);
    let password = "";

    const onData = (char: Buffer) => {
      const ch = char.toString("utf-8");
      if (ch === "\n" || ch === "\r" || ch === "\u0004") {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode?.(false);
        }
        process.stdin.removeListener("data", onData);
        process.stderr.write("\n");
        rl.close();
        resolve(password);
      } else if (ch === "\u007F" || ch === "\b") {
        // backspace
        password = password.slice(0, -1);
      } else if (ch === "\u0003") {
        // ctrl-c
        process.stderr.write("\n");
        process.exit(1);
      } else {
        password += ch;
      }
    };

    process.stdin.on("data", onData);
    process.stdin.resume();
  });
}
