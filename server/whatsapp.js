const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const db = require('./db');

// Keep track of connection status and QR code
let connectionStatus = 'Disconnected'; // Disconnected, Connecting, QR_Ready, Connected
let qrCodeDataUri = null;
let client = null;
let wsServer = null; // To broadcast updates

// Find local Chrome executable
function getChromePath() {
    const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Users\\ALI COMPUTERS\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

// Set WebSocket Server
function setWsServer(server) {
    wsServer = server;
}

// Broadcast helper
function broadcast(type, data) {
    if (wsServer) {
        const payload = JSON.stringify({ type, data });
        wsServer.clients.forEach(client => {
            if (client.readyState === 1) { // OPEN
                client.send(payload);
            }
        });
    }
}

// 26 Admission Fields
const ADMISSION_FIELDS = [
    { key: 'fullName', label: 'Full Name', prompt: 'Please provide your Full Name:' },
    { key: 'fatherName', label: "Father's Name", prompt: "Please enter your Father's Name:" },
    { 
        key: 'cnic', 
        label: 'CNIC / B-Form Number', 
        prompt: 'Please enter your CNIC or B-Form number (format: XXXXX-XXXXXXX-X or 13 digits without dashes):', 
        validate: (val) => {
            const clean = val.replace(/[^0-9]/g, '');
            return clean.length === 13;
        },
        format: (val) => {
            const clean = val.replace(/[^0-9]/g, '');
            return `${clean.slice(0, 5)}-${clean.slice(5, 12)}-${clean.slice(12)}`;
        }
    },
    { 
        key: 'dob', 
        label: 'Date of Birth', 
        prompt: 'Please provide your Date of Birth (format: DD-MM-YYYY, e.g. 15-08-2002):', 
        validate: (val) => {
            const regex = /^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/;
            if (!regex.test(val.trim())) return false;
            const clean = val.replace(/[-/.]/g, '-');
            const parts = clean.split('-');
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const y = parseInt(parts[2], 10);
            if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1920 || y > new Date().getFullYear() - 10) return false;
            return true;
        },
        format: (val) => val.trim().replace(/[-/.]/g, '-')
    },
    { 
        key: 'gender', 
        label: 'Gender', 
        prompt: 'Please specify your Gender (Male / Female):', 
        validate: (val) => {
            const g = val.trim().toLowerCase();
            return g === 'male' || g === 'female';
        },
        format: (val) => {
            const g = val.trim().toLowerCase();
            return g.charAt(0).toUpperCase() + g.slice(1);
        }
    },
    { key: 'nationality', label: 'Nationality', prompt: 'Please enter your Nationality:' },
    { key: 'religion', label: 'Religion', prompt: 'Please enter your Religion:' },
    { key: 'phone', label: 'Phone Number', prompt: 'Please provide your active Phone Number (e.g. 03XXXXXXXXX):', validate: (val) => val.replace(/[^0-9]/g, '').length >= 10 },
    { key: 'whatsapp', label: 'WhatsApp Number', prompt: 'Please provide your active WhatsApp Number (e.g. 03XXXXXXXXX):', validate: (val) => val.replace(/[^0-9]/g, '').length >= 10 },
    { 
        key: 'email', 
        label: 'Email Address', 
        prompt: 'Please enter your Email Address:', 
        validate: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()),
        format: (val) => val.trim().toLowerCase()
    },
    { key: 'address', label: 'Permanent Address', prompt: 'Please enter your Permanent Address:' },
    { key: 'city', label: 'City', prompt: 'Please enter your City:' },
    { key: 'postalCode', label: 'Postal Code', prompt: 'Please enter your Postal Code:', validate: (val) => /^\d{5}$/.test(val.trim()) },
    { key: 'qualification', label: 'Last Qualification', prompt: 'What is your last Academic Qualification (e.g. Matric, Intermediate, Bachelors)?' },
    { key: 'school', label: 'Institute / School Name', prompt: 'What is the name of your last Institute / School / College?' },
    { key: 'passingYear', label: 'Year of Passing', prompt: 'Please enter your Year of Passing (e.g. 2024):', validate: (val) => {
        const y = parseInt(val.trim(), 10);
        return y >= 1980 && y <= new Date().getFullYear();
    }},
    { key: 'marks', label: 'Marks / CGPA', prompt: 'Please provide your obtained Marks / CGPA (e.g. 850/1100 or 3.5/4.0):' },
    { 
        key: 'course', 
        label: 'Interested Course', 
        prompt: 'Which course are you interested in?\n\n🤖 *AI & Technology:*\n- Generative AI\n- Agentic AI\n- Web Development\n- App Development\n- Graphic Designing\n- Digital Marketing\n- YouTube Automation\n- Amazon FBA\n- 3D Animation\n\n🚀 *Career Programs:*\n- Freelancing Masterclass\n- Computer Fundamentals\n- Office Automation (MS Office)\n- Programming for Beginners\n- AI Tools for Students\n\n📚 *Academic Coaching:*\n- Grade 5 to 10 Coaching\n\n👉 *Please type the course name:*',
        validate: (val) => {
            const courses = db.getCourses();
            const matched = courses.find(c => c.name.toLowerCase().includes(val.toLowerCase()) || val.toLowerCase().includes(c.name.toLowerCase()));
            return matched !== undefined;
        },
        format: (val) => {
            const courses = db.getCourses();
            const matched = courses.find(c => c.name.toLowerCase().includes(val.toLowerCase()) || val.toLowerCase().includes(c.name.toLowerCase()));
            return matched.name;
        }
    },
    { 
        key: 'batch', 
        label: 'Preferred Batch Timing', 
        prompt: 'Select your preferred batch timing (Morning / Afternoon / Evening / Weekend):', 
        validate: (val) => {
            const b = val.trim().toLowerCase();
            return ['morning', 'afternoon', 'evening', 'weekend'].includes(b);
        },
        format: (val) => {
            const b = val.trim().toLowerCase();
            return b.charAt(0).toUpperCase() + b.slice(1);
        }
    },
    { key: 'preferredDays', label: 'Preferred Days', prompt: 'Please select your Preferred Days (e.g. Sat & Sun, or Mon & Wed):' },
    { key: 'reference', label: 'Reference', prompt: 'How did you hear about us? (Facebook, Instagram, Friend, etc.):' },
    { key: 'emergencyName', label: 'Emergency Contact Person', prompt: 'Please enter the name of your Emergency Contact Person:' },
    { key: 'relationship', label: 'Relationship', prompt: 'What is your relationship with the emergency contact?' },
    { key: 'emergencyPhone', label: 'Emergency Contact Number', prompt: 'Please provide the Phone Number of your emergency contact:', validate: (val) => val.replace(/[^0-9]/g, '').length >= 10 },
    { 
        key: 'alternatePhone', 
        label: 'Alternate Phone Number', 
        prompt: 'Please provide an alternate phone number (Optional, type "None" to skip):',
        validate: (val) => val.trim().toLowerCase() === 'none' || val.replace(/[^0-9]/g, '').length >= 10,
        format: (val) => val.trim().toLowerCase() === 'none' ? 'None' : val.trim()
    },
    { key: 'emergencyAddress', label: 'Emergency Address', prompt: 'Please enter the Address of your emergency contact:' }
];

