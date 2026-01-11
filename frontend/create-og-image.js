import sharp from 'sharp';

// Create a 1200x630 Open Graph image with gradient background
const width = 1200;
const height = 630;

sharp('src/img/bg_logo.webp')
  .resize(320, 320, { fit: 'inside' })
  .toBuffer()
  .then(logoBuffer => {
    // Create canvas with gradient background, logo, and text
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <!-- Gradient Background -->
        <defs>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#1e3a8a;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#bgGradient)"/>
        
        <!-- Logo placeholder (will be composited) -->
        <rect x="440" y="140" width="320" height="320" fill="transparent"/>
        
        <!-- Main Title -->
        <text 
          x="600" 
          y="510" 
          font-family="Arial, sans-serif" 
          font-size="56" 
          font-weight="bold" 
          fill="white" 
          text-anchor="middle">
          Bedriftsgrafen.no
        </text>
        
        <!-- Subtitle -->
        <text 
          x="600" 
          y="560" 
          font-family="Arial, sans-serif" 
          font-size="28" 
          fill="#bfdbfe" 
          text-anchor="middle">
          Analyse av norske bedrifter
        </text>
      </svg>
    `;
    
    return sharp(Buffer.from(svg))
      .composite([
        {
          input: logoBuffer,
          top: 140,
          left: 440
        }
      ])
      .png()
      .toFile('public/og-image.png');
  })
  .then(() => {
    console.log('✅ og-image.png created successfully at public/og-image.png');
    console.log('   Size: 1200×630 (optimized for social media)');
  })
  .catch(err => {
    console.error('❌ Error creating og-image:', err);
    process.exit(1);
  });
