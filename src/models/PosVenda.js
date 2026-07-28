import mongoose, { Schema } from "mongoose";

const PosVendaSchema = new Schema(
  {
    cliente_nome: {
      type: String,
      required: true,
    },
    cliente_nome_normalizado: {
      type: String,
    },
    avaliacao_minuto: {
      type: Date,
    },
    dedupe_key: {
      type: String,
    },
    kommo_lead_id: {
      type: String,
    },
    vendedora_nome: {
      type: String,
      required: true,
    },
    vendedora_avaliacao: {
      type: String,
    },
    vendedora_nota: {
      type: Number,
      default: null,
    },
    tecnico_nome: {
      type: String,
      required: true,
    },
    tecnico_avaliacao: {
      type: String,
    },
    tecnico_nota: {
      type: Number,
      default: null,
    },
    desconto: {
      type: Number,
      default: 0,
    },
    comentario: {
      type: String,
    },
    codigo_cliente: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

PosVendaSchema.index(
  { dedupe_key: 1 },
  {
    unique: true,
    partialFilterExpression: {
      dedupe_key: { $type: "string" },
    },
    name: "avaliacao_dedupe_key_unique",
  },
);

export const PosVenda = mongoose.models.PosVenda
  || mongoose.model("PosVenda", PosVendaSchema);

export async function garantirIndicesPosVenda() {
  await PosVenda.createIndexes();
}