const GREETINGS = [
    "Welcome to The Student Space Institute. How may I assist you today? 📚",
    "Hello and thank you for contacting The Student Space. How can I help you today? ✨",
    "Hi there! Welcome to The Student Space. What would you like to know today? 🚀",
    "Greetings! We're glad to hear from you. How may I assist you today? 🌟"
];

function getMenu() {
    return `🎓 *THE STUDENT SPACE INSTITUTE*
━━━━━━━━━━━━━━━━━━━━
We're here to guide you! Please choose:

1️⃣ About the Institute
2️⃣ Courses & Programs
3️⃣ Start Admission / Enroll Now
4️⃣ Contact Information
5️⃣ Fee Details

Or just type your question and I'll answer! 😊`;
}

// Call Gemini API directly (HTTP call to avoid Node dependencies)
async function getAIResponse(userMessage, chatHistory = [], activeState = null) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        console.warn("GEMINI_API_KEY is not configured. Fallback to basic answers.");
        return handleFallbackOffline(userMessage);
    }

    const courses = db.getCourses();
    const coursesText = courses.map(c => `* ${c.name}: Duration: ${c.duration}, Fee: ${c.fee} (${c.installment}), Schedule: ${c.schedule}, Opportunities: ${c.careerOpportunities}, Description: ${c.description}`).join('\n');

    const systemPrompt = `You are a professional human admission officer, counselor, receptionist, and student support representative for "The Student Space Institute".
Personality: Always respond in a friendly, professional, and human-like manner. Never sound robotic. Use conversational English.
Keep responses short and engaging unless detailed information is requested. Guide users politely.

Knowledge Base:
- Intro: The Student Space Institute is a premier training academy providing market-driven skill training in IT, design, and marketing.
- Mission: Empowering young minds for tomorrow by building strong concepts for a bright future.
- Vision: Learn, Grow, Succeed. To be a leading educational hub that bridges the skill gap.
- Methodology: Hands-on project-based learning, individual mentorship, active weekly assessments, and industry-standard portfolio building.
- Facilities: State-of-the-art computer lab, high-speed Wi-Fi, air-conditioned classes, student discussion lounge, and online backup recordings.
- Support: Lifetime career support, internship opportunities for top graduates, resume building, and freelancing training.
- Address: W-003 Ground Floor, Haroon Royal City Phase 3, Block 17, Gulistan-e-Johar, Karachi.
- Phone & WhatsApp: 0322 1761566.
- Email: info@thestudentspace.com.
- Landmark: Near Federal Urdu University / Continental Bakery.
- Google Maps: https://maps.google.com/?q=The+Student+Space+Gulistan-e-Johar+Karachi

Available Programs:
${coursesText}

Rules:
1. If the user asks for contact details, NEVER reveal all contact details at once. Instead ask:
"Which contact information would you like?
1️⃣ Phone Number
2️⃣ WhatsApp Number
3️⃣ Email Address
4️⃣ Office Address
5️⃣ Social Media Links"
Then provide only the selected one when they reply.
2. If the user asks about fees: Show available programs first and ask: "Which course are you interested in?" to provide specific fee details.
3. If they ask about unrelated topics (e.g., weather, cooking, general knowledge): Respond: "I specialize in assisting with The Student Space Institute services. Please ask me anything related to admissions, courses, coaching programs, fees, or institute information."
4. If they ask for human support or "Talk to Admission Team": Ask for their name and contact number so we can connect them.

Current Time: ${new Date().toISOString()}`;

    // Structure contents
    const contents = [];
    
    // Add history
    for (const h of chatHistory.slice(-10)) {
        contents.push({
            role: h.sender === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.text }]
        });
    }
    
    contents.push({
        role: 'user',
        parts: [{ text: userMessage }]
    });

    const body = {
        contents,
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 600
        }
    };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const json = await response.json();
        if (json.candidates && json.candidates[0] && json.candidates[0].content) {
            return json.candidates[0].content.parts[0].text.trim();
        } else {
            console.error("Gemini Error:", json);
            return handleFallbackOffline(userMessage);
        }
    } catch (err) {
        console.error("Gemini HTTP Error:", err);
        return handleFallbackOffline(userMessage);
    }
}

