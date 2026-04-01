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
    process.stderr.write(question);

    const rl = readline.createInterface({
      input: process.stdin,
      output: new (require("stream").Writable)({
        write(_chunk: any, _encoding: any, callback: () => void) {
          callback();
        },
      }),
      terminal: true,
    });

    rl.question("", (answer) => {
      process.stderr.write("\n");
      rl.close();
      resolve(answer.trim());
    });
  });
}
