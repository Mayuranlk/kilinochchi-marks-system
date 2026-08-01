"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { readCollectionInPages } = require("../lib/firestoreAuditReader");

function fakeFirestore(rows) {
  return {
    collection(name) {
      assert.equal(name, "marks");
      let cursor = "";
      let pageLimit = 100;
      const builder = {
        orderBy() { return builder; },
        limit(value) { pageLimit = value; return builder; },
        startAfter(value) { cursor = value; return builder; },
        async get() {
          const start = cursor ? rows.findIndex((row) => row.id === cursor) + 1 : 0;
          const page = rows.slice(start, start + pageLimit);
          return {
            empty: page.length === 0,
            size: page.length,
            docs: page.map(({ id, ...data }) => ({ id, data: () => data })),
          };
        },
      };
      return builder;
    },
  };
}

test("reader uses cursor pages and obeys the hard maximum", async () => {
  const pages = [];
  const result = await readCollectionInPages({
    db: fakeFirestore([
      { id: "m1", mark: 10 },
      { id: "m2", mark: 20 },
      { id: "m3", mark: 30 },
      { id: "m4", mark: 40 },
    ]),
    collectionName: "marks",
    batchSize: 2,
    maximumDocuments: 3,
    startCursor: "",
    shouldStop: () => false,
    onPage: ({ page }) => pages.push(page.map((row) => row.id)),
  });
  assert.deepEqual(pages, [["m1", "m2"], ["m3"]]);
  assert.deepEqual(result.documents.map((row) => row.id), ["m1", "m2", "m3"]);
  assert.equal(result.cursor, "m3");
  assert.equal(result.complete, false);
});

test("reader resumes strictly after the supplied cursor", async () => {
  const result = await readCollectionInPages({
    db: fakeFirestore([{ id: "m1" }, { id: "m2" }, { id: "m3" }]),
    collectionName: "marks",
    batchSize: 10,
    maximumDocuments: 10,
    startCursor: "m1",
    shouldStop: () => false,
  });
  assert.deepEqual(result.documents.map((row) => row.id), ["m2", "m3"]);
  assert.equal(result.complete, true);
});