// Local offline fallback parser if Gemini is unconfigured or errors
function handleFallbackOffline(msg) {
    const text = msg.toLowerCase();
    const courses = db.getCourses();
    
    if (text.includes("about") || text.includes("intro") || text.includes("mission") || text.includes("vision")) {
        return "The Student Space Institute is a modern training academy providing market-driven skill training. Our mission is to build strong concepts for a bright future. We offer state-of-the-art computer labs, high-speed Wi-Fi, air-conditioned classes, and hands-on project-based learning. How can I guide you further?";
    }
    
    if (text.includes("course") || text.includes("program") || text.includes("class") || text.includes("coaching")) {
        return `📚 *Available Programs*\n` + courses.map(c => `- ${c.name}`).join('\n') + `\n\nWhich course would you like to know more about?`;
    }
    
    if (text.includes("fee") || text.includes("cost")) {
        return `We offer several courses with affordable installment plans. Which course are you interested in?`;
    }
    
    if (text.includes("contact") || text.includes("phone") || text.includes("email") || text.includes("address")) {
        return `Which contact information would you like?\n\n1️⃣ Phone Number\n2️⃣ WhatsApp Number\n3️⃣ Email Address\n4️⃣ Office Address\n5️⃣ Social Media Links`;
    }
    
    if (text.includes("location") || text.includes("where") || text.includes("address")) {
        return `📍 *Institute Location*:\nW-003 Ground Floor, Haroon Royal City Phase 3, Block 17, Gulistan-e-Johar, Karachi.\n\n*Landmark*: Near Federal Urdu University.\n*Google Maps*: https://maps.google.com/?q=The+Student+Space+Gulistan-e-Johar+Karachi`;
    }
    
    return `Welcome to *The Student Space Institute*! How can I assist you today? You can choose from our options:\n\n` + getMenu();
}

