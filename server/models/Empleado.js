const mongoose = require('mongoose');

const EmpleadoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  sucursal_origen: {
    type: String,
    required: true,
    enum: ['ORD', 'CUA'],
  },
  activo: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

EmpleadoSchema.index({ sucursal_origen: 1, activo: 1 });

module.exports = mongoose.model('Empleado', EmpleadoSchema);
