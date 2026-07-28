import test from "node:test";
import assert from "node:assert/strict";
import {
  criarIdentidadeAvaliacao,
  normalizarDataHoraMinuto,
  normalizarNomeCliente,
} from "../src/utils/deduplicacao.js";

test("normaliza caixa, acentos e espaços do nome", () => {
  assert.equal(
    normalizarNomeCliente("  Mária   Liduína  "),
    "MARIA LIDUINA",
  );
});

test("normaliza a data e hora até o minuto", () => {
  assert.equal(
    normalizarDataHoraMinuto("2026-07-27T16:42:59.999Z").toISOString(),
    "2026-07-27T16:42:00.000Z",
  );
});

test("gera a mesma chave para o mesmo nome no mesmo minuto", () => {
  const primeira = criarIdentidadeAvaliacao(
    "Maria Liduína",
    "2026-07-27T16:42:02.000Z",
  );
  const segunda = criarIdentidadeAvaliacao(
    "  MARIA   LIDUINA ",
    "2026-07-27T16:42:58.000Z",
  );

  assert.equal(primeira.dedupeKey, segunda.dedupeKey);
});

test("gera chaves diferentes em minutos diferentes", () => {
  const primeira = criarIdentidadeAvaliacao(
    "Maria Liduína",
    "2026-07-27T16:42:59.000Z",
  );
  const segunda = criarIdentidadeAvaliacao(
    "Maria Liduína",
    "2026-07-27T16:43:00.000Z",
  );

  assert.notEqual(primeira.dedupeKey, segunda.dedupeKey);
});

test("rejeita identidade sem nome", () => {
  assert.throws(
    () => criarIdentidadeAvaliacao("  ", new Date()),
    /nome do cliente é obrigatório/i,
  );
});
