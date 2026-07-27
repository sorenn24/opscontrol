const mongoose = require('mongoose');

const TurnoDataSchema = new mongoose.Schema({
  reportado:   { type: Number, default: 0 },
  justificado: { type: Number, default: 0 },
  faltante:    { type: Number, default: 0 },
}, { _id: false });

const TicketI24Schema = new mongoose.Schema({
  dateKey: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
    index: true,
  },
  sucursal: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  leaderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  leaderName: {
    type: String,
    required: true,
  },
  tiene_tickets: {
    type: Boolean,
    default: true,
  },
  t1: { type: TurnoDataSchema, default: () => ({}) },
  t2: { type: TurnoDataSchema, default: () => ({}) },
  t3: { type: TurnoDataSchema, default: () => ({}) },
  tiene_nota: {
    type: Boolean,
    default: false,
  },
  nota_texto: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

// Índice compuesto: solo un registro por sucursal por día
TicketI24Schema.index({ dateKey: 1, sucursal: 1 }, { unique: true });

module.exports = mongoose.model('TicketI24', TicketI24Schema);
