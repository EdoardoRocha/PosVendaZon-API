import { criarIdentidadeAvaliacao } from "../utils/deduplicacao.js";

export async function persistirAvaliacao(
  Model,
  dados,
  dataHoraRecebimento = new Date(),
) {
  const identidade = criarIdentidadeAvaliacao(
    dados.cliente_nome,
    dataHoraRecebimento,
  );

  const documento = {
    ...dados,
    cliente_nome: String(dados.cliente_nome).replace(/\s+/g, " ").trim(),
    cliente_nome_normalizado: identidade.clienteNomeNormalizado,
    avaliacao_minuto: identidade.avaliacaoMinuto,
    dedupe_key: identidade.dedupeKey,
  };

  try {
    const resultado = await Model.updateOne(
      { dedupe_key: identidade.dedupeKey },
      { $setOnInsert: documento },
      {
        upsert: true,
        runValidators: true,
      },
    );

    const inserido = Number(resultado.upsertedCount || 0) === 1;
    return {
      status: inserido ? "inserido" : "duplicado_ignorado",
      inserido,
      duplicado: !inserido,
      registroId: resultado.upsertedId || null,
      dedupeKey: identidade.dedupeKey,
      avaliacaoMinuto: identidade.avaliacaoMinuto,
    };
  } catch (error) {
    if (error?.code === 11000) {
      return {
        status: "duplicado_ignorado",
        inserido: false,
        duplicado: true,
        registroId: null,
        dedupeKey: identidade.dedupeKey,
        avaliacaoMinuto: identidade.avaliacaoMinuto,
      };
    }
    throw error;
  }
}
