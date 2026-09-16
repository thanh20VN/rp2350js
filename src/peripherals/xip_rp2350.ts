import { IRPChip } from '../rpchip';
import { BasePeripheral, Peripheral } from './peripheral';

const QMI_DIRECT_CSR = 0x00;
const QMI_DIRECT_TX = 0x04;
const QMI_DIRECT_RX = 0x08;

const DIRECT_CSR_RESET = 0x01800000;
const DIRECT_CSR_BUSY = 1 << 1;
const DIRECT_CSR_ASSERT_CS0N = 1 << 2;
const DIRECT_CSR_ASSERT_CS1N = 1 << 3;
const DIRECT_CSR_TXEMPTY = 1 << 11;
const DIRECT_CSR_TXFULL = 1 << 10;
const DIRECT_CSR_RXEMPTY = 1 << 16;
const DIRECT_CSR_RXFULL = 1 << 17;
const DIRECT_CSR_EN = 1 << 0;

/**
 * RP2350 QSPI Memory Interface (QMI).
 * Reference: RP2350 datasheet §12.14.
 * Models direct-mode CSR/TX/RX FIFOs to support PSRAM initialisation and ID queries
 * (e.g. command 0x9f returning KGD = 0x5D, EID = 0x26 for APS6404L PSRAM chips).
 * The memory-mapped XIP windows (0x10000000+ flash, 0x11000000+ PSRAM) are handled
 * by the chip directly.
 */
export class RPXIPQMI<ChipType extends IRPChip = IRPChip>
  extends BasePeripheral<ChipType>
  implements Peripheral
{
  private directCsr = DIRECT_CSR_RESET;
  private directCsrEn = false;
  private rxFifo: number[] = [];
  private currentCmd = 0;
  private byteCount = 0;
  private csAsserted = false;
  private regs = new Uint32Array(256);

  readUint32(offset: number) {
    if (offset === QMI_DIRECT_CSR) {
      const rxEmpty = this.rxFifo.length === 0 ? DIRECT_CSR_RXEMPTY : 0;
      return (
        (this.directCsr |
          (this.directCsrEn ? DIRECT_CSR_EN : 0) |
          DIRECT_CSR_TXEMPTY |
          rxEmpty) >>>
        0
      );
    }
    if (offset === QMI_DIRECT_RX) {
      return (this.rxFifo.shift() ?? 0) >>> 0;
    }
    return this.regs[offset >>> 2];
  }

  writeUint32(offset: number, value: number) {
    if (offset === QMI_DIRECT_CSR) {
      this.directCsr = value & ~DIRECT_CSR_BUSY;
      this.directCsrEn = !!(value & DIRECT_CSR_EN);
      const newCsAsserted = !!(value & (DIRECT_CSR_ASSERT_CS0N | DIRECT_CSR_ASSERT_CS1N));
      if (newCsAsserted && !this.csAsserted) {
        this.currentCmd = 0;
        this.byteCount = 0;
      }
      this.csAsserted = newCsAsserted;
      return;
    }
    if (offset === QMI_DIRECT_TX) {
      const txByte = value & 0xff;
      if (this.byteCount === 0) {
        this.currentCmd = txByte;
      }

      let response = 0;
      if (this.currentCmd === 0x9f) {
        if (this.byteCount === 5) {
          response = 0x5d; // KGD
        } else if (this.byteCount === 6) {
          response = 0x26; // EID (APS6404L)
        }
      }

      this.byteCount++;
      this.rxFifo.push(response);
      return;
    }
    this.regs[offset >>> 2] = value;
  }
}

/** Legacy XIP peripheral (kept for any existing imports). */
export class RPXIP<ChipType extends IRPChip = IRPChip>
  extends BasePeripheral<ChipType>
  implements Peripheral
{
  protected regs = new Uint32Array(1024);

  readUint32(offset: number) {
    super.readUint32(offset);
    return this.regs[offset];
  }

  writeUint32(offset: number, value: number) {
    super.writeUint32(offset, value);
    this.regs[offset] = value;
  }
}
