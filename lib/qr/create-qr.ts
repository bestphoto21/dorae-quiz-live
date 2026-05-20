const VERSION = 5;
const SIZE = VERSION * 4 + 17;
const DATA_CODEWORDS = 108;
const ECC_CODEWORDS = 26;
const QUIET_ZONE = 4;
const FORMAT_MASK = 0x5412;
const FORMAT_GENERATOR = 0x537;

export type QrMatrix = boolean[][];

type QrBuildResult = {
  modules: QrMatrix;
  reserved: boolean[][];
};

function createGrid(value = false) {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(value) as boolean[]);
}

function appendBits(bits: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push(((value >>> i) & 1) === 1 ? 1 : 0);
  }
}

function createDataCodewords(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  const capacityBits = DATA_CODEWORDS * 8;
  const maxByteLength = Math.floor((capacityBits - 4 - 8) / 8);

  if (bytes.length > maxByteLength) {
    throw new Error(`QR value is too long. Maximum is ${maxByteLength} bytes.`);
  }

  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);

  for (const byte of bytes) {
    appendBits(bits, byte, 8);
  }

  const terminatorLength = Math.min(4, capacityBits - bits.length);
  appendBits(bits, 0, terminatorLength);

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let codeword = 0;
    for (let j = 0; j < 8; j += 1) {
      codeword = (codeword << 1) | bits[i + j];
    }
    codewords.push(codeword);
  }

  for (let pad = 0xec; codewords.length < DATA_CODEWORDS; pad ^= 0xfd) {
    codewords.push(pad);
  }

  return codewords;
}

const GF_EXP = (() => {
  const exp = Array(512).fill(0) as number[];
  let value = 1;

  for (let i = 0; i < 255; i += 1) {
    exp[i] = value;
    value <<= 1;
    if (value & 0x100) {
      value ^= 0x11d;
    }
  }

  for (let i = 255; i < 512; i += 1) {
    exp[i] = exp[i - 255];
  }

  return exp;
})();

const GF_LOG = (() => {
  const log = Array(256).fill(0) as number[];

  for (let i = 0; i < 255; i += 1) {
    log[GF_EXP[i]] = i;
  }

  return log;
})();

function gfMultiply(left: number, right: number) {
  if (left === 0 || right === 0) {
    return 0;
  }

  return GF_EXP[GF_LOG[left] + GF_LOG[right]];
}

function createGeneratorPolynomial(degree: number) {
  let generator = [1];

  for (let i = 0; i < degree; i += 1) {
    const next = Array(generator.length + 1).fill(0) as number[];
    const root = GF_EXP[i];

    for (let j = 0; j < generator.length; j += 1) {
      next[j] ^= generator[j];
      next[j + 1] ^= gfMultiply(generator[j], root);
    }

    generator = next;
  }

  return generator;
}

function createErrorCorrectionCodewords(data: number[]) {
  const generator = createGeneratorPolynomial(ECC_CODEWORDS);
  const remainder = [...data, ...Array(ECC_CODEWORDS).fill(0)] as number[];

  for (let i = 0; i < data.length; i += 1) {
    const factor = remainder[i];

    if (factor === 0) {
      continue;
    }

    for (let j = 1; j < generator.length; j += 1) {
      remainder[i + j] ^= gfMultiply(generator[j], factor);
    }
  }

  return remainder.slice(data.length);
}

function setModule(
  result: QrBuildResult,
  x: number,
  y: number,
  dark: boolean,
  reserved = true
) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) {
    return;
  }

  result.modules[y][x] = dark;
  if (reserved) {
    result.reserved[y][x] = true;
  }
}

function drawFinder(result: QrBuildResult, x: number, y: number) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const xx = x + dx;
      const yy = y + dy;
      const inFinder = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const dark =
        inFinder &&
        (dx === 0 ||
          dx === 6 ||
          dy === 0 ||
          dy === 6 ||
          (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));

      setModule(result, xx, yy, dark);
    }
  }
}

function drawAlignment(result: QrBuildResult, x: number, y: number) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setModule(result, x + dx, y + dy, distance !== 1);
    }
  }
}

function reserveFormatAreas(result: QrBuildResult) {
  for (let i = 0; i <= 8; i += 1) {
    if (i !== 6) {
      setModule(result, 8, i, false);
      setModule(result, i, 8, false);
    }
  }

  for (let i = 0; i < 8; i += 1) {
    setModule(result, SIZE - 1 - i, 8, false);
    setModule(result, 8, SIZE - 1 - i, false);
  }

  setModule(result, 8, SIZE - 8, true);
}

function createBaseMatrix() {
  const result = {
    modules: createGrid(),
    reserved: createGrid(),
  };

  drawFinder(result, 0, 0);
  drawFinder(result, SIZE - 7, 0);
  drawFinder(result, 0, SIZE - 7);
  drawAlignment(result, 30, 30);

  for (let i = 8; i < SIZE - 8; i += 1) {
    const dark = i % 2 === 0;
    setModule(result, i, 6, dark);
    setModule(result, 6, i, dark);
  }

  reserveFormatAreas(result);

  return result;
}

function placeCodewords(result: QrBuildResult, codewords: number[]) {
  const bits: number[] = [];
  for (const codeword of codewords) {
    appendBits(bits, codeword, 8);
  }

  let bitIndex = 0;
  let upward = true;

  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right -= 1;
    }

    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const y = upward ? SIZE - 1 - vertical : vertical;

      for (let x = right; x >= right - 1; x -= 1) {
        if (result.reserved[y][x]) {
          continue;
        }

        result.modules[y][x] = bits[bitIndex] === 1;
        bitIndex += 1;
      }
    }

    upward = !upward;
  }
}

