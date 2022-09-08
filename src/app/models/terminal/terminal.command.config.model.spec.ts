import { RouterHost } from "../node.model";
import { Terminal } from "./terminal.model";

describe('Terminal config tesxxt', () => {
  let terminalRouter: Terminal;

  beforeEach(async () => {
    terminalRouter = new Terminal(new RouterHost("R", 4));
  });

  it( 'basic confi xxxg', () => {

    terminalRouter.exec("enable", []);
    terminalRouter.exec("configure", ["terminal"]);

    const hostname = Math.random().toString(36).substring(7);
    terminalRouter.exec("hostname", [hostname]);

    expect(terminalRouter.Node.name).toBe(hostname);
    expect(terminalRouter.Prompt).toBe(hostname + "(config)#");

    terminalRouter.exec("exit", []);
    expect(terminalRouter.Prompt).toBe(hostname + "$");

  });

});
