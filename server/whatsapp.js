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

// Helper: Group courses by category dynamically
function getGroupedCourses() {
    const courses = db.getCourses();
    const aiTech = [];
    const career = [];
    const academic = [];
    const other = [];

    courses.forEach(c => {
        const nameLower = c.name.toLowerCase();
        if (
            nameLower.includes('ai') || 
            nameLower.includes('development') || 
            nameLower.includes('design') || 
            nameLower.includes('marketing') || 
            nameLower.includes('amazon') || 
            nameLower.includes('animation') ||
            nameLower.includes('youtube')
        ) {
            aiTech.push(c);
        } else if (
            nameLower.includes('freelancing') || 
            nameLower.includes('computer') || 
            nameLower.includes('office') || 
            nameLower.includes('programming') || 
            nameLower.includes('tools') ||
            nameLower.includes('fundamentals')
        ) {
            career.push(c);
        } else if (
            nameLower.includes('grade') || 
            nameLower.includes('coaching') || 
            nameLower.includes('class') || 
            nameLower.includes('school')
        ) {
            academic.push(c);
        } else {
            other.push(c);
        }
    });

    return { aiTech, career, academic, other };
}

// Helper: Get all active courses in a flat array, ordered by category
function getOrderedCourses() {
    const { aiTech, career, academic, other } = getGroupedCourses();
    return [...aiTech, ...career, ...academic, ...other];
}

// Helper: Build course prompt dynamically from live DB
function buildCoursePrompt() {
    const { aiTech, career, academic, other } = getGroupedCourses();

    let prompt = `Aap kis course mein interested hain? Neeche se course ka *Naam* ya *Number* type karein:\n`;

    let currentIndex = 1;

    if (aiTech.length > 0) {
        prompt += `\n🤖 *AI & Technology:*\n`;
        aiTech.forEach(c => {
            prompt += `  ${currentIndex}. ${c.name} (${c.duration}, ${c.fee})\n`;
            currentIndex++;
        });
    }
    if (career.length > 0) {
        prompt += `\n🚀 *Career Programs:*\n`;
        career.forEach(c => {
            prompt += `  ${currentIndex}. ${c.name} (${c.duration}, ${c.fee})\n`;
            currentIndex++;
        });
    }
    if (academic.length > 0) {
        prompt += `\n📚 *Academic Coaching:*\n`;
        academic.forEach(c => {
            prompt += `  ${currentIndex}. ${c.name} (${c.fee})\n`;
            currentIndex++;
        });
    }
    if (other.length > 0) {
        prompt += `\n📖 *Other Programs:*\n`;
        other.forEach(c => {
            prompt += `  ${currentIndex}. ${c.name} (${c.duration}, ${c.fee})\n`;
            currentIndex++;
        });
    }

    prompt += `\n👉 *Course ka Naam ya Number type karein (e.g. 1 or Generative AI):*`;
    return prompt;
}