function maskBit(mask: number, x: number, y: number) {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return false;
  }
}

function applyMask(result: QrBuildResult, mask: number) {
  const modules = result.modules.map((row) => [...row]);

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (!result.reserved[y][x] && maskBit(mask, x, y)) {
        modules[y][x] = !modules[y][x];
      }
    }
  }

  return modules;
}

function formatBits(mask: number) {
  const data = (1 << 3) | mask;
  let bits = data << 10;

  for (let i = 14; i >= 10; i -= 1) {
    if (((bits >>> i) & 1) !== 0) {
      bits ^= FORMAT_GENERATOR << (i - 10);
    }
  }

  return ((data << 10) | bits) ^ FORMAT_MASK;
}

function drawFormatBits(modules: QrMatrix, mask: number) {
  const bits = formatBits(mask);
  const getBit = (index: number) => ((bits >>> index) & 1) !== 0;
  const set = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
  };

  for (let i = 0; i <= 5; i += 1) {
    set(8, i, getBit(i));
  }
  set(8, 7, getBit(6));
  set(8, 8, getBit(7));
  set(7, 8, getBit(8));
  for (let i = 9; i < 15; i += 1) {
    set(14 - i, 8, getBit(i));
  }

  for (let i = 0; i < 8; i += 1) {
    set(SIZE - 1 - i, 8, getBit(i));
  }
  for (let i = 8; i < 15; i += 1) {
    set(8, SIZE - 15 + i, getBit(i));
  }

  set(8, SIZE - 8, true);
}

function finderPenalty(line: boolean[]) {
  const pattern = [true, false, true, true, true, false, true, false, false, false, false];
  const reverse = [...pattern].reverse();
  let penalty = 0;

  for (let i = 0; i <= line.length - pattern.length; i += 1) {
    const slice = line.slice(i, i + pattern.length);
    const matchesPattern = pattern.every((value, index) => slice[index] === value);
    const matchesReverse = reverse.every((value, index) => slice[index] === value);

    if (matchesPattern || matchesReverse) {
      penalty += 40;
    }
  }

  return penalty;
}

function calculatePenalty(modules: QrMatrix) {
  let penalty = 0;
  let darkCount = 0;

  for (let y = 0; y < SIZE; y += 1) {
    let runColor = modules[y][0];
    let runLength = 0;
    penalty += finderPenalty(modules[y]);

    for (let x = 0; x < SIZE; x += 1) {
      if (modules[y][x]) {
        darkCount += 1;
      }

      if (modules[y][x] === runColor) {
        runLength += 1;
      } else {
        if (runLength >= 5) {
          penalty += 3 + runLength - 5;
        }
        runColor = modules[y][x];
        runLength = 1;
      }
    }

    if (runLength >= 5) {
      penalty += 3 + runLength - 5;
    }
  }

  for (let x = 0; x < SIZE; x += 1) {
    const column: boolean[] = [];
    let runColor = modules[0][x];
    let runLength = 0;

    for (let y = 0; y < SIZE; y += 1) {
      column.push(modules[y][x]);

      if (modules[y][x] === runColor) {
        runLength += 1;
      } else {
        if (runLength >= 5) {
          penalty += 3 + runLength - 5;
        }
        runColor = modules[y][x];
        runLength = 1;
      }
    }

    if (runLength >= 5) {
      penalty += 3 + runLength - 5;
    }

    penalty += finderPenalty(column);
  }

  for (let y = 0; y < SIZE - 1; y += 1) {
    for (let x = 0; x < SIZE - 1; x += 1) {
      const color = modules[y][x];
      if (
        modules[y][x + 1] === color &&
        modules[y + 1][x] === color &&
        modules[y + 1][x + 1] === color
      ) {
        penalty += 3;
      }
    }
  }

  const total = SIZE * SIZE;
  penalty += Math.floor(Math.abs(darkCount * 20 - total * 10) / total) * 10;

  return penalty;
}

export function createQrMatrix(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new Error("QR value is required.");
  }

  const dataCodewords = createDataCodewords(trimmedValue);
  const eccCodewords = createErrorCorrectionCodewords(dataCodewords);
  const base = createBaseMatrix();
  placeCodewords(base, [...dataCodewords, ...eccCodewords]);

  let bestMatrix: QrMatrix | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let mask = 0; mask < 8; mask += 1) {
    const masked = applyMask(base, mask);
    drawFormatBits(masked, mask);
    const penalty = calculatePenalty(masked);

    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMatrix = masked;
    }
  }

  if (!bestMatrix) {
    throw new Error("Failed to create QR matrix.");
  }

  return bestMatrix;
}

export function createQrSvgPath(matrix: QrMatrix) {
  return matrix
    .flatMap((row, y) =>
      row.map((dark, x) => (dark ? `M${x} ${y}h1v1H${x}z` : ""))
    )
    .filter(Boolean)
    .join("");
}

export function getQrViewBox(matrix: QrMatrix) {
  const size = matrix.length;
  return `${-QUIET_ZONE} ${-QUIET_ZONE} ${size + QUIET_ZONE * 2} ${
    size + QUIET_ZONE * 2
  }`;
}
