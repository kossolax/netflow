import { HardwareInterface, Interface } from "../layers/datalink.model";
import { AbstractLink, Link } from "../layers/physical.model";
import { Payload, PhysicalMessage } from "../message.model";
import { PhysicalListener } from "./protocols.model";

//
enum SelectorField {
  Ethernet, // 802.3
  IsLan,    // 802.9
}

// http://www.ethermanage.com/ethernet/pdf/dell-auto-neg.pdf
export enum TechnologyField {
  A10BaseT =              (1 << 0),
  A10BaseT_FullDuplex =   (1 << 1),
  A100BaseTX =            (1 << 2),
  A100BaseTX_FullDuplex = (1 << 3),
  A100BaseT4 =            (1 << 4),

  APause =                (1 << 5),
  APause_FullDuplex =     (1 << 6),

  AReserved =             (1 << 7),
}
export enum AdvancedTechnologyField {
  A1000BaseT =             (1 << 0),
  //A1000BaseT_MasterSlave = (1 << 1), // not implemented
  A1000BaseT_MultiPort =   (1 << 2),
  A1000BaseT_HalfDuplex =  (1 << 3),
}

interface BaseLinkCodeWord {
  remoteFault: boolean,
  acknowledge: boolean,
  nextPage: boolean,
}
interface LinkCodeWord_Page0 extends BaseLinkCodeWord {
  selectorField: SelectorField,
  technologyField: TechnologyField,
}
interface LinkCodeWord_Page1 extends BaseLinkCodeWord {
  technologyField: AdvancedTechnologyField,
}
type LinkCodeWords = LinkCodeWord_Page0|LinkCodeWord_Page1;

// CL73-AN 802.3ab
// CL73-AN 802.3cd
// CL73-AN 802.3ck

export class AutonegotiationMessage implements Payload {
  code: LinkCodeWords;

  private constructor(code: LinkCodeWords) {
    this.code = code;
  }

  get length(): number {
    return 2;
  }
  toString(): string {
    return "AutoNegotiation";
  }

  static Builder = class {

    private fastEthernet: LinkCodeWord_Page0;
    private gigaEthernet: LinkCodeWord_Page1;
    private minSpeed: number = Number.MIN_SAFE_INTEGER;
    private maxSpeed: number = Number.MAX_SAFE_INTEGER;

    constructor() {
      this.fastEthernet = {
        selectorField: SelectorField.Ethernet,

        technologyField: 0,

        remoteFault: false,
        acknowledge: false,
        nextPage: false,
      }
      this.gigaEthernet = {
        technologyField: 0,

        remoteFault: false,
        acknowledge: false,
        nextPage: false,
      }
    }

    setHalfDuplex(): this {
      // remove flags
      this.fastEthernet.technologyField &= ~TechnologyField.A10BaseT_FullDuplex;
      this.fastEthernet.technologyField &= ~TechnologyField.A100BaseTX_FullDuplex;
      this.fastEthernet.technologyField &= ~TechnologyField.APause_FullDuplex;

      // add flag if gig is supported
      if( this.gigaEthernet.technologyField & AdvancedTechnologyField.A1000BaseT )
        this.gigaEthernet.technologyField |= AdvancedTechnologyField.A1000BaseT_HalfDuplex;

      return this;
    }

    setFullDuplex(): this {
      // add flags
      if( this.fastEthernet.technologyField & TechnologyField.A10BaseT )
        this.fastEthernet.technologyField |= TechnologyField.A10BaseT_FullDuplex;
      if( this.fastEthernet.technologyField & TechnologyField.A100BaseTX )
        this.fastEthernet.technologyField |= TechnologyField.A100BaseTX_FullDuplex;
      if( this.fastEthernet.technologyField & TechnologyField.APause )
        this.fastEthernet.technologyField |= TechnologyField.APause_FullDuplex;

      // remove flags
      this.gigaEthernet.technologyField &= ~AdvancedTechnologyField.A1000BaseT_HalfDuplex;
      return this;
    }

    setMaxSpeed(speed: number): this {
      this.maxSpeed = speed;

      if( speed >= 10 && this.minSpeed <= 10) {
        this.fastEthernet.technologyField |= TechnologyField.A10BaseT;
        this.fastEthernet.technologyField |= TechnologyField.A10BaseT_FullDuplex;
      }
      if( speed >= 100 && this.minSpeed <= 100 ) {
        this.fastEthernet.technologyField |= TechnologyField.A100BaseTX;
        this.fastEthernet.technologyField |= TechnologyField.A100BaseTX_FullDuplex;
      }
      if( speed >= 1000 && this.minSpeed <= 1000 ) {
        this.gigaEthernet.technologyField |= AdvancedTechnologyField.A1000BaseT;
      }

      return this;
    }

    setMinSpeed(speed: number): this {
      this.minSpeed = speed;

      if( speed > 10 ) {
        this.fastEthernet.technologyField &= ~TechnologyField.A10BaseT;
        this.fastEthernet.technologyField &= ~TechnologyField.A10BaseT_FullDuplex;
      }

      if( speed > 100 ) {
        this.fastEthernet.technologyField &= ~TechnologyField.A100BaseTX;
        this.fastEthernet.technologyField &= ~TechnologyField.A100BaseTX_FullDuplex;
      }

      if( speed > 1000 ) {
        this.gigaEthernet.technologyField &= ~AdvancedTechnologyField.A1000BaseT;
        this.gigaEthernet.technologyField &= ~AdvancedTechnologyField.A1000BaseT_MultiPort;
        this.gigaEthernet.technologyField &= ~AdvancedTechnologyField.A1000BaseT_HalfDuplex;
      }

      return this;
    }

    acknowledge(): this {
      this.fastEthernet.acknowledge = true;
      this.gigaEthernet.acknowledge = true;
      return this;
    }



    build(): AutonegotiationMessage[] {
      let messages:AutonegotiationMessage[]  = []

      if( this.gigaEthernet.technologyField !== 0 )
        this.fastEthernet.nextPage = true;

      messages.push(new AutonegotiationMessage(this.fastEthernet));
      if( this.gigaEthernet.technologyField !== 0 )
        messages.push(new AutonegotiationMessage(this.gigaEthernet));

      return messages;
    }
  }
}

