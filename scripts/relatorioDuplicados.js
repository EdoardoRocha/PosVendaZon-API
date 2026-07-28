import "dotenv/config";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import {
  normalizarDataHoraMinuto,
  normalizarNomeCliente,
} from "../src/utils/deduplicacao.js";

const urlConnection = process.env.NODE_ENV === "development"
  ? process.env.MONGO_URL_DEV
  : process.env.MONGO_URL;

async function gerarRelatorio() {
  if (!urlConnection) {
    throw new Error("A URL de conexão do MongoDB não está configurada");
  }

  await mongoose.connect(urlConnection, { autoIndex: false });
  const collection = mongoose.connection.collection("posvendas");
  const grupos = new Map();
  let analisados = 0;
  let ignoradosSemDados = 0;

  const cursor = collection.find(
    {},
    {
      projection: {
        cliente_nome: 1,
        codigo_cliente: 1,
        createdAt: 1,
      },
    },
  );

  for await (const documento of cursor) {
    const nome = normalizarNomeCliente(documento.cliente_nome);
    if (!nome || !documento.createdAt) {
      ignoradosSemDados += 1;
      continue;
    }

    analisados += 1;
    const minuto = normalizarDataHoraMinuto(documento.createdAt);
    const chave = `${nome}|${minuto.toISOString()}`;
    const registros = grupos.get(chave) || [];
    registros.push({
      id: String(documento._id),
      cliente_nome: documento.cliente_nome,
      codigo_cliente: documento.codigo_cliente || null,
      createdAt: documento.createdAt,
    });
    grupos.set(chave, registros);
  }

  const duplicidades = [...grupos.entries()]
    .filter(([, registros]) => registros.length > 1)
    .map(([chave, registros]) => ({
      chave,
      quantidade: registros.length,
      manter: registros[0],
      candidatosDuplicados: registros.slice(1),
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const relatorio = {
    geradoEm: new Date().toISOString(),
    criterio: "nome normalizado + data/hora até o minuto",
    resumo: {
      registrosAnalisados: analisados,
      registrosIgnoradosSemNomeOuData: ignoradosSemDados,
      gruposDuplicados: duplicidades.length,
      registrosExcedentes: duplicidades.reduce(
        (total, grupo) => total + grupo.quantidade - 1,
        0,
      ),
    },
    duplicidades,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.resolve(
    process.cwd(),
    `relatorio-duplicados-${timestamp}.json`,
  );
  await writeFile(outputPath, JSON.stringify(relatorio, null, 2), "utf8");
  console.log(JSON.stringify({ arquivo: outputPath, ...relatorio.resumo }, null, 2));
}

gerarRelatorio()
  .catch((error) => {
    console.error("Falha ao gerar relatório:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
