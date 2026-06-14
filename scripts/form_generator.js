const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

async function generateForm(dataJsonPath, outputDir) {
    let data = {};
    try {
        data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf-8'));
    } catch (e) {
        console.error(JSON.stringify({ success: false, error: 'Failed to read data file: ' + e.message }));
        process.exit(1);
    }

    const studentId = data.studentId || 'TSS-TEMP';
    fs.mkdirSync(outputDir, { recursive: true });

    // Format date parts
    const createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    const dayStr = String(createdAt.getDate()).padStart(2, '0');
    const monthStr = String(createdAt.getMonth() + 1).padStart(2, '0');
    const yearStr = String(createdAt.getFullYear()).slice(-2);

    // Format DOB parts (DD-MM-YYYY or YYYY-MM-DD)
    let dobD = '', dobM = '', dobY = '';
    const dobRaw = data.dob || '';
    const dobParts = dobRaw.replace(/[\/\.]/g, '-').split('-');
    if (dobParts.length === 3) {
        if (dobParts[0].length === 4) {
            dobY = dobParts[0];
            dobM = dobParts[1].padStart(2, '0');
            dobD = dobParts[2].padStart(2, '0');
        } else {
            dobD = dobParts[0].padStart(2, '0');
            dobM = dobParts[1].padStart(2, '0');
            dobY = dobParts[2];
        }
    }

    // CNIC digits formatting
    const cnicRaw = (data.cnic || '').replace(/[^0-9]/g, '');
    const cnicDigits = cnicRaw.split('');

    // Preferred Days checkboxes
    const prefDays = (data.preferredDays || '').toLowerCase();
    const dayCheck = (d) => prefDays.includes(d.toLowerCase());

    // Batch timing checkboxes
    const batch = (data.batch || '').toLowerCase();

    // Gender checkboxes
    const gender = (data.gender || '').toLowerCase();

    // Load template background as base64
    const templatePath = path.join(__dirname, '..', 'assets', 'forms', 'student-registration-template.png');
    if (!fs.existsSync(templatePath)) {
        console.error(JSON.stringify({ success: false, error: 'Template file not found: ' + templatePath }));
        process.exit(1);
    }
    const templateBase64 = fs.readFileSync(templatePath).toString('base64');

    // Generate QR Code
    let qrDataUrl = '';
    try {
        qrDataUrl = await QRCode.toDataURL(`StudentID: ${studentId}\nName: ${data.fullName || ''}\nCourse: ${data.course || ''}`, { margin: 1 });
    } catch (qrErr) {
        console.error("QR Generation Error:", qrErr);
    }

    // HTML template overlaying text precisely on the template background
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        width: 682px;
        height: 1024px;
        background-color: #fff;
        font-family: 'Arial', sans-serif;
    }
    .form-container {
        position: relative;
        width: 682px;
        height: 1024px;
        background-image: url('data:image/png;base64,${templateBase64}');
        background-size: cover;
        background-repeat: no-repeat;
    }
    .field {
        position: absolute;
        font-size: 10px;
        font-weight: bold;
        color: #000;
        font-family: 'Arial', sans-serif;
        white-space: nowrap;
    }
    .field-center {
        text-align: center;
    }
