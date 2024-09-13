import { validateValue } from "../../../utils/utils";
import BinaryReader from "./binaryRead";
import {
  ClassDefFormat1,
  ClassDefFormat2,
  CmapTable,
  CoverageTableFormat1,
  CoverageTableFormat2,
  ExtensionLookupType2Format1,
  ExtensionLookupType2Format2,
  GPOSLookup,
  GPOSTable,
  GlyfTable,
  HeadTable,
  HheaTable,
  HmtxTable,
  Int16,
  LocaTable,
  LookupType,
  MaxpTable,
  TTF,
  Tables,
  Uint16,
  Uint32,
  ValueRecord,
} from "./parserTypes.d";

export function parseTTF(data: ArrayBuffer) {
  if (data.byteLength === 0) throw new Error("File is empty.");
  const ttf: Partial<TTF> = {};

  const reader = new BinaryReader(data);
  const tables: Tables = {};

  reader.setPosition(4);
  const numofTables = reader.getUint16();
  if (numofTables > 20) throw new Error("This is not a TTF file.");

  //createTablesMap
  reader.setPosition(12);
  for (let i = 0; i < numofTables; i++) {
    const tag = reader.getString(4);
    tables[tag] = {
      checksum: reader.getUint32(),
      offset: reader.getUint32(),
      length: reader.getUint32(),
    };
  }
  console.log("my", tables);

  //build TTF
  const position = reader.getPosition();
  //header TTF
  ttf.head = readHeadTable(reader, tables["head"].offset);
  reader.setPosition(position);
  //cmap: zawiera mapowania krztaltow odpowiednich liter, indeksowanych za pomoca unicodu
  ttf.cmap = readCmapTable(reader, tables["cmap"].offset);
  reader.setPosition(position);
  //maxP: zawiera rozne maxymalne wartosci w foncie, uzywana do alokacji
  ttf.maxp = readMaxpTable(reader, tables["maxp"].offset);
  reader.setPosition(position);
  //hhead: zawiera info o poziomie(y) glyphow
  ttf.hhea = readHheaTable(reader, tables["hhea"].offset);
  reader.setPosition(position);
  //hmtx: zawiera info o pionie(x) glyphow
  ttf.hmtx = readHmtxTable(
    reader,
    tables["hmtx"].offset,
    ttf.maxp?.numGlyphs,
    ttf.hhea?.numberOfHMetrics
  );
  reader.setPosition(position);
  //loca: indexowanie do tablicy glyphu, gdzie sa faktycznie przechowywane jego dane
  ttf.loca = readLocaTable(
    reader,
    tables["loca"].offset,
    ttf.maxp?.numGlyphs,
    ttf.head?.indexToLocFormat
  );
  reader.setPosition(position);
  //glyph: faktyczne dane o glyphie, jego wszystkie punkty vectorowe i zakrzywienia
  ttf.glyf = readGlyfTable(
    reader,
    tables["glyf"].offset,
    ttf.loca,
    ttf.head?.indexToLocFormat
  );
  reader.setPosition(position);
  //GPOS: zestaw info jak w dziwnych jezykach laczyc znaczki itp
  if (tables["GPOS"]) ttf.GPOS = readGPOSTable(reader, tables["GPOS"].offset);
  reader.setPosition(position);
  return ttf as TTF;
}
function readHeadTable(reader: BinaryReader, offset: number): HeadTable {
  reader.setPosition(offset);
  const head: HeadTable = {
    majorVersion: reader.getUint16(),
    minorVersion: reader.getUint16(),
    fontRevision: reader.getFixed(),
    checksumAdjustment: reader.getUint32(),
    magicNumber: reader.getUint32(),
    flags: reader.getUint16(),
    unitsPerEm: reader.getUint16(),
    created: reader.getDate(),
    modified: reader.getDate(),
    xMin: reader.getFWord(),
    yMin: reader.getFWord(),
    xMax: reader.getFWord(),
    yMax: reader.getFWord(),
    macStyle: reader.getUint16(),
    lowestRecPPEM: reader.getUint16(),
    fontDirectionHint: reader.getInt16(),
    indexToLocFormat: reader.getInt16(),
    glyphDataFormat: reader.getInt16(),
  };
  return head;
}
function readCmapTable(reader: BinaryReader, offset: number): CmapTable {
  reader.setPosition(offset);
  const version = reader.getUint16();
  const numTables = reader.getUint16();
  const encodingRecords: {
    platformID: Uint16;
    encodingID: Uint16;
    offset: Uint32;
  }[] = [];

  //   let selectedOffset: number | null = null;
  for (let i = 0; i < numTables; i++) {
    const platformID = reader.getUint16();
    const encodingID = reader.getUint16();
    const offset = reader.getUint32();
    encodingRecords.push({ platformID, encodingID, offset });
    // const isWindowsPlatform =
    //   platformID === 3 &&
    //   (encodingID === 0 || encodingID === 1 || encodingID === 10);
    // const isUnicodePlatform =
    //   platformID === 0 &&
    //   (encodingID === 0 ||
    //     encodingID === 1 ||
    //     encodingID === 2 ||
    //     encodingID === 3 ||
    //     encodingID === 4);

    // if (isWindowsPlatform || isUnicodePlatform) {
    //   //   selectedOffset = offset;
    // }
  }
  const format = reader.getUint16();
  const length = reader.getUint16();
  const language = reader.getUint16();
  const segCountX2 = reader.getUint16();
  const segCount = segCountX2 / 2;
  const searchRange = reader.getUint16();
  const entrySelector = reader.getUint16();
  const rangeShift = reader.getUint16();

  const endCodes: number[] = [];
  for (let i = 0; i < segCount; i++) {
    endCodes.push(reader.getUint16());
  }
  reader.getUint16(); // reservedPad
  const startCodes: number[] = [];
  for (let i = 0; i < segCount; i++) {
    startCodes.push(reader.getUint16());
  }

  const idDeltas: number[] = [];
  for (let i = 0; i < segCount; i++) {
    idDeltas.push(reader.getUint16());
  }

  const idRangeOffsetsStart = reader.getPosition();
  const idRangeOffsets: number[] = [];
  for (let i = 0; i < segCount; i++) {
    idRangeOffsets.push(reader.getUint16());
  }

  const glyphIndexMap = new Map<number, number>();
  for (let i = 0; i < segCount - 1; i++) {
    let glyphIndex = 0;
    const endCode = endCodes[i];
    const startCode = startCodes[i];
    const idDelta = idDeltas[i];
    const idRangeOffset = idRangeOffsets[i];

    for (let c = startCode; c <= endCode; c++) {
      if (idRangeOffset !== 0) {
        const startCodeOffset = (c - startCode) * 2;
        const currentRangeOffset = i * 2; // 2 because the numbers are 2 byte big.

        const glyphIndexOffset =
          idRangeOffsetsStart +
          idRangeOffset +
          currentRangeOffset +
          startCodeOffset;

        reader.setPosition(glyphIndexOffset);
        glyphIndex = reader.getUint16();
        if (glyphIndex !== 0) {
          // & 0xffff is modulo 65536.
          glyphIndex = (glyphIndex + idDelta) & 0xffff;
        }
      } else {
        glyphIndex = (c + idDelta) & 0xffff;
      }
      glyphIndexMap.set(c, glyphIndex);
    }
  }
  const cmap: CmapTable = {
    version,
    numTables,
    encodingRecords,
    format,
    length,
    language,
    segCountX2,
    segCount,
    searchRange,
    entrySelector,
    rangeShift,
    endCodes,
    startCodes,
    idDeltas,
    idRangeOffsets,
    glyphIndexMap,
  };
  return cmap;
}
function readMaxpTable(reader: BinaryReader, offset: number): MaxpTable {
  reader.setPosition(offset);
  const version = reader.getUint32();
  const versionString =
    version === 0x00005000 ? "0.5" : version === 0x00010000 ? "1.0" : undefined;
  const numGlyphs = reader.getUint16();
  if (!versionString) throw Error("no version string in MaxpTable");
  const maxp: MaxpTable = {
    version: versionString,
    numGlyphs,
  };
  return maxp;
}
function readHheaTable(reader: BinaryReader, offset: number): HheaTable {
  reader.setPosition(offset);

  const hhea: HheaTable = {
    majorVersion: reader.getUint16(),
    minorVersion: reader.getUint16(),
    ascender: reader.getInt16(),
    descender: reader.getInt16(),
    lineGap: reader.getInt16(),
    advanceWidthMax: reader.getUint16(),
    minLeftSideBearing: reader.getInt16(),
    minRightSideBearing: reader.getInt16(),
    xMaxExtent: reader.getInt16(),
    caretSlopeRise: reader.getInt16(),
    caretSlopeRun: reader.getInt16(),
    caretOffset: reader.getInt16(),
    reserved1: reader.getInt16(),
    reserved2: reader.getInt16(),
    reserved3: reader.getInt16(),
    reserved4: reader.getInt16(),
    metricDataFormat: reader.getInt16(),
    numberOfHMetrics: reader.getUint16(),
  };

  return hhea;
}
function readHmtxTable(
  reader: BinaryReader,
  offset: number,
  numGlyphs: number,
  numOfLongHorMetrics: number
): HmtxTable {
  reader.setPosition(offset);
  const hMetrics: {
    advanceWidth: Uint16;
    leftSideBearing: Int16;
  }[] = [];
  for (let i = 0; i < numOfLongHorMetrics; i++) {
    hMetrics.push({
      advanceWidth: reader.getUint16(),
      leftSideBearing: reader.getInt16(),
    });
  }
  const leftSideBearings: number[] = [];
  for (let i = 0; i < numGlyphs - numOfLongHorMetrics; i++) {
    leftSideBearings.push(reader.getInt16());
  }
  const hmtx: HmtxTable = {
    hMetrics,
    leftSideBearings,
  };
  return hmtx;
}
function readLocaTable(
  reader: BinaryReader,
  offset: number,
  numGlyphs: number,
  indexToLocFormat: number
): LocaTable {
  reader.setPosition(offset);

  const loca: number[] = [];
  for (let i = 0; i < numGlyphs + 1; i++) {
    loca.push(indexToLocFormat === 0 ? reader.getUint16() : reader.getUint32());
  }

  return { offsets: loca };
}
function readGlyfTable(
  reader: BinaryReader,
  offset: number,
  loca: LocaTable,
  indexToLocFormat: number
): GlyfTable {
  reader.setPosition(offset);

  const glyfs = [];
  for (let i = 0; i < loca.offsets.length - 1; i++) {
    const multiplier = indexToLocFormat === 0 ? 2 : 1;
    const locaOffset = loca.offsets[i] * multiplier;

    reader.setPosition(offset + locaOffset);

    glyfs.push({
      numberOfContours: reader.getInt16(),
      xMin: reader.getInt16(),
      yMin: reader.getInt16(),
      xMax: reader.getInt16(),
      yMax: reader.getInt16(),
    });
  }

  return glyfs;
}
function readGPOSTable(reader: BinaryReader, offset: number): GPOSTable {
  reader.setPosition(offset + 6);
  const featureListOffset = reader.getUint16();
  const lookupListOffset = reader.getUint16();

  reader.setPosition(offset + featureListOffset);

  const featureCount = reader.getUint16();
  const featureInfo = [];
  const features = [];
  for (let i = 0; i < featureCount; i++) {
    const tag = reader.getString(4);
    const offset = reader.getUint16();
    const feature = {
      tag,
      offset,
    };

    featureInfo.push(feature);
  }

  for (let i = 0; i < featureCount; i++) {
    reader.setPosition(offset + featureListOffset + featureInfo[i].offset);

    const paramsOffset = reader.getUint16();
    const lookupIndexCount = reader.getUint16();
    const lookupListIndices: number[] = [];

    for (let j = 0; j < lookupIndexCount; j++) {
      lookupListIndices.push(reader.getUint16());
    }

    features.push({
      tag: featureInfo[i].tag,
      paramsOffset,
      lookupListIndices,
    });
  }

  reader.setPosition(offset + lookupListOffset);
  const lookupCount = reader.getUint16();

  const lookupTables: Array<number> = [];
  for (let i = 0; i < lookupCount; i++) {
    lookupTables.push(reader.getUint16());
  }

  const lookups: Array<GPOSLookup> = [];
  for (let i = 0; i < lookupCount; i++) {
    reader.setPosition(offset + lookupListOffset + lookupTables[i]);

    const lookupType = reader.getUint16();
    const lookupFlag = reader.getUint16();
    const subTableCount = reader.getUint16();
    const subTableOffsets: number[] = [];
    for (let j = 0; j < subTableCount; j++) {
      subTableOffsets.push(reader.getUint16());
    }

    let markFilteringSet;
    if (lookupFlag & 0x0010) {
      markFilteringSet = reader.getUint16();
    }

    const lookup: GPOSLookup = {
      lookupType: lookupType,
      lookupFlag,
      subtables: [],
      markFilteringSet,
    };

    // Only extension supported for now.
    if (lookupType === LookupType.ExtensionPositioning) {
      for (let j = 0; j < subTableCount; j++) {
        reader.setPosition(
          offset + lookupListOffset + lookupTables[i] + subTableOffsets[j]
        );

        const posFormat = reader.getUint16();
        const extensionLookupType = reader.getUint16();
        const extensionOffset = reader.getUint32();

        let extension = {} as
          | ExtensionLookupType2Format1
          | ExtensionLookupType2Format2;
        reader.runAt(
          offset +
            lookupListOffset +
            lookupTables[i] +
            subTableOffsets[j] +
            extensionOffset,
          () => {
            if (extensionLookupType === LookupType.PairAdjustment) {
              const posFormat = reader.getUint16();
              validateValue(
                posFormat === 1 || posFormat === 2,
                "Invalid posFormat."
              );
              extension.posFormat = posFormat;

              if (posFormat === 1) {
                const coverageOffset = reader.getUint16();
                const valueFormat1 = reader.getUint16();
                const valueFormat2 = reader.getUint16();
                const pairSetCount = reader.getUint16();
                const pairSetOffsets: number[] = [];
                for (let i = 0; i < pairSetCount; i++) {
                  pairSetOffsets.push(reader.getUint16());
                }

                const pairSets: Array<
                  Array<{
                    secondGlyph: number;
                    value1?: ValueRecord;
                    value2?: ValueRecord;
                  }>
                > = [];
                for (let k = 0; k < pairSetCount; k++) {
                  reader.setPosition(
                    offset +
                      lookupListOffset +
                      lookupTables[i] +
                      subTableOffsets[j] +
                      extensionOffset +
                      pairSetOffsets[k]
                  );

                  const pairValueCount = reader.getUint16();
                  const pairValues: (typeof pairSets)[number] = [];
                  for (let l = 0; l < pairValueCount; l++) {
                    const pairValue: (typeof pairSets)[number][number] = {
                      secondGlyph: reader.getUint16(),
                    };
                    const value1 = getValueRecord(reader, valueFormat1);
                    const value2 = getValueRecord(reader, valueFormat2);

                    if (value1) {
                      pairValue.value1 = value1;
                    }
                    if (value2) {
                      pairValue.value2 = value2;
                    }
                    pairValues.push(pairValue);
                  }
                  pairSets.push(pairValues);
                }

                extension.coverage = reader.runAt(
                  offset +
                    lookupListOffset +
                    lookupTables[i] +
                    subTableOffsets[j] +
                    extensionOffset +
                    coverageOffset,
                  () => {
                    const coverageFormat = reader.getUint16();

                    return parseCoverage(reader, coverageFormat);
                  }
                );

                extension = {
                  ...extension,
                  valueFormat1: valueFormat1,
                  valueFormat2: valueFormat2,
                  pairSets,
                } as ExtensionLookupType2Format1;
              } else if (posFormat === 2) {
                const coverageOffset = reader.getUint16();
                const valueFormat1 = reader.getUint16();
                const valueFormat2 = reader.getUint16();
                const classDef1Offset = reader.getUint16();
                const classDef2Offset = reader.getUint16();
                const class1Count = reader.getUint16();
                const class2Count = reader.getUint16();

                extension.coverage = reader.runAt(
                  offset +
                    lookupListOffset +
                    lookupTables[i] +
                    subTableOffsets[j] +
                    extensionOffset +
                    coverageOffset,
                  () => {
                    const coverageFormat = reader.getUint16();
                    return parseCoverage(reader, coverageFormat);
                  }
                );

                const classDef1 = reader.runAt(
                  offset +
                    lookupListOffset +
                    lookupTables[i] +
                    subTableOffsets[j] +
                    extensionOffset +
                    classDef1Offset,
                  () => {
                    return parseClassDef(reader);
                  }
                );

                const classDef2 = reader.runAt(
                  offset +
                    lookupListOffset +
                    lookupTables[i] +
                    subTableOffsets[j] +
                    extensionOffset +
                    classDef2Offset,
                  () => {
                    return parseClassDef(reader);
                  }
                );

                const classRecords: Array<
                  Array<{
                    value1?: ValueRecord;
                    value2?: ValueRecord;
                  }>
                > = [];

                for (let k = 0; k < class1Count; k++) {
                  const class1Record: (typeof classRecords)[number] = [];
                  for (let l = 0; l < class2Count; l++) {
                    const class2Record: (typeof class1Record)[number] = {};
                    const value1 = getValueRecord(reader, valueFormat1);
                    const value2 = getValueRecord(reader, valueFormat2);

                    if (value1) {
                      class2Record.value1 = value1;
                    }

                    if (value2) {
                      class2Record.value2 = value2;
                    }

                    class1Record.push(class2Record);
                  }
                  classRecords.push(class1Record);
                }

                extension = {
                  ...extension,
                  valueFormat1: valueFormat1,
                  valueFormat2: valueFormat2,
                  classDef1,
                  classDef2,
                  classRecords,
                } as ExtensionLookupType2Format2;
              } else {
                console.warn(
                  "Only Pair Adjustment lookup format 1 and 2 are supported."
                );
              }
            }
          }
        );

        lookup.subtables.push({
          posFormat,
          extensionLookupType,
          extension,
        });
      }
    } else {
      console.warn("Only Extension Positioning lookup type is supported.");
    }

    lookups.push(lookup);
  }

  return {
    features,
    lookups,
  };
}
function getValueRecord(
  reader: BinaryReader,
  valueRecord: number
): ValueRecord | undefined {
  const result: ValueRecord = {};

  if (valueRecord & 0x0001) {
    result.xPlacement = reader.getInt16();
  }

  if (valueRecord & 0x0002) {
    result.yPlacement = reader.getInt16();
  }

  if (valueRecord & 0x0004) {
    result.xAdvance = reader.getInt16();
  }

  if (valueRecord & 0x0008) {
    result.yAdvance = reader.getInt16();
  }

  if (valueRecord & 0x0010) {
    result.xPlaDevice = reader.getInt16();
  }

  if (valueRecord & 0x0020) {
    result.yPlaDevice = reader.getInt16();
  }

  if (valueRecord & 0x0040) {
    result.xAdvDevice = reader.getInt16();
  }

  if (valueRecord & 0x0080) {
    result.yAdvDevice = reader.getInt16();
  }

  if (Object.keys(result).length === 0) {
    return undefined;
  }

  return result;
}
function parseCoverage(
  reader: BinaryReader,
  coverageFormat: number
): CoverageTableFormat1 | CoverageTableFormat2 {
  if (coverageFormat === 2) {
    const rangeCount = reader.getUint16();
    const rangeRecords = [];
    for (let i = 0; i < rangeCount; i++) {
      rangeRecords.push({
        startGlyphID: reader.getUint16(),
        endGlyphID: reader.getUint16(),
        startCoverageIndex: reader.getUint16(),
      });
    }
    return {
      coverageFormat,
      rangeRecords,
    };
  } else {
    throw new Error("Only Coverage Table format 2 is supported as of now.");
  }
}

function parseClassDef(reader: BinaryReader) {
  const format = reader.getUint16();

  if (format === 1) {
    const startGlyph = reader.getUint16();
    const glyphCount = reader.getUint16();
    const glyphs = [];
    for (let k = 0; k < glyphCount; k++) {
      glyphs.push(reader.getUint16());
    }

    return {
      format,
      startGlyph,
      classes: glyphs,
    } as ClassDefFormat1;
  } else if (format === 2) {
    const rangeCount = reader.getUint16();
    const ranges = [];

    for (let k = 0; k < rangeCount; k++) {
      ranges.push({
        startGlyphID: reader.getUint16(),
        endGlyphID: reader.getUint16(),
        class: reader.getUint16(),
      });
    }

    return {
      format,
      ranges,
    } as ClassDefFormat2;
  } else {
    throw new Error(`Unsupported ClassDef format ${format}.`);
  }
}
