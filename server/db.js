const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure database files exist
function initDB() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const schemas = {
        'leads.json': [],
        'registrations.json': [],
        'conversations.json': [],
        'courses.json': getDefaultCourses(),
        'settings.json': {
            botActive: true,
            greetingText: "Welcome to The Student Space Institute!",
            escalationContact: "+92 322 1761566"
        }
    };

    for (const [filename, defaultData] of Object.entries(schemas)) {
        const filePath = path.join(DATA_DIR, filename);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
        }
    }
}

function getDefaultCourses() {
    return [
        // ===== AI & TECHNOLOGY =====
        {
            id: "course-1",
            name: "Generative AI",
            duration: "2 Months",
            fee: "15,000 PKR",
            installment: "7,500 PKR/Month",
            schedule: "Saturday & Sunday (10:00 AM - 12:00 PM)",
            days: ["Sat", "Sun"],
            timings: "Morning",
            description: "Master Generative AI tools including ChatGPT, Midjourney, DALL-E, Stable Diffusion, and prompt engineering to automate tasks and build AI-powered content pipelines.",
            careerOpportunities: "AI Content Creator, Prompt Engineer, AI Consultant, AI Tools Trainer"
        },
        {
            id: "course-2",
            name: "Agentic AI",
            duration: "3 Months",
            fee: "20,000 PKR",
            installment: "7,000 PKR/Month",
            schedule: "Saturday & Sunday (12:00 PM - 02:00 PM)",
            days: ["Sat", "Sun"],
            timings: "Afternoon",
            description: "Build autonomous AI agents using LangChain, AutoGen, CrewAI, and OpenAI APIs. Learn to design multi-agent systems, tool calling, and real-world automation pipelines.",
            careerOpportunities: "AI Agent Developer, LLM Engineer, Automation Engineer, AI Systems Architect"
        },
        {
            id: "course-3",
            name: "Web Development",
            duration: "6 Months",
            fee: "30,000 PKR",
            installment: "5,000 PKR/Month",
            schedule: "Saturday & Sunday (04:00 PM - 06:00 PM)",
            days: ["Sat", "Sun"],
            timings: "Evening",
            description: "Master HTML5, CSS3, JavaScript, React.js, Node.js, Express, and MongoDB. Build full-stack responsive web applications and deploy them to the cloud.",
            careerOpportunities: "Full Stack Developer, Frontend Engineer, Backend Developer, Web Designer"
        },
        {
            id: "course-4",
            name: "App Development",
            duration: "4 Months",
            fee: "25,000 PKR",
            installment: "6,250 PKR/Month",
            schedule: "Saturday & Sunday (01:00 PM - 03:00 PM)",
            days: ["Sat", "Sun"],
            timings: "Afternoon",
            description: "Build beautiful native iOS and Android applications using Flutter and Dart with Firebase backend integration and app store deployment.",
            careerOpportunities: "Flutter Developer, Mobile App Developer, iOS/Android Developer"
        },
        {
            id: "course-5",
            name: "Graphic Designing",
            duration: "3 Months",
            fee: "18,000 PKR",
            installment: "6,000 PKR/Month",
            schedule: "Tuesday & Thursday (06:00 PM - 07:30 PM)",
            days: ["Tue", "Thu"],
            timings: "Evening",
            description: "Learn visual hierarchy, typography, color theory, branding, and master Adobe Photoshop, Illustrator, and Figma for professional design and UI/UX.",
            careerOpportunities: "Graphic Designer, Brand Designer, UI/UX Designer, Illustrator"
        },
        {
            id: "course-6",
            name: "Digital Marketing",
            duration: "3 Months",
            fee: "15,000 PKR",
            installment: "5,000 PKR/Month",
            schedule: "Monday & Wednesday (06:00 PM - 07:30 PM)",
            days: ["Mon", "Wed"],
            timings: "Evening",
            description: "Master SEO, social media marketing, Google Ads, Facebook Ads, content marketing, email campaigns, and digital branding strategies.",
            careerOpportunities: "Digital Marketer, SEO Specialist, Social Media Manager, Content Strategist"
        },
        {
            id: "course-7",
            name: "YouTube Automation",
            duration: "2 Months",
            fee: "12,000 PKR",
            installment: "6,000 PKR/Month",
            schedule: "Saturday (02:00 PM - 04:00 PM)",
            days: ["Sat"],
            timings: "Afternoon",
            description: "Learn how to build and scale faceless YouTube channels using AI tools, automated video creation, scriptwriting, voiceover, and monetization strategies.",
            careerOpportunities: "YouTube Creator, Content Automation Expert, Digital Entrepreneur"
        },
        {
            id: "course-8",
            name: "Amazon FBA",
            duration: "2 Months",
            fee: "18,000 PKR",
            installment: "9,000 PKR/Month",
            schedule: "Sunday (10:00 AM - 01:00 PM)",
            days: ["Sun"],
            timings: "Morning",
            description: "Learn how to launch and scale a profitable Amazon FBA business: product research, sourcing, listing optimization, PPC advertising, and inventory management.",
            careerOpportunities: "Amazon Seller, E-Commerce Entrepreneur, FBA Specialist, Product Sourcing Expert"
        },
        {
            id: "course-9",
            name: "3D Animation",
            duration: "4 Months",
            fee: "22,000 PKR",
            installment: "5,500 PKR/Month",
            schedule: "Monday & Wednesday (04:00 PM - 06:00 PM)",
            days: ["Mon", "Wed"],
            timings: "Evening",
            description: "Master Blender and Maya to create stunning 3D models, characters, animations, visual effects (VFX), and cinematic renders for film and game industries.",
            careerOpportunities: "3D Artist, VFX Designer, Game Asset Creator, Motion Graphics Artist"
        },
        // ===== TECH & CAREER PROGRAMS =====
        {
            id: "course-10",
            name: "Freelancing Masterclass",
            duration: "1 Month",
            fee: "8,000 PKR",
            installment: "Full Payment",
            schedule: "Saturday (11:00 AM - 01:00 PM)",
            days: ["Sat"],
            timings: "Morning",
            description: "Launch your freelancing career on Upwork, Fiverr, and Freelancer.com. Learn profile optimization, proposal writing, client communication, and payment management.",
            careerOpportunities: "Freelancer, Remote Worker, Digital Entrepreneur"
        },
        {
            id: "course-11",
            name: "Computer Fundamentals",
            duration: "1 Month",
            fee: "5,000 PKR",
            installment: "Full Payment",
            schedule: "Monday to Friday (08:00 AM - 09:00 AM)",
            days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
            timings: "Morning",
            description: "Learn the basics of computers including hardware, software, operating systems, internet usage, email, file management, and basic troubleshooting.",
            careerOpportunities: "Office Staff, Data Entry Operator, IT Support"
        },
        {
            id: "course-12",
            name: "Office Automation (MS Office)",
            duration: "2 Months",
            fee: "8,000 PKR",
            installment: "4,000 PKR/Month",
            schedule: "Monday to Friday (09:00 AM - 10:00 AM)",
            days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
            timings: "Morning",
            description: "Master Microsoft Word, Excel, PowerPoint, and Outlook. Learn advanced Excel formulas, data analysis, professional document formatting, and presentation design.",
            careerOpportunities: "Office Administrator, Data Entry Specialist, Executive Assistant, Accountant"
        },
        {
            id: "course-13",
            name: "Programming for Beginners",
            duration: "2 Months",
            fee: "10,000 PKR",
            installment: "5,000 PKR/Month",
            schedule: "Saturday & Sunday (09:00 AM - 11:00 AM)",
            days: ["Sat", "Sun"],
            timings: "Morning",
            description: "Start your coding journey with Python fundamentals: variables, loops, functions, OOP, and small project building. No prior experience required.",
            careerOpportunities: "Junior Developer, Coding Bootcamp Graduate, Tech Enthusiast"
        },
        {
            id: "course-14",
            name: "AI Tools for Students",
            duration: "1 Month",
            fee: "6,000 PKR",
            installment: "Full Payment",
            schedule: "Saturday (03:00 PM - 05:00 PM)",
            days: ["Sat"],
            timings: "Afternoon",
            description: "Empower your studies with AI: use ChatGPT for research, Notion AI for notes, Grammarly for writing, and AI image tools for presentations and projects.",
            careerOpportunities: "Productive Student, Research Assistant, Academic AI User"
        },
        // ===== ACADEMIC COACHING =====
        {
            id: "course-15",
            name: "Grade 5 Coaching",
            duration: "Ongoing",
            fee: "4,000 PKR/Month",
            installment: "Monthly",
            schedule: "Monday to Friday (02:00 PM - 03:30 PM)",
            days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
            timings: "Afternoon",
            description: "Comprehensive coaching for Grade 5 students covering all core subjects: Maths, Science, English, Urdu, and Islamiyat with exam preparation and homework help.",
            careerOpportunities: "Academic Excellence, Strong Foundation, Exam Success"
        },
        {
            id: "course-16",
            name: "Grade 6 Coaching",
            duration: "Ongoing",
            fee: "4,000 PKR/Month",
            installment: "Monthly",
            schedule: "Monday to Friday (02:00 PM - 03:30 PM)",
            days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
            timings: "Afternoon",
            description: "Comprehensive coaching for Grade 6 students covering all core subjects: Maths, Science, English, Urdu, and Islamiyat with exam preparation and homework help.",
            careerOpportunities: "Academic Excellence, Strong Foundation, Exam Success"
        },
        {
            id: "course-17",
            name: "Grade 7 Coaching",
            duration: "Ongoing",
            fee: "4,500 PKR/Month",
            installment: "Monthly",
            schedule: "Monday to Friday (03:30 PM - 05:00 PM)",
            days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
            timings: "Afternoon",
            description: "Expert coaching for Grade 7 students in all key subjects including Mathematics, General Science, English, Urdu, Social Studies, and Islamiyat.",
            careerOpportunities: "Academic Excellence, Exam Readiness, Strong Conceptual Foundation"
        },
        {
            id: "course-18",
            name: "Grade 8 Coaching",
            duration: "Ongoing",
            fee: "4,500 PKR/Month",
            installment: "Monthly",
            schedule: "Monday to Friday (03:30 PM - 05:00 PM)",
            days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
            timings: "Afternoon",
            description: "Expert coaching for Grade 8 students with a strong focus on Mathematics, General Science, English, Urdu, Social Studies, and Board Exam preparation.",
            careerOpportunities: "Academic Excellence, Exam Readiness, Board Exam Prep"
        },
        {
            id: "course-19",
            name: "Grade 9 Coaching",
            duration: "Ongoing",
            fee: "5,000 PKR/Month",
            installment: "Monthly",
            schedule: "Monday to Friday (05:00 PM - 07:00 PM)",
            days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
            timings: "Evening",
            description: "Targeted coaching for Grade 9 / SSC-I students in Physics, Chemistry, Biology / Computer, Mathematics, English, and Urdu with past paper practice.",
            careerOpportunities: "Board Exam Excellence, SSC Result Improvement, Academic Foundation"
        },
        {
            id: "course-20",
            name: "Grade 10 Coaching",
            duration: "Ongoing",
            fee: "5,500 PKR/Month",
            installment: "Monthly",
            schedule: "Monday to Friday (05:00 PM - 07:00 PM)",
            days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
            timings: "Evening",
            description: "Intensive Matric / SSC-II coaching for Grade 10 students with full syllabus coverage, past paper practice, mock exams, and exam stress management.",
            careerOpportunities: "Matric Board Distinction, University Entry Preparation"
        }
    ];
}

