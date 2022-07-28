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
enum TechnologyField {
  A10BaseT =              (1 << 0),
  A10BaseT_FullDuplex =   (1 << 1),
  A100BaseTX =            (1 << 2),
  A100BaseTX_FullDuplex = (1 << 3),
  A100BaseT4 =            (1 << 4),

  APause =                (1 << 5),
  APause_FullDuplex =     (1 << 6),

  AReserved =             (1 << 7),
}

enum AdvancedTechnologyField {
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
  payload: LinkCodeWords;

  private constructor(payload: LinkCodeWords) {
    this.payload = payload;
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
      if( speed >= 10 )
        this.fastEthernet.technologyField |= TechnologyField.A10BaseT;
      if( speed >= 100 )
        this.fastEthernet.technologyField |= TechnologyField.A100BaseTX;
      if( speed >= 1000 )
        this.gigaEthernet.technologyField |= AdvancedTechnologyField.A1000BaseT;

      return this;
    }

    setMinSpeed(speed: number): this {
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

  constructor(iface: HardwareInterface) {
    this.iface = iface;
    this.iface.addListener(this);
  }

  public negociate(minSpeed: number=Number.MIN_SAFE_INTEGER, maxSpeed: number=Number.MAX_SAFE_INTEGER, fullDuplex: boolean=true) {
    let builder = new AutonegotiationMessage.Builder()
      .setMinSpeed(minSpeed)
      .setMaxSpeed(maxSpeed);

    if( fullDuplex )
      builder.setFullDuplex();
    else
      builder.setHalfDuplex();

    builder.build().map( i => {
      this.iface.sendBits(new PhysicalMessage(i));
    });
  }

  receiveBits(message: PhysicalMessage, from: Interface, to: Interface): void {
    if( message.payload instanceof AutonegotiationMessage ) {
      console.log(message);
    }
  }
}
