import { createHash } from "node:crypto";

export function normalizarNomeCliente(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("pt-BR");
}

export function normalizarDataHoraMinuto(valor = new Date()) {
  const data = valor instanceof Date
    ? new Date(valor.getTime())
    : new Date(valor);

  if (Number.isNaN(data.getTime())) {
    throw new Error("Data e hora da avaliação são inválidas");
  }

  data.setSeconds(0, 0);
  return data;
}

export function criarIdentidadeAvaliacao(nome, dataHora = new Date()) {
  const clienteNomeNormalizado = normalizarNomeCliente(nome);
  if (!clienteNomeNormalizado) {
    throw new Error("Nome do cliente é obrigatório para verificar duplicidade");
  }

  const avaliacaoMinuto = normalizarDataHoraMinuto(dataHora);
  const origem = `${clienteNomeNormalizado}|${avaliacaoMinuto.toISOString()}`;
  const dedupeKey = createHash("sha256").update(origem).digest("hex");

  return {
    clienteNomeNormalizado,
    avaliacaoMinuto,
    dedupeKey,
  };
}
