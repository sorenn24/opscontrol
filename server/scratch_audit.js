const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' }); 

const VentaExtraordinariaSchema = new mongoose.Schema({
  foto_base64: String
}, { strict: false });

const Venta = mongoose.model('VentaExtraordinaria', VentaExtraordinariaSchema, 'ventaextraordinarias');

async function audit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    const ventas = await Venta.find({}).select('foto_base64');
    
    let totalSize = 0;
    let maxSize = 0;
    let countWithImages = 0;
    
    ventas.forEach(v => {
      if (v.foto_base64) {
        countWithImages++;
        const size = Buffer.byteLength(v.foto_base64, 'utf8'); // string size
        totalSize += size;
        if (size > maxSize) maxSize = size;
      }
    });
    
    console.log('--- STATS ---');
    console.log(`Total Ventas: ${ventas.length}`);
    console.log(`Ventas with images: ${countWithImages}`);
    console.log(`Total size of all images (Base64 String size): ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    if (countWithImages > 0) {
      console.log(`Average size per image: ${(totalSize / countWithImages / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Max size of an image: ${(maxSize / 1024 / 1024).toFixed(2)} MB`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

audit();
