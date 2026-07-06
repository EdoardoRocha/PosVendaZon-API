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
  try {
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

    console.log(
      "Campos personalizados: " +
        JSON.stringify(
          completeData.custom_fields_values || "Nenhum campo preenchido",
          null,
          2,
        ),
    );

    console.log(JSON.stringify(completeData, null, 2));

    res.status(200).json("Lead processado com sucesso");
  } catch (error) {
    console.error(error.response?.data || error.message);
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
