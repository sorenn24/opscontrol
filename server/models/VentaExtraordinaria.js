const mongoose = require('mongoose');

const VentaExtraordinariaSchema = new mongoose.Schema({
  fecha_ticket: {
    type: String,
    required: true,
  },
  sucursal: {
    type: String,
    required: true,
  },
  turno: {
    type: String,
    required: true,
    enum: ['T1', 'T2', 'T3'],
  },
  empleado_nombre: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  empleado_apellido: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  monto: {
    type: Number,
    required: true,
    min: 0, // We will validate 300 on the frontend, but let's allow it in DB just in case.
  },
  foto_base64: {
    type: String,
    required: true,
  },
  estado_validacion: {
    type: String,
    enum: ['PENDIENTE', 'VALIDADO', 'RECHAZADO'],
    default: 'PENDIENTE',
  },
}, {
  timestamps: true,
});

VentaExtraordinariaSchema.index({ fecha_ticket: -1, sucursal: 1 });
VentaExtraordinariaSchema.index({ estado_validacion: 1 });

module.exports = mongoose.model('VentaExtraordinaria', VentaExtraordinariaSchema);
