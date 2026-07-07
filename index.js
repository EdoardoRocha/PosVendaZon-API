import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import { Schema } from "mongoose";
import axios from "axios";

const app = express();

//Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Config mongoDB
let urlConnection =
  process.env.NODE_ENV === "development"
    ? process.env.MONGO_URL_DEV
    : process.env.MONGO_URL;

async function main() {
  await mongoose.connect(urlConnection);
  console.log("Mongo conectado.");
}

// Models
const PosVendaSchema = mongoose.model(
  "PosVenda",
  new Schema(
    {
      cliente_nome: {
        type: String,
        required: true,
      },
      vendedora_nome: {
        type: String,
        required: true,
      },
      vendedora_avaliacao: {
        type: String,
        enum: ["RUIM", "MEDIANO", "EXCELENTE"],
      },
      vendedora_nota: {
        type: Number,
        required: true,
      },
      tecnico_nome: {
        type: String,
        required: true,
      },
      tecnico_avaliacao: {
        type: String,
        enum: ["RUIM", "MEDIANO", "EXCELENTE"],
      },
      tecnico_nota: {
        type: Number,
        required: true,
      },
      desconto: {
        type: Number,
        default: 0,
      },
      comentario: {
        type: String,
      },
    },
    {
      timestamps: true,
    },
  ),
);

//Routes
app.post("/", async (req, res) => {
  let avaliacaoVendedora = "MEDIANO";
  let avaliacaoTecnico = "MEDIANO";
  let comentarios = "Não informado";
  let descontoCliente = 0;
  let vendedora = "Não informado";
  let tecnico = "Não informado";
  try {
    await main().catch((err) => console.error(err));
    const addedLeads = req.body.leads.add;

    const myLead = addedLeads[0];

    console.log("ID do lead:", myLead.id);
    console.log(JSON.stringify(req.body, null, 2));

    const kommoUrl = `https://superzon.kommo.com/api/v4/leads/${myLead.id}?with=custom_fields,contacts`;

    const responseKommo = await axios.get(kommoUrl, {
      headers: {
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
      },
    });

    const completeData = responseKommo.data;

    const clientName = completeData.name || "Cliente sem nome";
    const customFields = completeData.custom_fields_values || [];

    console.log(
      "Campos personalizados: " +
        JSON.stringify(customFields || "Nenhum campo preenchido", null, 2),
    );

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

        default:
          console.log(`Nenhum campo personalizado previsto encontrado.`);
      }
    }

    const conversorDeNotas = {
      RUIM: 1,
      MEDIANO: 3,
      EXCELENTE: 5,
    };

    const limparTexto = (texto) =>
      texto
        .replace(/[^\w\s]/gi, "")
        .trim()
        .toUpperCase();

    const avaliacaoVendedoraLimpa = limparTexto(avaliacaoVendedora);
    const avaliacaoTecnicoLimpa = limparTexto(avaliacaoTecnico);

    const notaVendedoraFormatada =
      conversorDeNotas[avaliacaoVendedoraLimpa] || 3;
    const notaTecnicoFormatada = conversorDeNotas[avaliacaoTecnicoLimpa] || 3;

    const novaAvaliacao = new PosVendaSchema({
      cliente_nome: nomeCliente,
      vendedora_nome: vendedora,
      vendedora_avaliacao: avaliacaoVendedoraLimpa,
      vendedora_nota: notaVendedoraFormatada,
      tecnico_nome: tecnico,
      tecnico_avaliacao: avaliacaoTecnicoLimpa,
      tecnico_nota: notaTecnicoFormatada,
      desconto: Number(descontoCliente) || 0,
      comentario: comentarios,
    });

    await novaAvaliacao.save();
    console.log(
      `Avaliação do cliente ${nomeCliente} salva no banco com sucesso!`,
    );

    res.status(200).json("Lead processado e salvo no banco com sucesso");
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json("Erro interno na API.");
  }
});
// app.get("/", async (req, res) => {});

//Init Server

const PORT = process.env.PORT;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    main().catch((err) => console.error(err));
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

export default app;
