import { RouterHost } from "../node.model";
import { Terminal } from "./terminal.model";

describe('Terminal basic test', () => {
  let terminalRouter: Terminal;

  beforeEach(async () => {
    terminalRouter = new Terminal(new RouterHost("R", 4));
  });

  it( 'basic auto-complete', () => {
    expect(terminalRouter.autocomplete("", []).length).toBeGreaterThan(0);

    expect(terminalRouter.autocomplete("ena", []).length).toEqual(1);
    expect(terminalRouter.autocomplete("ena", [])[0]).toBe("enable");

    expect(terminalRouter.autocomplete("enable", []).length).toEqual(1);
    expect(terminalRouter.autocomplete("enable", [])[0]).toBe("enable");
  });

  it( 'basic command', () => {
    terminalRouter.exec("enable", []);
    expect(terminalRouter.Prompt).toBe(terminalRouter.Node.name + "#");
    terminalRouter.exec("exit", []);
    expect(terminalRouter.Prompt).toBe(terminalRouter.Node.name + "$");
    terminalRouter.exec("enable", []);
    expect(terminalRouter.Prompt).toBe(terminalRouter.Node.name + "#");
    terminalRouter.exec("end", []);
    expect(terminalRouter.Prompt).toBe(terminalRouter.Node.name + "$");
  });

});
