import test from "node:test";
import assert from "node:assert/strict";
import { PosVenda } from "../src/models/PosVenda.js";

test("declara índice único parcial para a chave de deduplicação", () => {
  const index = PosVenda.schema.indexes().find(
    ([campos]) => campos.dedupe_key === 1,
  );

  assert.ok(index);
  assert.equal(index[1].unique, true);
  assert.deepEqual(index[1].partialFilterExpression, {
    dedupe_key: { $type: "string" },
  });
});
