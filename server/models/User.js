const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  role: {
    type: String,
    enum: ['leader', 'admin'],
    default: 'leader',
  },
  pin: {
    type: String,
    required: true,
    minlength: 4,
    maxlength: 10,
  },
  active: {
    type: Boolean,
    default: true,
  },
  branches: {
    type: [String],
    default: [],
  },
}, {
  timestamps: true,
});

// No exponer el PIN en las respuestas JSON por defecto
UserSchema.methods.toPublic = function () {
  return {
    id:       this._id.toString(),
    name:     this.name,
    role:     this.role,
    branches: this.branches || [],
  };
};

module.exports = mongoose.model('User', UserSchema);
