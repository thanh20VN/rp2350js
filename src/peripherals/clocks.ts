import { IRPChip } from '../rpchip';
import { BasePeripheral, Peripheral } from './peripheral';

const CLK_REF_CTRL = 0x30;
const CLK_REF_SELECTED = 0x38;
const CLK_SYS_CTRL = 0x3c;
const CLK_SYS_SELECTED = 0x44;
const CLK_PERI_CTRL = 0x48;
const CLK_PERI_SELECTED = 0x50;
const CLK_HSTX_CTRL = 0x54;
const CLK_HSTX_SELECTED = 0x5c;
const CLK_ADC_CTRL = 0x60;
const CLK_ADC_SELECTED = 0x68;
const CLK_PWM_CTRL = 0x6c;
const CLK_PWM_SELECTED = 0x74;

export class RPClocks<ChipType extends IRPChip = IRPChip>
  extends BasePeripheral<ChipType>
  implements Peripheral
{
  protected regs = new Uint32Array(1024);
  clkFc0StatusOffset = 0;

  constructor(rpchip: ChipType, name: string) {
    super(rpchip, name);
    // Dynamic switch case offset — use if/else instead for C compatibility
    if (rpchip.identifier === 'rp2350') {
      this.clkFc0StatusOffset = 0xa4;
    } else {
      this.clkFc0StatusOffset = 0x98;
    }
    this.regs[CLK_REF_SELECTED >>> 2] = 1;
    this.regs[CLK_SYS_SELECTED >>> 2] = 1;
    this.regs[CLK_PERI_SELECTED >>> 2] = 1;
    this.regs[CLK_HSTX_SELECTED >>> 2] = 1;
    this.regs[CLK_ADC_SELECTED >>> 2] = 1;
    this.regs[CLK_PWM_SELECTED >>> 2] = 1;
    this.regs[0x34 >>> 2] = 0x10000;
    this.regs[0x40 >>> 2] = 0x10000;
    this.regs[0x4c >>> 2] = 0x10000;
  }

  readUint32(offset: number) {
    if (offset === this.clkFc0StatusOffset) {
      return 0b10001; // done, passed
    }
    switch (offset) {
      case CLK_REF_SELECTED:
        return 1 << (this.regs[CLK_REF_CTRL >>> 2] & 0x03);
      case CLK_SYS_SELECTED:
        return 1 << (this.regs[CLK_SYS_CTRL >>> 2] & 0x01);
      case CLK_PERI_SELECTED:
      case CLK_HSTX_SELECTED:
      case CLK_ADC_SELECTED:
      case CLK_PWM_SELECTED:
        return 1;
    }
    return this.regs[offset >>> 2];
  }

  writeUint32(offset: number, value: number): void {
    this.regs[offset >>> 2] = value;
  }
}