// Intent mapper to store analytic categories
function parseIntent(text) {
    const t = text.toLowerCase();
    if (t.includes("admission") || t.includes("apply") || t.includes("register") || t.includes("enroll")) return "Admission";
    if (t.includes("fee") || t.includes("price") || t.includes("cost")) return "Fees";
    if (t.includes("course") || t.includes("class") || t.includes("program") || t.includes("learn")) return "Courses";
    if (t.includes("location") || t.includes("where") || t.includes("map") || t.includes("address")) return "Location";
    if (t.includes("contact") || t.includes("phone") || t.includes("email")) return "Contact";
    if (t.includes("human") || t.includes("support") || t.includes("talk to")) return "Human Support";
    return "General Info";
}

// Start WhatsApp Client
function initWhatsApp() {
    connectionStatus = 'Connecting';
    qrCodeDataUri = null;
    broadcast('status', { status: connectionStatus, qr: qrCodeDataUri });

    const chromePath = getChromePath();
    console.log("Found Chrome path:", chromePath);

    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            executablePath: chromePath || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ]
        }
    });

    client.on('qr', async (qr) => {
        connectionStatus = 'QR_Ready';
        try {
            qrCodeDataUri = await qrcode.toDataURL(qr);
            broadcast('status', { status: connectionStatus, qr: qrCodeDataUri });
            console.log("WhatsApp QR Code ready. Broadcasted to clients.");
        } catch (err) {
            console.error("Failed to generate QR data URI", err);
        }
    });

    client.on('ready', () => {
        connectionStatus = 'Connected';
        qrCodeDataUri = null;
        broadcast('status', { status: connectionStatus, qr: qrCodeDataUri });
        console.log("WhatsApp Web Client is ready and connected.");
    });

    client.on('auth_failure', (msg) => {
        connectionStatus = 'Disconnected';
        console.error("WhatsApp auth failure:", msg);
        broadcast('status', { status: connectionStatus, qr: null });
    });

    client.on('disconnected', (reason) => {
        connectionStatus = 'Disconnected';
        console.warn("WhatsApp client disconnected:", reason);
        broadcast('status', { status: connectionStatus, qr: null });
        // Attempt reconnection after 5 seconds
        setTimeout(() => initWhatsApp(), 5000);
    });

    client.on('message', async (message) => {
        try {
            const phone = message.from;
            const text = message.body;
            const name = message._data.notifyName || phone;

            console.log(`Received message from ${phone} (${name}): ${text}`);

            // Skip messages from groups
            if (phone.includes('@g.us')) return;

            const intent = parseIntent(text);

            // Fetch conversation history and status
            let conv = db.getConversation(phone);
            const chatHistory = conv ? conv.messages : [];
            const regStatus = conv ? conv.registrationStatus : 'Idle';
            const activeStep = conv ? conv.activeStep : -1;
            const collectedData = conv ? conv.collectedData : {};

            // Save user message in DB
            db.saveMessage(phone, name, { sender: 'student', text, intent });
            broadcast('message', { phone, name, message: { sender: 'student', text, timestamp: new Date().toISOString() } });

            // Core state machine
            let replyText = "";
            let triggerFormGen = false;

            // 1. Check if user is currently inside the step-by-step admission collection workflow
            if (regStatus === 'Active' && activeStep >= 0 && activeStep < ADMISSION_FIELDS.length) {
                const currentField = ADMISSION_FIELDS[activeStep];
                let isValid = true;
                
                // Validate if field has a custom validator
                if (currentField.validate) {
                    isValid = currentField.validate(text);
                } else {
                    isValid = text.trim().length > 0;
                }

                if (isValid) {
                    // Save field
                    const formattedValue = currentField.format ? currentField.format(text) : text.trim();
                    collectedData[currentField.key] = formattedValue;
                    
                    const nextStep = activeStep + 1;
                    
                    if (nextStep < ADMISSION_FIELDS.length) {
                        // Move to next field
                        db.updateConversationStatus(phone, {
                            activeStep: nextStep,
                            collectedData
                        });
                        replyText = `✅ Saved ${currentField.label}.\n\n👉 ${ADMISSION_FIELDS[nextStep].prompt}`;
                    } else {
                        // All fields collected!
                        db.updateConversationStatus(phone, {
                            registrationStatus: 'Completed',
                            activeStep: -1,
                            collectedData
                        });
                        replyText = `🎉 Thank you! We have collected all your details and are now generating your Official TSS Student Registration Form. Please wait a moment...`;
                        triggerFormGen = true;
                    }
                } else {
                    // Invalid, ask again politely
                    replyText = `❌ Invalid input for *${currentField.label}*.\n\n👉 ${currentField.prompt}`;
                }

            } else {
                // Not in active collection mode. Handle intents or natural queries.
                
                // Check for admission trigger words
                const lowerText = text.trim().toLowerCase();
                const triggerWords = ["i want admission", "register me", "enroll me", "apply now", "admission", "3"];
                
                // Exact menu selection for "3" or words matching admission
                const isAdmissionTrigger = triggerWords.includes(lowerText) || 
                                          (lowerText.length === 1 && lowerText === '3') || 
                                          (lowerText.startsWith("apply") || lowerText.includes("enroll"));

                if (isAdmissionTrigger) {
                    // Start admission workflow
                    db.updateConversationStatus(phone, {
                        registrationStatus: 'Active',
                        activeStep: 0,
                        collectedData: {}
                    });
                    replyText = `📝 *TSS Admission Registration Process*\n\nI will guide you step-by-step to fill the registration form. Please answer each question carefully.\n\n👉 ${ADMISSION_FIELDS[0].prompt}`;
                } else if (['menu', 'help', 'hi', 'hello', 'start', 'salam', 'السلام', 'assalam', 'hey'].some(w => lowerText.includes(w)) || lowerText === '0') {
                    // Send greeting + Menu
                    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
                    replyText = `${greeting}\n\n${getMenu()}`;

                } else if (lowerText === '1') {
                    // About Institute
                    replyText = `🏛️ *About The Student Space Institute*\n━━━━━━━━━━━━━━━━━\n\n` +
                                `*Introduction:* Premier skill training academy offering hands-on professional coaching in IT, AI, design, marketing & academic programs.\n\n` +
                                `*Mission:* Empowering young minds for tomorrow by building strong, market-ready conceptual foundations.\n\n` +
                                `*Vision:* Learn • Grow • Succeed — bridging the skill gap between education and industry.\n\n` +
                                `*Methodology:* Project-based learning, individual mentorship, weekly assessments, portfolio building & lifetime career support.\n\n` +
                                `*Facilities:* State-of-the-art computer lab, high-speed Wi-Fi, A/C classes, student lounge, online recorded backup sessions.\n\n` +
                                `📍 W-003 GF, Haroon Royal City, Block 17, Gulistan-e-Johar, Karachi\n📞 0322-1761566\n\nReply *0* for Main Menu`;

                } else if (lowerText === '2') {
                    // Courses List
                    const courses = db.getCourses();
                    const aiTech = courses.filter(c => ['Generative AI','Agentic AI','Web Development','App Development','Graphic Designing','Digital Marketing','YouTube Automation','Amazon FBA','3D Animation'].includes(c.name));
                    const career = courses.filter(c => ['Freelancing Masterclass','Computer Fundamentals','Office Automation (MS Office)','Programming for Beginners','AI Tools for Students'].includes(c.name));
                    const academic = courses.filter(c => c.name.startsWith('Grade'));

                    replyText = `📚 *Our Programs*\n━━━━━━━━━━━━━━━━━\n\n` +
                                `🤖 *AI & Technology*\n` + aiTech.map((c,i) => `  ${i+1}. ${c.name} (${c.duration})`).join('\n') +
                                `\n\n🚀 *Career Programs*\n` + career.map((c,i) => `  ${i+1}. ${c.name} (${c.duration})`).join('\n') +
                                `\n\n📖 *Academic Coaching*\n` + academic.map((c,i) => `  ${i+1}. ${c.name} (${c.fee})`).join('\n') +
                                `\n\nType any *course name* to get full details, or reply *3* to start enrollment! 🎓`;

                } else if (lowerText === '4') {
                    // Contact Info - Short & Specific
                    replyText = `📬 *Contact Details — The Student Space*\n━━━━━━━━━━━━━━━━━\n\n` +
                                `📞 *Phone / WhatsApp:* 0322 1761566\n` +
                                `📍 *Office Address:* W-003, Ground Floor, Haroon Royal City Phase 3, Block 17, Gulistan-e-Johar, Karachi.\n\n` +
                                `👉 Aap ko in me se kis detail ki zarurat hai? Aap directly *Map Link*, *Email*, ya *Social Media Links* type karke reply karein, main details send kar dunga! 😊`;

                } else if (lowerText === '5') {
                    // Fee Details - Short & Specific Prompt
                    replyText = `💰 *Fee Details — The Student Space*\n━━━━━━━━━━━━━━━━━\n\n` +
                                `Humare paas different courses ki different fee structures aur monthly installment plans available hain.\n\n` +
                                `👉 Aap ko kis specific course ki fees aur details chahiye? Please course ka naam likh kar replay karein (e.g. *Generative AI*, *Web Development*, *Agentic AI*, *YouTube Automation*, ya *Grade 9 Coaching*).\n\n` +
                                `Main aap ko us specific course ki exact fee structure send kar dunga! 😊`;

                } else if (conv && conv.registrationStatus === 'Lead_Escalation') {
                    // Lead data captured
                    db.addLead({
                        name,
                        phone: text,
                        course: 'General Query',
                        status: 'New'
                    });
                    db.updateConversationStatus(phone, {
                        registrationStatus: 'Idle'
                    });
                    replyText = `✅ Thank you! We have saved your request. An admission representative will contact you very shortly on *${text}*. 📞`;
                } else {
                    // Fallback: Let Gemini AI handle the query
                    replyText = await getAIResponse(text, chatHistory, conv);
                }
            }

            // Save and send reply
            if (replyText) {
                db.saveMessage(phone, name, { sender: 'assistant', text: replyText });
                broadcast('message', { phone, name: 'assistant', message: { sender: 'assistant', text: replyText, timestamp: new Date().toISOString() } });
                await client.sendMessage(phone, replyText);
            }

            // Trigger registration generation
            if (triggerFormGen) {
                await executeRegistrationFormGeneration(phone, name, collectedData);
            }

        } catch (err) {
            console.error("Error processing message:", err);
        }
    });

    client.initialize();
}

