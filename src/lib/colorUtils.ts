export function getDominantColor(imageSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageSrc;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No ctx');
        
        ctx.drawImage(img, 0, 0, img.width, img.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let r = 0, g = 0, b = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 16 * 4) { // Sample every 16 pixels
          if (data[i + 3] > 128) { // Skip transparent
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }

        if (count > 0) {
          r = Math.floor(r / count);
          g = Math.floor(g / count);
          b = Math.floor(b / count);
          resolve(`rgba(${r}, ${g}, ${b}, 0.8)`);
        } else {
          resolve('rgba(234, 88, 12, 0.8)'); // Default fallback
        }
      } catch (e) {
        resolve('rgba(234, 88, 12, 0.8)');
      }
    };
    img.onerror = () => {
      resolve('rgba(234, 88, 12, 0.8)');
    };
  });
}