// Admission Fields — now a FUNCTION so course list is always live from DB
function getAdmissionFields() {
  return [
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
        // prompt is a function — always reads live courses from admin dashboard
        get prompt() { return buildCoursePrompt(); },
        validate: (val) => {
            const cleanVal = val.trim();
            const num = parseInt(cleanVal, 10);
            const ordered = getOrderedCourses();
            
            if (!isNaN(num) && num > 0 && num <= ordered.length) {
                return true;
            }
            
            const matched = ordered.find(c => c.name.toLowerCase().includes(cleanVal.toLowerCase()) || cleanVal.toLowerCase().includes(c.name.toLowerCase()));
            return matched !== undefined;
        },
        format: (val) => {
            const cleanVal = val.trim();
            const num = parseInt(cleanVal, 10);
            const ordered = getOrderedCourses();
            
            if (!isNaN(num) && num > 0 && num <= ordered.length) {
                return ordered[num - 1].name;
            }
            
            const matched = ordered.find(c => c.name.toLowerCase().includes(cleanVal.toLowerCase()) || cleanVal.toLowerCase().includes(c.name.toLowerCase()));
            return matched ? matched.name : cleanVal;
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
}

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
            const FIELDS = getAdmissionFields(); // always fresh from DB
            if (regStatus === 'Active' && activeStep >= 0 && activeStep < FIELDS.length) {
                const currentField = FIELDS[activeStep];
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
                    
                    if (nextStep < FIELDS.length) {
                        // Move to next field
                        db.updateConversationStatus(phone, {
                            activeStep: nextStep,
                            collectedData
                        });
                        replyText = `✅ Saved ${currentField.label}.\n\n👉 ${FIELDS[nextStep].prompt}`;
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
                    replyText = `📝 *TSS Admission Registration Process*\n\nMain aap ko step-by-step registration form fill karwaunga. Har sawaal ka jawab dhyan se dein.\n\n👉 ${getAdmissionFields()[0].prompt}`;
                } else if (['menu', 'help', 'hi', 'hello', 'start', 'salam', 'السلام', 'assalam', 'hey'].some(w => lowerText.includes(w)) || lowerText === '0') {
                    // Send greeting + Menu
                    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
                    replyText = `${greeting}\n\n${getMenu()}`;

                } else if (lowerText === '1' || lowerText === 'about' || lowerText === 'about us' || lowerText === 'institute') {
                    // About Institute - Short Menu with options
                    replyText = `🏛️ *About The Student Space Institute*\n━━━━━━━━━━━━━━━━━\n` +
                                `Aap kis specific cheez ke baare mein jaanna chahte hain? Please choose:\n\n` +
                                `1️⃣ *Introduction* (Type *1.1*)\n` +
                                `2️⃣ *Mission & Vision* (Type *1.2*)\n` +
                                `3️⃣ *Learning Methodology* (Type *1.3*)\n` +
                                `4️⃣ *Campus Facilities* (Type *1.4*)\n` +
                                `5️⃣ *Branch Address & Landmark* (Type *1.5*)\n\n` +
                                `👉 Option type karein (e.g. *1.1* or *Introduction*).\n` +
                                `👉 Reply *0* to return to Main Menu.`;

                } else if (lowerText === '1.1' || lowerText === '11' || lowerText.includes('introduction') || lowerText === 'intro') {
                    // Intro details
                    replyText = `🏛️ *Introduction — The Student Space*\n━━━━━━━━━━━━━━━━━\n\n` +
                                `The Student Space is a premier skill training academy offering professional hands-on coaching in IT, AI, design, marketing & academic programs.\n\n` +
                                `👉 Reply *1* for About options.\n` +
                                `👉 Reply *0* to return to Main Menu.`;

                } else if (lowerText === '1.2' || lowerText === '12' || lowerText.includes('mission') || lowerText.includes('vision')) {
                    // Mission details
                    replyText = `🎯 *Mission & Vision — The Student Space*\n━━━━━━━━━━━━━━━━━\n\n` +
                                `*Mission:* Empowering young minds for tomorrow by building strong, market-ready conceptual foundations.\n\n` +
                                `*Vision:* Learn • Grow • Succeed — bridging the skill gap between education and industry.\n\n` +
                                `👉 Reply *1* for About options.\n` +
                                `👉 Reply *0* to return to Main Menu.`;

                } else if (lowerText === '1.3' || lowerText === '13' || lowerText.includes('methodology') || lowerText.includes('learning')) {
                    // Learning Methodology
                    replyText = `📖 *Learning Methodology*\n━━━━━━━━━━━━━━━━━\n\n` +
                                `• Project-based learning with live hands-on practice.\n` +
                                `• Individual mentorship and personalized guidance.\n` +
                                `• Active weekly assessments to track progress.\n` +
                                `• Professional portfolio building.\n` +
                                `• Lifetime career support & internship opportunities.\n\n` +
                                `👉 Reply *1* for About options.\n` +
                                `👉 Reply *0* to return to Main Menu.`;

                } else if (lowerText === '1.4' || lowerText === '14' || lowerText.includes('facilities') || lowerText.includes('lab') || lowerText.includes('wifi')) {
                    // Facilities details
                    replyText = `💻 *Campus Facilities — The Student Space*\n━━━━━━━━━━━━━━━━━\n\n` +
                                `• State-of-the-art computer lab with modern systems.\n` +
                                `• High-speed Wi-Fi internet access.\n` +
                                `• Fully air-conditioned classrooms.\n` +
                                `• Student discussion lounge.\n` +
                                `• Online recorded backup sessions of all classes.\n\n` +
                                `👉 Reply *1* for About options.\n` +
                                `👉 Reply *0* to return to Main Menu.`;

                } else if (lowerText === '1.5' || lowerText === '15' || lowerText.includes('address') || lowerText.includes('location') || lowerText.includes('landmark')) {
                    // Location details
                    replyText = `📍 *Branch Location & Address*\n━━━━━━━━━━━━━━━━━\n\n` +
                                `*Office Address:* W-003, Ground Floor, Haroon Royal City Phase 3, Block 17, Gulistan-e-Johar, Karachi.\n\n` +
                                `*Landmark:* Near Federal Urdu University / Continental Bakery.\n\n` +
                                `🗺️ *Google Maps:* https://maps.google.com/?q=The+Student+Space+Gulistan-e-Johar+Karachi\n\n` +
                                `👉 Reply *1* for About options.\n` +
                                `👉 Reply *0* to return to Main Menu.`;

                } else if (lowerText === '2' || lowerText === 'courses' || lowerText === 'programs' || lowerText === 'course' || lowerText === 'program') {
                    // Courses Sub-menu
                    replyText = `📚 *Courses & Programs — The Student Space*\n━━━━━━━━━━━━━━━━━\n` +
                                `Aap kis category ke courses dekhna chahte hain? Please choose:\n\n` +
                                `1️⃣ *AI & Technology* (Type *2.1*)\n` +
                                `2️⃣ *Career Programs* (Type *2.2*)\n` +
                                `3️⃣ *Academic Coaching* (Type *2.3*)\n` +
                                `4️⃣ *Other Programs* (Type *2.4*)\n\n` +
                                `👉 Option type karein (e.g. *2.1* or *AI*).\n` +
                                `👉 Reply *0* to return to Main Menu.`;

                } else if (lowerText === '2.1' || lowerText === '21' || lowerText === 'ai & technology') {
                    const { aiTech } = getGroupedCourses();
                    let msg = `🤖 *AI & Technology Courses*\n━━━━━━━━━━━━━━━━━\n\n`;
                    aiTech.forEach((c, idx) => {
                        msg += `${idx + 1}️⃣ *${c.name}* (Type *2.1.${idx + 1}*)\n`;
                    });
                    msg += `\n👉 Option type karein (e.g. *2.1.1*) to get details.\n` +
                           `👉 Reply *2* for Courses categories.\n` +
                           `👉 Reply *0* to return to Main Menu.`;
                    replyText = msg;

                } else if (lowerText === '2.2' || lowerText === '22' || lowerText === 'career programs') {
                    const { career } = getGroupedCourses();
                    let msg = `🚀 *Career Programs*\n━━━━━━━━━━━━━━━━━\n\n`;
                    career.forEach((c, idx) => {
                        msg += `${idx + 1}️⃣ *${c.name}* (Type *2.2.${idx + 1}*)\n`;
                    });
                    msg += `\n👉 Option type karein (e.g. *2.2.1*) to get details.\n` +
                           `👉 Reply *2* for Courses categories.\n` +
                           `👉 Reply *0* to return to Main Menu.`;
                    replyText = msg;

                } else if (lowerText === '2.3' || lowerText === '23' || lowerText === 'academic coaching' || lowerText === 'coaching') {
                    const { academic } = getGroupedCourses();
                    let msg = `📚 *Academic Coaching Programs*\n━━━━━━━━━━━━━━━━━\n\n`;
                    academic.forEach((c, idx) => {
                        msg += `${idx + 1}️⃣ *${c.name}* (Type *2.3.${idx + 1}*)\n`;
                    });
                    msg += `\n👉 Option type karein (e.g. *2.3.1*) to get details.\n` +
                           `👉 Reply *2* for Courses categories.\n` +
                           `👉 Reply *0* to return to Main Menu.`;
                    replyText = msg;

                } else if (lowerText === '2.4' || lowerText === '24' || lowerText === 'other programs') {
                    const { other } = getGroupedCourses();
                    let msg = `📖 *Other Programs*\n━━━━━━━━━━━━━━━━━\n\n`;
                    other.forEach((c, idx) => {
                        msg += `${idx + 1}️⃣ *${c.name}* (Type *2.4.${idx + 1}*)\n`;
                    });
                    msg += `\n👉 Option type karein (e.g. *2.4.1*) to get details.\n` +
                           `👉 Reply *2* for Courses categories.\n` +
                           `👉 Reply *0* to return to Main Menu.`;
                    replyText = msg;

                } else if (lowerText === '4' || lowerText === 'contact' || lowerText === 'phone' || lowerText === 'email' || lowerText === 'address') {
                    // Contact Info Sub-menu
                    replyText = `📬 *Contact Information — The Student Space*\n━━━━━━━━━━━━━━━━━\n` +
                                `Aap ko kaunsi contact details chahiye? Please choose:\n\n` +
                                `1️⃣ *Phone Number* (Type *4.1*)\n` +
                                `2️⃣ *WhatsApp Number* (Type *4.2*)\n` +
                                `3️⃣ *Email Address* (Type *4.3*)\n` +
                                `4️⃣ *Office Address & Landmark* (Type *4.4*)\n` +
                                `5️⃣ *Social Media Links* (Type *4.5*)\n\n` +
                                `👉 Option type karein (e.g. *4.1* or *WhatsApp*).\n` +
                                `👉 Reply *0* to return to Main Menu.`;

                } else if (lowerText === '4.1' || lowerText === '41' || lowerText === 'phone number') {
                    replyText = `📞 *Phone Number — The Student Space*\n━━━━━━━━━━━━━━━━━\n\n` +
                                `Aap humein is number par call kar sakte hain:\n` +
                                `👉 *0322 1761566*\n\n` +
                                `👉 Reply *4* for other Contact options.\n` +
                                `👉 Reply *0* to return to Main Menu.`;

                } else if (lowerText === '4.2' || lowerText === '42' || lowerText === 'whatsapp number') {
                    replyText = `💬 *WhatsApp — The Student Space*\n━━━━━━━━━━━━━━━━━\n\n` +
                                `Aap is official WhatsApp chat par message kar sakte hain:\n` +
                                `👉 *0322 1761566*\n\n` +
                                `👉 Reply *4* for other Contact options.\n` +
                                `👉 Reply *0* to return to Main Menu.`;

                } else if (lowerText === '4.3' || lowerText === '43' || lowerText === 'email address') {
                    replyText = `✉️ *Email Address — The Student Space*\n━━━━━━━━━━━━━━━━━\n\n` +
                                `Aap humein email send kar sakte hain:\n` +
                                `👉 *info@thestudentspace.com*\n\n` +
                                `👉 Reply *4* for other Contact options.\n` +
                                `👉 Reply *0* to return to Main Menu.`;

                } else if (lowerText === '4.4' || lowerText === '44' || lowerText === 'office address') {
                    replyText = `📍 *Office Address — The Student Space*\n━━━━━━━━━━━━━━━━━\n\n` +
                                `*Address:* W-003, Ground Floor, Haroon Royal City Phase 3, Block 17, Gulistan-e-Johar, Karachi.\n\n` +
                                `*Landmark:* Near Federal Urdu University / Continental Bakery.\n` +
                                `🗺️ *Google Maps:* https://maps.google.com/?q=The+Student+Space+Gulistan-e-Johar+Karachi\n\n` +
                                `👉 Reply *4* for other Contact options.\n` +
                                `👉 Reply *0* to return to Main Menu.`;

                } else if (lowerText === '4.5' || lowerText === '45' || lowerText === 'social media') {
                    replyText = `🌐 *Social Media Links — The Student Space*\n━━━━━━━━━━━━━━━━━\n\n` +
                                `Humare social channels follow/visit karein:\n` +
                                `• *Facebook:* https://facebook.com/thestudentspace\n` +
                                `• *Instagram:* https://instagram.com/thestudentspace\n` +
                                `• *LinkedIn:* https://linkedin.com/company/thestudentspace\n\n` +
                                `👉 Reply *4* for other Contact options.\n` +
                                `👉 Reply *0* to return to Main Menu.`;

                } else if (lowerText === '5' || lowerText === 'fee' || lowerText === 'fees' || lowerText === 'charges') {
                    // Fee Details Sub-menu
                    replyText = `💰 *Fee Structures — The Student Space*\n━━━━━━━━━━━━━━━━━\n` +
                                `Aap kis category ke courses ki fees check karna chahte hain? Please choose:\n\n` +
                                `1️⃣ *AI & Technology Fees* (Type *5.1*)\n` +
                                `2️⃣ *Career Programs Fees* (Type *5.2*)\n` +
                                `3️⃣ *Academic Coaching Fees* (Type *5.3*)\n` +
                                `4️⃣ *Other Programs Fees* (Type *5.4*)\n\n` +
                                `👉 Option type karein (e.g. *5.1* or *Fees*).\n` +
                                `👉 Reply *0* to return to Main Menu.`;

                } else if (lowerText === '5.1' || lowerText === '51') {
                    const { aiTech } = getGroupedCourses();
                    let msg = `💰 *AI & Technology — Fee Structure*\n━━━━━━━━━━━━━━━━━\n\n`;
                    aiTech.forEach((c, idx) => {
                        msg += `${idx + 1}️⃣ *${c.name}* (Type *5.1.${idx + 1}*)\n`;
                    });
                    msg += `\n👉 Option type karein (e.g. *5.1.1*) to see fees.\n` +
                           `👉 Reply *5* for Fee categories.\n` +
                           `👉 Reply *0* to return to Main Menu.`;
                    replyText = msg;

                } else if (lowerText === '5.2' || lowerText === '52') {
                    const { career } = getGroupedCourses();
                    let msg = `🚀 *Career Programs — Fee Structure*\n━━━━━━━━━━━━━━━━━\n\n`;
                    career.forEach((c, idx) => {
                        msg += `${idx + 1}️⃣ *${c.name}* (Type *5.2.${idx + 1}*)\n`;
                    });
                    msg += `\n👉 Option type karein (e.g. *5.2.1*) to see fees.\n` +
                           `👉 Reply *5* for Fee categories.\n` +
                           `👉 Reply *0* to return to Main Menu.`;
                    replyText = msg;

                } else if (lowerText === '5.3' || lowerText === '53') {
                    const { academic } = getGroupedCourses();
                    let msg = `📚 *Academic Coaching — Fee Structure*\n━━━━━━━━━━━━━━━━━\n\n`;
                    academic.forEach((c, idx) => {
                        msg += `${idx + 1}️⃣ *${c.name}* (Type *5.3.${idx + 1}*)\n`;
                    });
                    msg += `\n👉 Option type karein (e.g. *5.3.1*) to see fees.\n` +
                           `👉 Reply *5* for Fee categories.\n` +
                           `👉 Reply *0* to return to Main Menu.`;
                    replyText = msg;

                } else if (lowerText === '5.4' || lowerText === '54') {
                    const { other } = getGroupedCourses();
                    let msg = `📖 *Other Programs — Fee Structure*\n━━━━━━━━━━━━━━━━━\n\n`;
                    other.forEach((c, idx) => {
                        msg += `${idx + 1}️⃣ *${c.name}* (Type *5.4.${idx + 1}*)\n`;
                    });
                    msg += `\n👉 Option type karein (e.g. *5.4.1*) to see fees.\n` +
                           `👉 Reply *5* for Fee categories.\n` +
                           `👉 Reply *0* to return to Main Menu.`;
                    replyText = msg;

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
                    // Check if they are asking about a specific course via hierarchical sub-option (e.g. 2.1.1 or 211)
                    const cleanText = text.trim();
                    const cleanInput = cleanText.replace(/[^0-9]/g, '');
                    let matchedCourse = null;
                    let isFeeDetailsQuery = false;
                    let parentCategoryIdx = null;

                    if (cleanInput.length === 3 && (cleanInput.startsWith('2') || cleanInput.startsWith('5'))) {
                        const actionType = cleanInput[0]; // '2' or '5'
                        const catIdx = parseInt(cleanInput[1], 10); // 1 = aiTech, 2 = career, 3 = academic, 4 = other
                        const courseIdx = parseInt(cleanInput[2], 10) - 1;
                        parentCategoryIdx = catIdx;

                        const { aiTech, career, academic, other } = getGroupedCourses();
                        let selectedList = [];
                        if (catIdx === 1) selectedList = aiTech;
                        else if (catIdx === 2) selectedList = career;
                        else if (catIdx === 3) selectedList = academic;
                        else if (catIdx === 4) selectedList = other;

                        if (courseIdx >= 0 && courseIdx < selectedList.length) {
                            matchedCourse = selectedList[courseIdx];
                            if (actionType === '5') {
                                isFeeDetailsQuery = true;
                            }
                        }
                    } else if (cleanText.includes('.')) {
                        const parts = cleanText.split('.');
                        if (parts.length === 3 && (parts[0] === '2' || parts[0] === '5')) {
                            const actionType = parts[0];
                            const catIdx = parseInt(parts[1], 10);
                            const courseIdx = parseInt(parts[2], 10) - 1;
                            parentCategoryIdx = catIdx;

                            const { aiTech, career, academic, other } = getGroupedCourses();
                            let selectedList = [];
                            if (catIdx === 1) selectedList = aiTech;
                            else if (catIdx === 2) selectedList = career;
                            else if (catIdx === 3) selectedList = academic;
                            else if (catIdx === 4) selectedList = other;

                            if (courseIdx >= 0 && courseIdx < selectedList.length) {
                                matchedCourse = selectedList[courseIdx];
                                if (actionType === '5') {
                                    isFeeDetailsQuery = true;
                                }
                            }
                        }
                    }

                    if (matchedCourse) {
                        if (isFeeDetailsQuery) {
                            replyText = `💰 *${matchedCourse.name} — Fee Structure*\n━━━━━━━━━━━━━━━━━\n\n` +
                                        `💵 *Total Course Fee:* ${matchedCourse.fee}\n` +
                                        `💳 *Monthly Installment:* ${matchedCourse.installment}\n` +
                                        `⏱️ *Duration:* ${matchedCourse.duration}\n\n` +
                                        `👉 Reply *5.${parentCategoryIdx}* for this category's fees.\n` +
                                        `👉 Reply *0* to return to Main Menu.`;
                        } else {
                            replyText = `📚 *${matchedCourse.name}*\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                        `📖 *Description:* ${matchedCourse.description}\n\n` +
                                        `⏱️ *Duration:* ${matchedCourse.duration}\n` +
                                        `💰 *Total Fee:* ${matchedCourse.fee}\n` +
                                        `💳 *Installment:* ${matchedCourse.installment}\n` +
                                        `📅 *Schedule:* ${matchedCourse.schedule}\n` +
                                        `💼 *Career Opportunities:* ${matchedCourse.careerOpportunities}\n\n` +
                                        `👉 Reply *2.${parentCategoryIdx}* for this category's list.\n` +
                                        `👉 Reply *3* or *Apply* to Enroll in this course.\n` +
                                        `👉 Reply *0* to return to the Main Menu.`;
                        }
                    } else {
                        // Otherwise, match by course name or index number (Option 2 fallback / search)
                        const ordered = getOrderedCourses();
                        const num = parseInt(cleanText, 10);
                        let matchedCourseSearch = null;

                        if (!isNaN(num) && num > 0 && num <= ordered.length) {
                            matchedCourseSearch = ordered[num - 1];
                        } else {
                            matchedCourseSearch = ordered.find(c => {
                                const cName = c.name.toLowerCase();
                                return lowerText === cName || 
                                       lowerText === `${cName} details` || 
                                       lowerText === `${cName} fee` || 
                                       lowerText === `${cName} fees` || 
                                       lowerText === `details of ${cName}` || 
                                       lowerText === `fee of ${cName}`;
                            });
                        }

                        if (matchedCourseSearch) {
                            replyText = `📚 *${matchedCourseSearch.name}*\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                        `📖 *Description:* ${matchedCourseSearch.description}\n\n` +
                                        `⏱️ *Duration:* ${matchedCourseSearch.duration}\n` +
                                        `💰 *Total Fee:* ${matchedCourseSearch.fee}\n` +
                                        `💳 *Installment:* ${matchedCourseSearch.installment}\n` +
                                        `📅 *Schedule:* ${matchedCourseSearch.schedule}\n` +
                                        `💼 *Career Opportunities:* ${matchedCourseSearch.careerOpportunities}\n\n` +
                                        `👉 To enroll in this course, reply with *3* or *Apply*.\n` +
                                        `👉 Reply *0* to return to the Main Menu.`;
                        } else {
                            // Fallback: Let Gemini AI handle the query
                            replyText = await getAIResponse(text, chatHistory, conv);
                        }
                    }
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
