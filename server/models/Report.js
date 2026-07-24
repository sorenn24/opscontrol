const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  turno: {
    type: String,
    enum: ['T1', 'T2'],
    required: true,
  },
  // Fecha en formato "YYYY-MM-DD" para facilitar consultas por día
  dateKey: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
  },
  // Mapa de taskId → boolean (true = completada)
  tasks: {
    type: Map,
    of: Boolean,
    default: {},
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Índice compuesto: un solo reporte por usuario+turno+día
// Si el líder reenvía el mismo turno del mismo día, se actualiza
ReportSchema.index({ userId: 1, turno: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model('Report', ReportSchema);
