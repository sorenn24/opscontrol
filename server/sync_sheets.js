const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const VentaExtraordinaria = require('./models/VentaExtraordinaria');

async function sync() {
  try {
    if (!process.env.MONGODB_URI) {
      console.log('Falta MONGODB_URI en server/.env');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a la BD.');

    const ventas = await VentaExtraordinaria.find({}).sort({ createdAt: 1 });
    console.log(`Encontradas ${ventas.length} ventas. Comenzando envío...`);

    const webhookUrl = 'https://script.google.com/macros/s/AKfycbywfvMgKaYfKnoBuk6Rs4xshWLrvsstDaGh_PqyzC-tIInBhRpasdfOf4i74-x7sCKP/exec';
    const baseUrl = 'https://opscontrol.onrender.com';

    let successCount = 0;

    for (let i = 0; i < ventas.length; i++) {
      const v = ventas[i];
      const sheetData = {
        fecha_ticket: v.fecha_ticket || '',
        sucursal: v.sucursal || '',
        turno: v.turno || '',
        empleado: `${v.empleado_nombre} ${v.empleado_apellido}`.trim(),
        monto: v.monto || 0,
        foto_url: `${baseUrl}/api/ventas/${v._id}/image`,
        fecha_registro: new Date(v.createdAt).toLocaleString('es-MX')
      };

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sheetData)
        });
        
        if (response.ok) {
          successCount++;
        }
      } catch (err) {
        console.error(`Error enviando ticket de ${v.empleado_nombre}:`, err.message);
      }
      
      // Esperar medio segundo entre peticiones para no saturar a Google Sheets
      await new Promise(r => setTimeout(r, 500));
      
      if (i % 10 === 0 && i > 0) console.log(`Progreso: ${i} / ${ventas.length}...`);
    }

    console.log(`\n¡Sincronización Completada! ${successCount} ventas enviadas a Sheets.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

sync();