</style>
</head>
<body>
<div class="form-container">
    <!-- Form No & Date -->
    <div class="field" style="left: 110px; top: 248px; font-size: 11px; color: #032b74;">${studentId}</div>
    <div class="field" style="left: 532px; top: 248px;">${dayStr}</div>
    <div class="field" style="left: 562px; top: 248px;">${monthStr}</div>
    <div class="field" style="left: 612px; top: 248px;">20${yearStr}</div>

    <!-- Personal Information -->
    <div class="field" style="left: 115px; top: 309px;">${data.fullName || ''}</div>
    <div class="field" style="left: 115px; top: 332px;">${data.fatherName || ''}</div>
    
    <!-- CNIC Boxes -->
    ${cnicDigits.map((digit, i) => {
        let x = 126;
        if (i < 5) {
            x = 126 + i * 13;
        } else if (i < 12) {
            x = 206 + (i - 5) * 13;
        } else if (i === 12) {
            x = 315;
        }
        return `<div class="field field-center" style="left: ${x}px; top: 353px; width: 10px;">${digit}</div>`;
    }).join('\n')}

    <!-- DOB -->
    <div class="field" style="left: 195px; top: 376px;">${dobD}</div>
    <div class="field" style="left: 245px; top: 376px;">${dobM}</div>
    <div class="field" style="left: 295px; top: 376px;">${dobY}</div>

    <!-- Gender -->
    ${gender.includes('female') 
        ? `<div class="field" style="left: 174px; top: 404px; color: #032b74; font-size: 11px;">✓</div>` 
        : `<div class="field" style="left: 122px; top: 404px; color: #032b74; font-size: 11px;">✓</div>`}

    <div class="field" style="left: 115px; top: 426px;">${data.nationality || 'Pakistani'}</div>
    <div class="field" style="left: 115px; top: 449px;">${data.religion || 'Islam'}</div>

    <!-- Contact details right column -->
    <div class="field" style="left: 485px; top: 309px;">${data.phone || ''}</div>
    <div class="field" style="left: 485px; top: 332px;">${data.whatsapp || ''}</div>
    <div class="field" style="left: 485px; top: 355px;">${data.email || ''}</div>
    
    <!-- Address (split if too long) -->
    ${(data.address || '').length > 35 
        ? `<div class="field" style="left: 485px; top: 378px;">${(data.address || '').slice(0, 35)}</div>
           <div class="field" style="left: 485px; top: 402px;">${(data.address || '').slice(35)}</div>`
        : `<div class="field" style="left: 485px; top: 378px;">${data.address || ''}</div>`}

    <div class="field" style="left: 485px; top: 426px;">${data.city || 'Karachi'}</div>
    <div class="field" style="left: 485px; top: 449px;">${data.postalCode || ''}</div>

    <!-- Academic Information -->
    <div class="field" style="left: 145px; top: 505px;">${data.qualification || ''}</div>
    <div class="field" style="left: 145px; top: 528px;">${data.school || ''}</div>
    <div class="field" style="left: 145px; top: 551px;">${data.passingYear || ''}</div>
    <div class="field" style="left: 145px; top: 574px;">${data.marks || ''}</div>

    <!-- Course Information -->
    <div class="field" style="left: 485px; top: 505px;">${data.course || ''}</div>

    <!-- Batch Timing Checkbox overlay -->
    ${batch.includes('morning') ? `<div class="field" style="left: 391px; top: 537px; color: #032b74; font-size: 11px;">✓</div>` : ''}
    ${batch.includes('afternoon') ? `<div class="field" style="left: 451px; top: 537px; color: #032b74; font-size: 11px;">✓</div>` : ''}
    ${batch.includes('evening') ? `<div class="field" style="left: 516px; top: 537px; color: #032b74; font-size: 11px;">✓</div>` : ''}
    ${batch.includes('weekend') ? `<div class="field" style="left: 574px; top: 537px; color: #032b74; font-size: 11px;">✓</div>` : ''}

    <!-- Preferred Days Checkbox overlay -->
    ${dayCheck('mon') ? `<div class="field" style="left: 391px; top: 564px; color: #032b74; font-size: 11px;">✓</div>` : ''}
    ${dayCheck('tue') ? `<div class="field" style="left: 430px; top: 564px; color: #032b74; font-size: 11px;">✓</div>` : ''}
    ${dayCheck('wed') ? `<div class="field" style="left: 469px; top: 564px; color: #032b74; font-size: 11px;">✓</div>` : ''}
    ${dayCheck('thu') ? `<div class="field" style="left: 505px; top: 564px; color: #032b74; font-size: 11px;">✓</div>` : ''}
    ${dayCheck('fri') ? `<div class="field" style="left: 544px; top: 564px; color: #032b74; font-size: 11px;">✓</div>` : ''}
    ${dayCheck('sat') ? `<div class="field" style="left: 583px; top: 564px; color: #032b74; font-size: 11px;">✓</div>` : ''}
    ${dayCheck('sun') ? `<div class="field" style="left: 622px; top: 564px; color: #032b74; font-size: 11px;">✓</div>` : ''}

    <div class="field" style="left: 485px; top: 579px;">${data.reference || 'Social Media'}</div>

    <!-- Emergency Contact -->
    <div class="field" style="left: 150px; top: 634px;">${data.emergencyName || ''}</div>
    <div class="field" style="left: 420px; top: 634px;">${data.relationship || ''}</div>
    <div class="field" style="left: 110px; top: 654px;">${data.emergencyPhone || ''}</div>
    <div class="field" style="left: 460px; top: 654px;">${data.alternatePhone || ''}</div>
    <div class="field" style="left: 100px; top: 674px;">${data.emergencyAddress || ''}</div>

    <!-- QR Code overlay -->
    ${qrDataUrl ? `<div style="position: absolute; left: 315px; top: 215px; width: 55px; height: 55px; background: white; padding: 2px;"><img src="${qrDataUrl}" style="width: 51px; height: 51px; display: block;"></div>` : ''}

    <!-- Photo Placeholder Box overlay -->
    <div style="position: absolute; left: 570px; top: 95px; width: 80px; height: 95px; border: 1px dashed #032b74; background: white; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 7.5px; color: #555; text-align: center; line-height: 1.3; border-radius: 4px;">
        <span style="font-size: 14px;">👤</span>
        <span style="font-weight: bold; margin-top: 2px;">PASSPORT</span>
        <span style="font-weight: bold;">SIZE</span>
        <span style="font-weight: bold;">PHOTO</span>
    </div>
</div>
</body>
</html>`;

    const pngFilename = `TSS_Registration_${studentId}.png`;
    const pdfFilename = `TSS_Registration_${studentId}.pdf`;
    const pngPath = path.join(outputDir, pngFilename);
    const pdfPath = path.join(outputDir, pdfFilename);

    let browser;
    try {
        const chromePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Users\\ALI COMPUTERS\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
        ];
        let executablePath;
        for (const p of chromePaths) {
            if (fs.existsSync(p)) { executablePath = p; break; }
        }

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        const page = await browser.newPage();
        
        // Set viewport for high density rendering (682x1024 at 2x is 1364x2048)
        await page.setViewport({ width: 682, height: 1024, deviceScaleFactor: 2 });
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        // Wait 500ms for resources/fonts to load
        await new Promise(r => setTimeout(r, 500));

        // Screenshot to PNG
        await page.screenshot({
            path: pngPath,
            fullPage: true,
            type: 'png'
        });

        // PDF Generation
        await page.pdf({
            path: pdfPath,
            width: '682px',
            height: '1024px',
            printBackground: true,
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
        });

        await browser.close();

        const result = {
            success: true,
            png: pngFilename,
            pdf: pdfFilename,
            pngPath,
            pdfPath
        };
        console.log(`Generated Image: ${pngPath}`);
        console.log(`Generated PDF: ${pdfPath}`);
        console.log(JSON.stringify(result));

    } catch (err) {
        if (browser) await browser.close().catch(() => {});
        console.error(JSON.stringify({ success: false, error: err.message }));
        process.exit(1);
    }
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node form_generator.js <data_json_path> <output_dir>');
    process.exit(1);
}
generateForm(args[0], args[1]);