// Perform script execution for registration
async function executeRegistrationFormGeneration(phone, name, collectedData) {
    try {
        const studentId = 'TSS-' + Date.now().toString().slice(-4);
        collectedData.studentId = studentId;
        collectedData.createdAt = new Date().toISOString();
        
        // Write to temp JSON file
        const tempJsonPath = path.join(__dirname, '..', 'data', `temp_${studentId}.json`);
        fs.writeFileSync(tempJsonPath, JSON.stringify(collectedData, null, 2), 'utf-8');
        
        const outputDir = path.join(__dirname, '..', 'data', 'registrations');
        const scriptPath = path.join(__dirname, '..', 'scripts', 'form_generator.js');
        
        console.log(`Running Node.js form generator for student ${studentId}...`);
        
        exec(`node "${scriptPath}" "${tempJsonPath}" "${outputDir}"`, async (err, stdout, stderr) => {
            // Clean up temp file
            if (fs.existsSync(tempJsonPath)) {
                fs.unlinkSync(tempJsonPath);
            }
            
            if (err) {
                console.error("Python Exec Error:", err);
                console.error("Python Stderr:", stderr);
                const errMsg = `⚠️ We encountered an issue compiling your official form, but don't worry! Your details are safely registered in our database under Student ID *${studentId}*. Our admission team will contact you to send your physical copy.`;
                db.saveMessage(phone, name, { sender: 'assistant', text: errMsg });
                await client.sendMessage(phone, errMsg);
                return;
            }
            
            try {
                // Find json output in stdout
                const lines = stdout.trim().split('\n');
                const lastLine = lines[lines.length - 1];
                const result = JSON.parse(lastLine);
                
                if (result.success) {
                    // Update database registration details
                    const registrationRecord = db.addRegistration({
                        ...collectedData,
                        generatedImage: `/data/registrations/${result.png}`,
                        generatedPdf: `/data/registrations/${result.pdf}`
                    });
                    
                    // Add lead too
                    db.addLead({
                        name: collectedData.fullName,
                        phone: collectedData.phone,
                        course: collectedData.course,
                        status: 'Converted'
                    });

                    // Form generated and stored internally — do NOT send file to student
                    // Only send confirmation message with branch visit instruction
                    const confirmMsg = `✅ *Registration Successful!*\n\n` +
                        `🎓 *Student ID:* ${studentId}\n` +
                        `👤 *Name:* ${collectedData.fullName}\n` +
                        `📚 *Course:* ${collectedData.course}\n` +
                        `⏰ *Batch:* ${collectedData.batch}\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━\n` +
                        `📋 *Aap ka Registration Form tayyar ho gaya hai!*\n\n` +
                        `👉 Apna Form hasil karne ke liye, *The Student Space* ki branch par tashreef layein:\n\n` +
                        `📍 *W-003, Ground Floor, Haroon Royal City,*\n` +
                        `*Phase 3, Block 17, Gulistan-e-Johar, Karachi*\n\n` +
                        `🏛️ Wahan se apna Form le kar, us par *Official Stamp / Attestation* lagwayein.\n\n` +
                        `📞 *Contact:* 0322 1761566\n\n` +
                        `✨ *Jald hi Admission confirm karne ke liye aap se rabta kiya jayega!*\n\n` +
                        `*Welcome to The Student Space Family! 🎉*`;

                    db.saveMessage(phone, name, { sender: 'assistant', text: confirmMsg });
                    await client.sendMessage(phone, confirmMsg);

                    broadcast('registration', registrationRecord);
                    console.log(`Successfully completed registration for ${studentId}. Form stored internally.`);
                } else {
                    throw new Error(result.error || "Form generation script returned failure.");
                }
            } catch (parseErr) {
                console.error("Failed to parse form generator results:", parseErr, stdout);
                const errMsg = `⚠️ Your registration details have been saved under Student ID *${studentId}*, but we had a problem sending the document copy. Our team will contact you shortly to deliver it.`;
                await client.sendMessage(phone, errMsg);
            }
        });
    } catch (err) {
        console.error("Admission generation failure:", err);
    }
}

// Actions
module.exports = {
    init: initWhatsApp,
    getClient: () => client,
    getStatus: () => ({ status: connectionStatus, qr: qrCodeDataUri }),
    setWsServer
};
