import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot, type ApiSheet } from "./sheet-grid.ts";

const gold = { red: 0.992, green: 0.714, blue: 0 };
const sheet: ApiSheet = {
  properties: { sheetId: 157140433, title: "Master Report", gridProperties: { frozenRowCount: 3, frozenColumnCount: 2 } },
  merges: [{ startRowIndex: 0, endRowIndex: 1, startColumnIndex: 2, endColumnIndex: 7 }],
  data: [
    {
      columnMetadata: [{ pixelSize: 220 }, { pixelSize: 160 }, {}, {}, {}, {}, {}, {}, {}],
      rowMetadata: [{ pixelSize: 30 }],
      rowData: [
        { values: [{ formattedValue: "Master Report", effectiveFormat: { textFormat: { bold: true, fontSize: 14 } } }, {}, { formattedValue: "Aug-26", effectiveValue: { numberValue: 46235 }, effectiveFormat: { backgroundColor: gold, horizontalAlignment: "CENTER" } }] },
        { values: [{}, {}, { formattedValue: "W1" }, { formattedValue: "W2" }, {}, {}, {}, { formattedValue: "Monthly Total" }] },
        { values: [{ formattedValue: "w/c Sunday dates" }, {}, { formattedValue: "2", effectiveValue: { numberValue: 2 } }] },
        {
          values: [
            { formattedValue: "Paid Search" },
            { formattedValue: "CTR" },
            { formattedValue: "14.4%", effectiveValue: { numberValue: 0.1439 } },
            {},
            {},
            {},
            {},
            { formattedValue: "66.1%", effectiveValue: { numberValue: 0.6606 }, effectiveFormat: { borders: { left: { style: "SOLID_MEDIUM", color: {} } } } },
          ],
        },
        // Trailing rows with formatting only are trimmed.
        { values: [{ effectiveFormat: { backgroundColor: gold } }] },
        { values: [{ effectiveFormat: { backgroundColor: gold } }] },
      ],
    },
  ],
};

test("keeps displayed values, fonts, fills, alignment and borders", () => {
  const s = buildSnapshot(sheet);
  assert.equal(s.title, "Master Report");
  assert.equal(s.rows[0][0].t, "Master Report");
  assert.deepEqual(s.styles[s.rows[0][0].s!], { bold: true, size: 14 });
  assert.deepEqual(s.styles[s.rows[0][2].s!], { bg: "#fdb600", align: "center" });
  assert.equal(s.styles[s.rows[3][7].s!].bl, "2px solid #000000");
  assert.equal(s.rows[3][2].n, true);
});

test("keeps merges, widths, heights and frozen panes; trims empty space", () => {
  const s = buildSnapshot(sheet);
  assert.deepEqual(s.merges, [{ r: 0, c: 2, rs: 1, cs: 5 }]);
  assert.equal(s.colWidths[0], 220);
  assert.equal(s.colWidths[2], 100);
  assert.equal(s.rowHeights[0], 30);
  assert.equal(s.frozenRows, 3);
  assert.equal(s.frozenCols, 2);
  assert.equal(s.rows[0].length, 8);
  assert.ok(s.rows.length <= 5, "trailing formatted-only rows trimmed");
});

test("flags Monthly Total ratio cells that add up weekly ratios", () => {
  const s = buildSnapshot(sheet);
  assert.match(s.rows[3][7].flag ?? "", /adds up the weekly/);
  assert.equal(s.rows[3][2].flag, undefined);
});
