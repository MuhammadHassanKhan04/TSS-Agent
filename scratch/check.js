const fs = require('fs');
const path = require('path');

// Read the first few bytes of PNG to find dimensions, or just use a small script
// Let's use simple png parser logic or read the file stream
// A PNG file starts with 8 bytes: 89 50 4E 47 0D 0A 1A 0A
// Then the IHDR chunk starts at byte 12 (0-indexed)
// Chunk type is at byte 12 (IHDR)
// Width is at byte 16 (4 bytes, big-endian)
// Height is at byte 20 (4 bytes, big-endian)

const filePath = path.join(__dirname, '..', 'assets', 'forms', 'student-registration-template.png');
const buffer = fs.readFileSync(filePath);

// Let's verify if it's a JPEG or PNG
// A JPEG starts with FF D8
if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    // JPEG parser
    let pos = 2;
    while (pos < buffer.length) {
        if (buffer[pos] === 0xFF && buffer[pos+1] === 0xC0) {
            const height = buffer[pos+5] * 256 + buffer[pos+6];
            const width = buffer[pos+7] * 256 + buffer[pos+8];
            console.log(`JPEG: ${width}x${height}`);
            break;
        }
        pos++;
    }
} else if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    // PNG parser
    const width = buffer.readInt32BE(16);
    const height = buffer.readInt32BE(20);
    console.log(`PNG: ${width}x${height}`);
} else {
    console.log("Unknown format");
}
