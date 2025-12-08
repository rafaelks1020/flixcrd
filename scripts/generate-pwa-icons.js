const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outputDir = path.join(__dirname, '../public/icons');

// Criar diretório se não existir
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
  for (const size of sizes) {
    // Criar SVG com o ícone
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#000000"/>
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#e50914"/>
            <stop offset="100%" style="stop-color:#b20710"/>
          </linearGradient>
        </defs>
        <circle cx="${size/2}" cy="${size/2}" r="${size*0.35}" fill="url(#grad)"/>
        <text x="${size/2}" y="${size/2 + size*0.12}" 
              font-family="Arial, sans-serif" 
              font-size="${size*0.4}" 
              font-weight="bold" 
              fill="white" 
              text-anchor="middle">P</text>
      </svg>
    `;
    
    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(outputDir, `icon-${size}.png`));
    
    console.log(`Generated icon-${size}.png`);
  }
  console.log('All icons generated!');
}

generateIcons().catch(console.error);
