import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import axios from "axios";
import cors from "cors";
import {
  garantirIndicesPosVenda,
  PosVenda,
} from "./src/models/PosVenda.js";
import { persistirAvaliacao } from "./src/services/avaliacaoService.js";

const app = express();

//Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

//Config mongoDB
let urlConnection =
  process.env.NODE_ENV === "development"
    ? process.env.MONGO_URL_DEV
    : process.env.MONGO_URL;

let connectionPromise;

async function main() {
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(urlConnection)
      .then(async (connection) => {
        await garantirIndicesPosVenda();
        return connection;
      })
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }
  return connectionPromise;
}

//Routes
app.post("/", async (req, res) => {
  const recebidoEm = new Date();
  let avaliacaoVendedora = "MEDIANO";
  let avaliacaoTecnico = "MEDIANO";
  let comentarios = "Não informado";
  let descontoCliente = 0;
  let vendedora = "Não informado";
  let tecnico = "Não informado";
  let codigoCliente;
  try {
    await main();
    const addedLeads = req.body?.leads?.add;

    const myLead = addedLeads?.[0];
    if (!myLead?.id) {
      return res.status(400).json({
        status: "webhook_invalido",
        mensagem: "O webhook não contém um lead válido.",
      });
    }

    const kommoUrl = `https://superzon.kommo.com/api/v4/leads/${myLead.id}?with=custom_fields,contacts`;

    const responseKommo = await axios.get(kommoUrl, {
      headers: {
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
      },
    });

    const completeData = responseKommo.data;

    const clientName = completeData.name || "Cliente sem nome";
    const customFields = completeData.custom_fields_values || [];

    for (const field of customFields) {
      switch (field.field_id) {
        case 1021282:
          avaliacaoVendedora = field.values[0].value || "Não informado";
          break;
        case 1021284:
          avaliacaoTecnico = field.values[0].value || "Não informado";
          break;
        case 1022770:
          comentarios = field.values[0].value || "Não informado";
          break;
        case 1043267:
          descontoCliente = field.values[0].value || "Não informado";
          break;
        case 1034337:
          vendedora = field.values[0].value || "Não informado";
          break;
        case 1034335:
          tecnico = field.values[0].value || "Não informado";
          break;
        case 888160:
          codigoCliente = field.values[0].value || "Não informado";
          break;

        default:
          console.log(`Nenhum campo personalizado previsto encontrado.`);
      }
    }

    const processarAvaliacao = (textoOriginal) => {
      if (!textoOriginal || textoOriginal === "Não informado") {
        return { texto: "Não informado", nota: null };
      }

      const textoLimpo = String(textoOriginal)
        .replace(/[^\w\s]/gi, "")
        .trim()
        .toUpperCase();
      const dicionario = {
        RUIM: 1,
        MEDIANO: 3,
        EXCELENTE: 5,
      };

      if (dicionario[textoLimpo] !== undefined) {
        return {
          texto: textoLimpo,
          nota: dicionario[textoLimpo],
        };
      }
      return {
        texto: textoOriginal,
        nota: null,
      };
    };

    const resultadoVendedora = processarAvaliacao(avaliacaoVendedora);
    const resultadoTecnico = processarAvaliacao(avaliacaoTecnico);

    const resultadoPersistencia = await persistirAvaliacao(PosVenda, {
      cliente_nome: clientName,
      vendedora_nome: vendedora,
      vendedora_avaliacao: resultadoVendedora.texto,
      vendedora_nota: resultadoVendedora.nota,
      tecnico_nome: tecnico,
      tecnico_avaliacao: resultadoTecnico.texto,
      tecnico_nota: resultadoTecnico.nota,
      desconto: Number(descontoCliente) || 0,
      comentario: comentarios,
      codigo_cliente: codigoCliente,
      kommo_lead_id: String(myLead.id),
    }, recebidoEm);

    if (resultadoPersistencia.duplicado) {
      return res.status(200).json({
        status: "duplicado_ignorado",
        mensagem: "A avaliação já foi persistida para este cliente neste minuto.",
        avaliacao_minuto: resultadoPersistencia.avaliacaoMinuto,
      });
    }

    return res.status(200).json({
      status: "inserido",
      mensagem: "Lead processado e salvo no banco com sucesso.",
      registro_id: resultadoPersistencia.registroId,
      avaliacao_minuto: resultadoPersistencia.avaliacaoMinuto,
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json("Erro interno na API.");
  }
});

app.get("/dashboard", async (req, res) => {
  try {
    await main();

    const dadosGraficos = await PosVenda.aggregate([
      {
        $facet: {
          resumo_tecnicos: [
            {
              $group: {
                _id: "$tecnico_nome",
                quantidade_avaliacoes: { $sum: 1 },
                media_avaliacao: { $avg: "$tecnico_nota" },
              },
            },
            {
              $project: {
                nome: "$_id",
                quantidade_avaliacoes: 1,
                media_avaliacao: {
                  $round: [{ $ifNull: ["$media_avaliacao", 0] }, 2],
                },
                _id: 0,
              },
            },
            {
              $sort: { quantidade_avaliacoes: -1 },
            },
          ],
          resumo_vendedoras: [
            {
              $group: {
                _id: "$vendedora_nome",
                quantidade_avaliacoes: { $sum: 1 },
                media_avaliacao: { $avg: "$vendedora_nota" },
              },
            },
            {
              $project: {
                nome: "$_id",
                quantidade_avaliacoes: 1,
                media_avaliacao: {
                  $round: [{ $ifNull: ["$media_avaliacao", 0] }, 2],
                },
                _id: 0,
              },
            },
            { $sort: { quantidade_avaliacoes: -1 } },
          ],
        },
      },
    ]);

    res.status(200).json(dadosGraficos[0]);
  } catch (error) {
    console.error("Erro ao gerar dados do dashboard:", error);
    res.status(500).json({
      erro: "Erro interno ao tentar processar os dados para o dashboard.",
    });
  }
});

app.get("/avaliacoes", async (req, res) => {
  try {
    await main();

    const todasAvaliacoes = await PosVenda.find().sort({ createdAt: -1 });

    res.status(200).json(todasAvaliacoes);
  } catch (error) {
    console.error(error.message);
    res
      .status(500)
      .json({ erro: "Falha na busca das avaliações no banco de dados." });
  }
});

//Init Server
const PORT = process.env.PORT;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    main().catch((err) => console.error(err));
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

export default app;
