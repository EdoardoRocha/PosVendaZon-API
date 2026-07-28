import test from "node:test";
import assert from "node:assert/strict";
import { persistirAvaliacao } from "../src/services/avaliacaoService.js";

const dados = {
  cliente_nome: "  Maria   Liduína ",
  vendedora_nome: "Neusa",
  tecnico_nome: "Edvando",
};

test("insere a primeira avaliação com os campos de deduplicação", async () => {
  let operacao;
  const Model = {
    async updateOne(filtro, atualizacao, opcoes) {
      operacao = { filtro, atualizacao, opcoes };
      return { upsertedCount: 1, upsertedId: "novo-id" };
    },
  };

  const resultado = await persistirAvaliacao(
    Model,
    dados,
    "2026-07-27T16:42:30.000Z",
  );

  assert.equal(resultado.status, "inserido");
  assert.equal(resultado.registroId, "novo-id");
  assert.equal(
    operacao.atualizacao.$setOnInsert.cliente_nome,
    "Maria Liduína",
  );
  assert.equal(
    operacao.atualizacao.$setOnInsert.cliente_nome_normalizado,
    "MARIA LIDUINA",
  );
  assert.equal(
    operacao.atualizacao.$setOnInsert.avaliacao_minuto.toISOString(),
    "2026-07-27T16:42:00.000Z",
  );
  assert.equal(operacao.opcoes.upsert, true);
  assert.equal(operacao.opcoes.runValidators, true);
});

test("ignora a avaliação quando o upsert encontra a mesma chave", async () => {
  const Model = {
    async updateOne() {
      return { upsertedCount: 0, upsertedId: null };
    },
  };

  const resultado = await persistirAvaliacao(
    Model,
    dados,
    "2026-07-27T16:42:50.000Z",
  );

  assert.equal(resultado.status, "duplicado_ignorado");
  assert.equal(resultado.duplicado, true);
});

test("trata colisão simultânea do índice único como duplicidade", async () => {
  const Model = {
    async updateOne() {
      const error = new Error("duplicate key");
      error.code = 11000;
      throw error;
    },
  };

  const resultado = await persistirAvaliacao(
    Model,
    dados,
    "2026-07-27T16:42:50.000Z",
  );

  assert.equal(resultado.status, "duplicado_ignorado");
  assert.equal(resultado.duplicado, true);
});