export class AutoNegotiationProtocol implements PhysicalListener {
  private iface: HardwareInterface;

  private minSpeed: number = Number.MIN_SAFE_INTEGER;
  private maxSpeed: number = Number.MAX_SAFE_INTEGER;
  private fullDuplex: boolean = true;

  private lastReceive: Date = new Date();
  private neighbourConfig: LinkCodeWords[] = [];

  constructor(iface: HardwareInterface) {
    this.iface = iface;
    this.iface.addListener(this);
  }

  public negociate(minSpeed: number=Number.MIN_SAFE_INTEGER, maxSpeed: number=Number.MAX_SAFE_INTEGER, fullDuplex: boolean=true, acknowledge: boolean=false): void {
    this.minSpeed = minSpeed;
    this.maxSpeed = maxSpeed;
    this.fullDuplex = fullDuplex;

    let builder = new AutonegotiationMessage.Builder()
      .setMinSpeed(minSpeed)
      .setMaxSpeed(maxSpeed);

    if( fullDuplex )
      builder.setFullDuplex();
    else
      builder.setHalfDuplex();

    if( acknowledge )
      builder.acknowledge();

    this.iface.Speed = minSpeed;
    builder.build().map( i => {
      this.iface.sendBits(new PhysicalMessage(i));
    });
  }

  receiveBits(message: PhysicalMessage, from: Interface, to: Interface): void {
    if( message.payload instanceof AutonegotiationMessage ) {

      this.lastReceive = new Date();
      this.neighbourConfig.push(message.payload.code);

      if( message.payload.code.nextPage === false ) {
        this.setSpeed();

        if( message.payload.code.acknowledge === false )
          this.negociate(this.iface.Speed, this.iface.Speed, this.iface.FullDuplex, true);
      }
    }
  }

  private setSpeed() {
    let speed = 0;
    let duplex = false;
    let testSpeed = 0;

    for(let page=0; page<this.neighbourConfig.length; page++) {
      switch(page) {
        case 0: {
          let code = this.neighbourConfig[page] as LinkCodeWord_Page0;

          testSpeed = 10;
          if( this.minSpeed <= testSpeed && this.maxSpeed >= testSpeed ) {
            if( code.technologyField & TechnologyField.A10BaseT ) {
              speed = testSpeed;
              duplex = false;
            }
            if( code.technologyField & TechnologyField.A10BaseT_FullDuplex && this.fullDuplex ) {
              speed = testSpeed;
              duplex = true;
            }
          }

          testSpeed = 100;
          if( this.minSpeed <= testSpeed && this.maxSpeed >= testSpeed ) {
            if( code.technologyField & TechnologyField.A100BaseTX ) {
              speed = testSpeed;
              duplex = false;
            }
            if( code.technologyField & TechnologyField.A100BaseT4 ) {
              speed = testSpeed;
              duplex = false;
            }
            if( code.technologyField & TechnologyField.A100BaseTX_FullDuplex && this.fullDuplex ) {
              speed = testSpeed;
              duplex = true;
            }
          }

          break;
        }
        case 1: {
          let code = this.neighbourConfig[page] as LinkCodeWord_Page1;

          testSpeed = 1000;
          if( this.minSpeed <= testSpeed && this.maxSpeed >= testSpeed ) {
            if( code.technologyField & AdvancedTechnologyField.A1000BaseT_HalfDuplex ) {
              speed = testSpeed;
              duplex = false;
            }
            if( code.technologyField & AdvancedTechnologyField.A1000BaseT && this.fullDuplex ) {
              speed = testSpeed;
              duplex = true;
            }
            if( code.technologyField & AdvancedTechnologyField.A1000BaseT_MultiPort && this.fullDuplex  ) {
              speed = testSpeed;
              duplex = true;
            }
          }

          break;
        }
        default: {
          throw new Error("Unsupported page");
        }
      }
    }

    if( speed == 0 )
        throw new Error("Autonegotiation failed");

    this.iface.Speed = speed;
    this.iface.FullDuplex = duplex;

    this.neighbourConfig = [];
  }
}