// Read helper
function readTable(filename) {
    const filePath = path.join(DATA_DIR, filename);
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error reading database file: ${filename}`, err);
        return [];
    }
}

// Write helper (Sync for atomic safety)
function writeTable(filename, data) {
    const filePath = path.join(DATA_DIR, filename);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error(`Error writing database file: ${filename}`, err);
    }
}

// Database Actions
const db = {
    init: initDB,

    // Leads
    getLeads: () => readTable('leads.json'),
    addLead: (lead) => {
        const leads = readTable('leads.json');
        const newLead = {
            id: 'lead-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            name: lead.name || '',
            phone: lead.phone || '',
            course: lead.course || '',
            status: lead.status || 'New', // New, Contacted, Converted, Junk
            createdAt: lead.createdAt || new Date().toISOString()
        };
        leads.push(newLead);
        writeTable('leads.json', leads);
        return newLead;
    },
    updateLead: (id, updates) => {
        const leads = readTable('leads.json');
        const idx = leads.findIndex(l => l.id === id);
        if (idx !== -1) {
            leads[idx] = { ...leads[idx], ...updates };
            writeTable('leads.json', leads);
            return leads[idx];
        }
        return null;
    },
    deleteLead: (id) => {
        const leads = readTable('leads.json');
        const filtered = leads.filter(l => l.id !== id);
        writeTable('leads.json', filtered);
        return true;
    },

    // Registrations
    getRegistrations: () => readTable('registrations.json'),
    addRegistration: (reg) => {
        const regs = readTable('registrations.json');
        const newReg = {
            studentId: reg.studentId || 'TSS-' + Date.now().toString().slice(-6),
            fullName: reg.fullName || '',
            fatherName: reg.fatherName || '',
            cnic: reg.cnic || '',
            dob: reg.dob || '',
            gender: reg.gender || '',
            nationality: reg.nationality || '',
            religion: reg.religion || '',
            phone: reg.phone || '',
            whatsapp: reg.whatsapp || '',
            email: reg.email || '',
            address: reg.address || '',
            city: reg.city || '',
            postalCode: reg.postalCode || '',
            qualification: reg.qualification || '',
            school: reg.school || '',
            passingYear: reg.passingYear || '',
            marks: reg.marks || '',
            course: reg.course || '',
            batch: reg.batch || '',
            preferredDays: reg.preferredDays || '',
            reference: reg.reference || '',
            emergencyName: reg.emergencyName || '',
            relationship: reg.relationship || '',
            emergencyPhone: reg.emergencyPhone || '',
            alternatePhone: reg.alternatePhone || '',
            emergencyAddress: reg.emergencyAddress || '',
            generatedPdf: reg.generatedPdf || '',
            generatedImage: reg.generatedImage || '',
            createdAt: reg.createdAt || new Date().toISOString()
        };
        regs.push(newReg);
        writeTable('registrations.json', regs);
        return newReg;
    },
    updateRegistration: (studentId, updates) => {
        const regs = readTable('registrations.json');
        const idx = regs.findIndex(r => r.studentId === studentId);
        if (idx !== -1) {
            regs[idx] = { ...regs[idx], ...updates };
            writeTable('registrations.json', regs);
            return regs[idx];
        }
        return null;
    },
    deleteRegistration: (studentId) => {
        const regs = readTable('registrations.json');
        const filtered = regs.filter(r => r.studentId !== studentId);
        writeTable('registrations.json', filtered);
        return true;
    },

    // Conversations & Message History
    getConversations: () => readTable('conversations.json'),
    getConversation: (phone) => {
        const convs = readTable('conversations.json');
        return convs.find(c => c.phone === phone);
    },
    saveMessage: (phone, name, msg) => {
        const convs = readTable('conversations.json');
        let conv = convs.find(c => c.phone === phone);
        const timestamp = new Date().toISOString();

        const formattedMsg = {
            id: 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            sender: msg.sender || 'student', // 'student' or 'assistant'
            text: msg.text || '',
            timestamp
        };

        if (!conv) {
            conv = {
                phone,
                name: name || phone,
                messages: [formattedMsg],
                intent: msg.intent || 'None',
                registrationStatus: 'Idle', // Idle, Active, Completed
                activeStep: -1,
                collectedData: {},
                lastMessageTime: timestamp,
                totalMessages: 1
            };
            convs.push(conv);
        } else {
            conv.messages.push(formattedMsg);
            // Cap history to last 50 messages to prevent database swelling
            if (conv.messages.length > 50) conv.messages.shift();
            conv.name = name || conv.name;
            if (msg.intent) conv.intent = msg.intent;
            conv.lastMessageTime = timestamp;
            conv.totalMessages = (conv.totalMessages || 0) + 1;
        }

        writeTable('conversations.json', convs);
        return conv;
    },
    updateConversationStatus: (phone, updates) => {
        const convs = readTable('conversations.json');
        const idx = convs.findIndex(c => c.phone === phone);
        if (idx !== -1) {
            convs[idx] = { ...convs[idx], ...updates };
            writeTable('conversations.json', convs);
            return convs[idx];
        }
        return null;
    },

    // Courses
    getCourses: () => readTable('courses.json'),
    saveCourse: (course) => {
        const courses = readTable('courses.json');
        const idx = courses.findIndex(c => c.id === course.id);
        if (idx !== -1) {
            courses[idx] = { ...courses[idx], ...course };
        } else {
            course.id = 'course-' + Date.now();
            courses.push(course);
        }
        writeTable('courses.json', courses);
        return course;
    },
    deleteCourse: (id) => {
        const courses = readTable('courses.json');
        const filtered = courses.filter(c => c.id !== id);
        writeTable('courses.json', filtered);
        return true;
    },

    // Settings
    getSettings: () => readTable('settings.json'),
    saveSettings: (settings) => {
        writeTable('settings.json', settings);
        return settings;
    },

    // Analytics
    getAnalytics: () => {
        const convs = readTable('conversations.json');
        const regs = readTable('registrations.json');
        const leads = readTable('leads.json');

        // Most asked questions based on message content intents (mock logic or parsed intent aggregation)
        const intentCounts = {};
        convs.forEach(c => {
            if (c.intent && c.intent !== 'None') {
                intentCounts[c.intent] = (intentCounts[c.intent] || 0) + 1;
            }
        });
        const sortedIntents = Object.entries(intentCounts)
            .sort((a, b) => b[1] - a[1])
            .map(e => e[0]);

        // Daily/monthly leads calculation
        const now = new Date();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const oneMonthMs = 30 * oneDayMs;

        const dailyLeads = leads.filter(l => (now - new Date(l.createdAt)) < oneDayMs).length;
        const monthlyLeads = leads.filter(l => (now - new Date(l.createdAt)) < oneMonthMs).length;

        // Pending admissions (registration state is active or completed but not approved in admin)
        // Let's assume registrations with pending field or all registrations are completed
        const totalAdmissions = regs.length;
        const pendingAdmissions = convs.filter(c => c.registrationStatus === 'Active').length;

        return {
            totalConversations: convs.length,
            totalAdmissions,
            pendingAdmissions,
            activeUsers: convs.filter(c => (now - new Date(c.lastMessageTime)) < (7 * oneDayMs)).length,
            dailyLeads,
            monthlyLeads,
            mostAskedQuestions: sortedIntents.slice(0, 5)
        };
    }
};

db.init();

module.exports = db;
