const mongoose = require('mongoose');

const EmpleadoAsignadoSchema = new mongoose.Schema({
  empleado_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Empleado',
  },
  nombre: {
    type: String,
    required: true,
  },
  sucursal_origen: {
    type: String,
    required: true,
  },
  es_cubrimiento: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

const DiaAsignacionSchema = new mongoose.Schema({
  dia: {
    type: String,
    required: true,
  },
  fecha: {
    type: String,
  },
  t1: [EmpleadoAsignadoSchema],
  t2: [EmpleadoAsignadoSchema],
  t3: [EmpleadoAsignadoSchema],
}, { _id: false });

const HorarioSchema = new mongoose.Schema({
  weekKey: {
    type: String,
    required: true,
  },
  semana_label: {
    type: String,
    required: true,
  },
  sucursal: {
    type: String,
    required: true,
    enum: ['ORD', 'CUA'],
  },
  asignaciones: [DiaAsignacionSchema],
}, {
  timestamps: true,
});

HorarioSchema.index({ weekKey: 1, sucursal: 1 }, { unique: true });

module.exports = mongoose.model('Horario', HorarioSchema);
