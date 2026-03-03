
let testVault = []; // Temporary storage until we add Firebase
let performanceLogs = []; // NEW: Stores past attempts
let testData = null;
let allQuestions = [];
let sectionsData = []; // To store our dynamically generated sections
let currentQuestionIndex = 0;
let questionStates = {}; 
let userAnswers = {};
let examInterval = null;
let timeSpentOnQuestion = {}; // Tracks seconds spent per question
let currentQuestionStartTime = 0; // Timestamp when question loaded
let potentialChartInstance = null; // For destroying old charts

// ================= Navigation Logic =================
// ================= FIREBASE SETUP =================
// 🚨 PASTE YOUR REAL KEYS HERE 🚨

const firebaseConfig = {
  apiKey: "AIzaSyC0wJVy_nnn-pOzrg7NE7AYs4us3PYUgp0",
  authDomain: "anvesham-b15bb.firebaseapp.com",
  projectId: "anvesham-b15bb",
  storageBucket: "anvesham-b15bb.firebasestorage.app",
  messagingSenderId: "24525721800",
  appId: "1:24525721800:web:04797a34f45f7bee13d5fd"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global User Object
let currentUser = null;

// ================= AUTHENTICATION LOGIC =================

// 1. Listen for Login State Changes (Runs automatically when page loads)
// 1. Listen for Login State Changes
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is logged in!
        currentUser = user;
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('user-dashboard-section').style.display = 'block';
        
        document.getElementById('dash-username').innerText = user.displayName;
        document.querySelector('.user-greeting .avatar').innerHTML = `<img src="${user.photoURL}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        
        // ================= NEW: FETCH FROM FIRESTORE =================
    // Fetch User's Test Vault
        db.collection('users').doc(user.uid).collection('vault').get().then((querySnapshot) => {
            testVault = [];
            querySnapshot.forEach((doc) => {
                let data = doc.data();
                data.docId = doc.id; // 🚨 NEW: Capture the specific database ID!
                testVault.push(data);
            });
            updateVaultUI();
        });

       // Fetch User's Performance Logs
        db.collection('users').doc(user.uid).collection('logs').get().then((querySnapshot) => {
            performanceLogs = [];
            querySnapshot.forEach((doc) => {
                let data = doc.data();
                // CRITICAL FIX: We must capture the database ID so we can find the chunks later!
                data.docId = doc.id; 
                performanceLogs.push(data);
            });
            updatePerformanceLogsUI();
        });
        // ==============================================================

    } else {
        // User is logged out
        currentUser = null;
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('user-dashboard-section').style.display = 'none';
    }
});

// 2. Google Login Button Click
document.getElementById('btn-google-login').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => {
        console.error("Login Failed: ", error);
        alert("Login Failed: " + error.message);
    });
});

// 3. Logout Button Click
document.getElementById('btn-logout').addEventListener('click', () => {
    auth.signOut().then(() => {
        // Refresh the page to completely reset the app state
        window.location.reload(); 
    }).catch((error) => {
        console.error("Logout Error:", error);
    });
});

function showScreen(screenId) {
    document.querySelectorAll('.app-screen').forEach(el => el.classList.remove('active-screen'));
    document.getElementById(screenId).classList.add('active-screen');
}
// ================= Screen 1: File Upload & Dashboard Logic =================
// ================= NEW MULTI-SECTION TEST COMPILER =================
// ================= NEW MULTI-SECTION TEST COMPILER =================

// 0. Make the default pre-made rows removable
document.querySelectorAll('.builder-row .btn-remove-sec').forEach(btn => {
    btn.onclick = function() { this.closest('.builder-row').remove(); };
});

// 1. Add new empty section rows dynamically...
// (Keep your existing btn-add-section code here)

// 1. Add new empty section rows dynamically
document.getElementById('btn-add-section').addEventListener('click', () => {
    const container = document.getElementById('builder-sections-container');
    const row = document.createElement('div');
    row.className = 'builder-row';
    row.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';
    row.innerHTML = `
        <input type="text" class="sec-name-input" placeholder="Section Name" style="width: 150px; padding: 8px 12px; border-radius: 4px; border: none; background: #334155; color: white;">
        <input type="file" class="sec-file-input" accept=".json" style="color: #94A3B8;">
        <button class="btn-remove-sec" style="background: transparent; border: none; color: #EF4444; cursor: pointer;" title="Remove"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(row);
    row.querySelector('.btn-remove-sec').onclick = () => row.remove();
});

// 2. Compile all files into one master test and save
document.getElementById('btn-compile-test').addEventListener('click', async () => {
    const title = document.getElementById('builder-test-title').value || 'Custom Mock Test';
    const duration = parseInt(document.getElementById('builder-test-duration').value) || 180;
    
    const rows = document.querySelectorAll('.builder-row');
    let compiledQuestions = [];
    let sectionsToSave = []; // NEW: Array to hold the separated subject files
    let hasError = false;

    const readFile = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(e);
        reader.readAsText(file);
    });

    document.getElementById('btn-compile-test').innerText = "Compiling...";

    for (let row of rows) {
        const secName = row.querySelector('.sec-name-input').value.trim() || 'Unnamed Section';
        const fileInput = row.querySelector('.sec-file-input');
        
        if (fileInput.files.length > 0) {
            try {
                const fileContent = await readFile(fileInput.files[0]);
                const parsed = JSON.parse(fileContent);
                let qs = parsed.questions || parsed; 
                
                if (Array.isArray(qs)) {
                    qs.forEach(q => q.subject = secName);
                    // Keep the chunk separated for the database!
                    sectionsToSave.push({ subject: secName, questions: qs });
                    compiledQuestions.push(...qs);
                }
            } catch (e) {
                alert(`Error parsing JSON for section: ${secName}`);
                hasError = true;
            }
        }
    }

    if (hasError || compiledQuestions.length === 0) {
        document.getElementById('btn-compile-test').innerText = "Compile & Save Test";
        if(compiledQuestions.length === 0) alert("Please upload at least one valid JSON file.");
        return;
    }

    document.getElementById('btn-compile-test').innerText = "Uploading to Database...";

    // NEW: We do NOT put 'questions' in the main doc anymore to avoid the 1MB limit
    const finalTestData = { 
        title: title, 
        duration: duration, 
        isMultiDoc: true, 
        qCount: compiledQuestions.length 
    };

    if (currentUser) {
        db.collection('users').doc(currentUser.uid).collection('vault').add(finalTestData)
        .then(async (docRef) => {
            finalTestData.docId = docRef.id; 
            
            // MAGIC FIX: Loop through each subject file (800kb each) and save them as separate docs!
            for (let sec of sectionsToSave) {
                await db.collection('users').doc(currentUser.uid).collection('vault').doc(docRef.id).collection('sections').add(sec);
            }
            
            finalTestData.questions = compiledQuestions; // Keep in memory for immediate play
            testVault.push(finalTestData);
            updateVaultUI();
            
            document.getElementById('btn-compile-test').innerText = "Compile & Save Test";
            alert(`"${title}" successfully compiled and saved to Vault!`);
        }).catch(err => {
            console.error("Error:", err);
            alert("Upload failed. Check console.");
            document.getElementById('btn-compile-test').innerText = "Compile & Save Test";
        });
    } else {
        finalTestData.questions = compiledQuestions;
        testVault.push(finalTestData);
        updateVaultUI();
        document.getElementById('btn-compile-test').innerText = "Compile & Save Test";
        alert(`"${title}" compiled temporarily (Guest Mode).`);
    }
    
    document.getElementById('builder-test-title').value = '';
    rows.forEach(r => r.querySelector('.sec-file-input').value = '');
});
// Refreshes the Test Vault UI in the Dashboard
function updateVaultUI() {
    const vaultList = document.getElementById('db-test-list');
    vaultList.innerHTML = '';
    if (testVault.length === 0) {
        vaultList.innerHTML = `<li class="db-item-glass empty-state">Vault is currently empty.</li>`;
        return;
    }

    testVault.forEach((test, index) => {
        const title = test.title || `Mock Test ${index + 1}`;
        // NEW: Check for qCount because the giant array is now stored safely on the backend
        const qCount = test.questions ? test.questions.length : (test.qCount || 0);

        const li = document.createElement('li');
        li.className = 'db-item-glass';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';

        li.innerHTML = `
            <div style="flex:1;">
                <strong style="display:block; margin-bottom: 5px; color: white;">${title}</strong>
                <span style="font-size: 0.8rem; color: #94a3b8;">${qCount} Questions</span>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn-glass-sm" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: #ef4444;" onclick="deleteTestFromVault(${index})"><i class="fas fa-trash-alt"></i></button>
                <button class="btn-glass-sm" style="background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.3); color: #38bdf8;" onclick="attemptTest(${index})"><i class="fas fa-play"></i> Attempt</button>
            </div>
        `;
        vaultList.appendChild(li);
    });
}

// NEW ASYNC ENGINE: Downloads the split files and merges them right before starting
window.attemptTest = async function(index) {
    let testMeta = testVault[index]; 
    
    if (testMeta.isMultiDoc && currentUser && testMeta.docId && !testMeta.questions) {
        document.body.style.cursor = 'wait'; // Show loading cursor
        let fullQuestions = [];
        
        // Rapidly download all subject chunks
        const secSnapshot = await db.collection('users').doc(currentUser.uid).collection('vault').doc(testMeta.docId).collection('sections').get();
        secSnapshot.forEach(doc => {
            fullQuestions.push(...doc.data().questions);
        });
        
        testMeta.questions = fullQuestions; // Cache them in memory
        document.body.style.cursor = 'default';
    }

    testData = testMeta; 
    processNewJSONFormat();
    prepareInstructions();
    showScreen('screen-instructions');
}
window.deleteTestFromVault = function(index) {
    if(!confirm("Are you sure you want to permanently delete this test?")) return;

    const testToDel = testVault[index];

    if (currentUser && testToDel.docId) {
        // Delete from Firestore Database
        db.collection('users').doc(currentUser.uid).collection('vault').doc(testToDel.docId).delete()
        .then(() => {
            testVault.splice(index, 1); // Remove from local array
            updateVaultUI(); // Refresh UI
        })
        .catch(err => {
            console.error("Error deleting test:", err);
            alert("Could not delete the test from the database.");
        });
    } else {
        // Delete in Guest Mode (Temporary array)
        testVault.splice(index, 1);
        updateVaultUI();
    }
};
// ================= PERFORMANCE LOGS LOGIC =================
function updatePerformanceLogsUI() {
    // 🚨 FIXED ID: We are using 'db-results-list' now to match your HTML perfectly!
    const list = document.getElementById('db-results-list'); 
    if (!list) return;
    
    list.innerHTML = '';
    
    if (performanceLogs.length === 0) {
        list.innerHTML = `<li class="db-item-glass empty-state">No past attempts found.</li>`;
        return;
    }

    performanceLogs.forEach((log, index) => {
        const title = log.title || 'Practice Test';
        const score = log.score !== undefined ? log.score : '--';
        const max = log.maxScore !== undefined ? log.maxScore : '--';
        const date = log.date || 'Unknown Date';

        const li = document.createElement('li');
        li.className = 'db-item-glass';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';

        li.innerHTML = `
            <div style="flex:1;">
                <strong style="display:block; margin-bottom: 5px; color: white;">${title}</strong>
                <span style="font-size: 0.8rem; color: #94a3b8;">Score: <span class="text-green" style="font-weight:bold;">${score}</span>/${max} &nbsp;|&nbsp; ${date}</span>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn-glass-sm" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: #ef4444;" onclick="deletePastLog(${index})">
                    <i class="fas fa-trash-alt"></i>
                </button>
                <button class="btn-glass-sm" style="background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.3); color: #38bdf8;" onclick="viewPastLog(${index})">
                    <i class="fas fa-eye"></i> View
                </button>
            </div>
        `;
        list.appendChild(li);
    });
}
window.viewPastLog = async function(index) {
    const log = performanceLogs[index];
    if (!log) return;
    
    document.body.style.cursor = 'wait';
    let extractedQs = [];

    try {
        // 1. If it's a new Multi-Doc log, fetch the 15-question chunks from Firebase
        if (log.isMultiDoc && currentUser && log.docId && !log.allQuestions) {
            const secSnapshot = await db.collection('users').doc(currentUser.uid).collection('logs').doc(log.docId).collection('sections').get();
            
            if (secSnapshot && typeof secSnapshot.forEach === 'function') {
                secSnapshot.forEach(doc => {
                    let d = doc.data();
                    if(d && d.questions) extractedQs.push(...d.questions);
                });
            }
            log.allQuestions = extractedQs;
        } else {
            // 2. Fallback for Guest Mode or currently in-memory logs
            extractedQs = log.allQuestions || [];
        }
        
        document.body.style.cursor = 'default';

        if (!extractedQs || extractedQs.length === 0) {
            alert("This log file is corrupted or missing data. Please delete it.");
            return;
        }

// 3. Lock in the Global State securely
        allQuestions = extractedQs;
        testData = log.testData || { title: log.title, questions: allQuestions };
        userAnswers = log.userAnswers || {};
        timeSpentOnQuestion = log.timeSpent || {};
        
        // 4. DYNAMICALLY REBUILD sectionsData so the UI tabs work flawlessly!
        sectionsData = [];
        const grouped = {};
        allQuestions.forEach(q => {
            let subj = q.subject || 'General';
            let type = q.type || 'SINGLE';
            let secName = q.sectionName || type;
            let key = subj + "|||" + type;
            
            if (!grouped[key]) grouped[key] = { subject: subj, name: secName, type: type, questions: [] };
            grouped[key].questions.push(q);
        });
        for (const key in grouped) sectionsData.push(grouped[key]);

        // 5. Generate Report & Show Screen
        generateBeastReport(false);
        showScreen('screen-analysis');
        switchAnalysisTab('overview', document.querySelector('.qz-nav-menu li:first-child'));

    } catch (error) {
        document.body.style.cursor = 'default';
        console.error("Critical Error loading log:", error);
        alert("Failed to load this performance log. The data might be corrupted.");
    }
};
// NEW: Delete a Past Performance Log
window.deletePastLog = async function(index) {
    if (!confirm("Are you sure you want to delete this performance log? This cannot be undone.")) return;

    const log = performanceLogs[index];
    
    try {
        // 1. If user is logged in, delete the main document from Firebase
        if (currentUser && log.docId) {
            await db.collection('users').doc(currentUser.uid).collection('logs').doc(log.docId).delete();
            // Note: We delete the parent document. The chunks become invisible orphans, 
            // keeping the deletion lightning fast without looping through subcollections!
        }
        
        // 2. Remove it from the local array
        performanceLogs.splice(index, 1);
        
        // 3. Re-render the UI
        updatePerformanceLogsUI();
        
    } catch (error) {
        console.error("Error deleting log:", error);
        alert("Failed to delete the log. Please check your connection.");
    }
};
// Triggered when clicking "Attempt" on a specific test in the vault
function attemptTest(index) {
    testData = testVault[index]; // Load the selected test into the active engine
    processNewJSONFormat();
    prepareInstructions();
    showScreen('screen-instructions');
}
// This function groups your JSON questions into the correct Tabs
function processNewJSONFormat() {
    sectionsData = [];
    const grouped = {};
    if (testData && testData.questions) {
        testData.questions.forEach(q => {
            let subj = q.subject || 'General';
            let type = q.type || 'SINGLE';
            // NEW: Added MULTI recognition
            let secName = type === 'SINGLE' ? 'Single Correct (MCQ)' : (type === 'MULTI' ? 'Multi Correct (MCQ)' : (type === 'NUMERICAL' ? 'Numerical Answer' : type));
            
            let key = subj + "|||" + type; // Groups by Subject AND Type
            if (!grouped[key]) grouped[key] = { subject: subj, name: secName, type: type, questions: [] };
            grouped[key].questions.push(q);
        });
    }
    for (const key in grouped) sectionsData.push(grouped[key]);
}


// ================= Screen 2: Instructions =================
function prepareInstructions() {
    document.getElementById('inst-test-title').innerText = testData.title || "Anvesham Mock Test";

    // 1. Handle Variable Duration (If JSON misses it, default to 60)
    let defaultDuration = testData.duration || 60;
    
    // Inject it into the editable input box
    const durationInput = document.getElementById('inst-custom-duration');
    if (durationInput) durationInput.value = defaultDuration;

    // 2. Populate the NTA Sidebar Profile
    if (currentUser) {
        document.getElementById('inst-user-name').innerText = currentUser.displayName;
        document.getElementById('inst-user-avatar').src = currentUser.photoURL;
    } else {
        document.getElementById('inst-user-name').innerText = "Guest Candidate";
        document.getElementById('inst-user-avatar').src = "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png";
    }

    // 3. Reset the checkbox and button every time you open a new test
    const declCheck = document.getElementById('declaration-check');
    const btnStart = document.getElementById('btn-start-exam');
    if (declCheck && btnStart) {
        declCheck.checked = false;
        btnStart.disabled = true;
        btnStart.style.opacity = "0.5";
    }
}

// ================= GLOBAL EXAM TRIGGERS =================
const declCheck = document.getElementById('declaration-check');
const btnStart = document.getElementById('btn-start-exam');

// 1. Unlock button when checkbox is clicked
if (declCheck && btnStart) {
    declCheck.addEventListener('change', (e) => {
        btnStart.disabled = !e.target.checked;
        btnStart.style.opacity = e.target.checked ? "1" : "0.5";
    });

    // 2. Launch Exam when "I am ready to begin" is clicked
    btnStart.addEventListener('click', () => {
        // Read the duration exactly as the user typed it in the box
        let customTime = parseInt(document.getElementById('inst-custom-duration').value);
        
        // Safety check: if they type '0' or clear the box, force it to 60
        if(!customTime || customTime <= 0) customTime = 60; 

        // Lock the duration into the engine
        testData.durationMinutes = customTime;
// NEW: Capture Custom Marking Scheme Overrides
        testData.customMarks = {
            'SINGLE': { pos: parseFloat(document.getElementById('override-single-pos').value) || 4, neg: parseFloat(document.getElementById('override-single-neg').value) || 1 },
            'MULTI': { pos: parseFloat(document.getElementById('override-multi-pos').value) || 4, neg: parseFloat(document.getElementById('override-multi-neg').value) || 2 },
            'NUMERICAL': { pos: parseFloat(document.getElementById('override-num-pos').value) || 4, neg: parseFloat(document.getElementById('override-num-neg').value) || 0 }
        };

        initExam();
        showScreen('screen-exam');
    });
}
// ================= Screen 3: Live Exam Engine =================
function initExam() {
    document.getElementById('exam-title').innerText = testData.title || "Exam";
// NEW: Inject Google Profile into the Live Exam Sidebar
    if (currentUser) {
        const avatar = document.getElementById('exam-user-avatar');
        const name = document.getElementById('exam-user-name');
        if (avatar) avatar.src = currentUser.photoURL;
        if (name) name.innerText = currentUser.displayName;
    }
    flattenQuestions();
    renderTabs();
    startTimer(testData.durationMinutes * 60);
    loadQuestion(0);
}
function flattenQuestions() {
    allQuestions = []; userAnswers = {}; timeSpentOnQuestion = {}; currentQuestionStartTime = 0; 
    sectionsData.forEach((sec, sIdx) => {
        sec.questions.forEach((q) => {
            let globalIndex = allQuestions.length;
let override = testData.customMarks[q.type];
            allQuestions.push({
                ...q,
                subject: sec.subject,
                sectionName: sec.name,
                globalIndex: globalIndex,
                displayNumber: globalIndex + 1,
                secIndex: sIdx, 
                posMarks: override ? override.pos : (q.marks ? q.marks.pos : 4), // OVERRIDE LOGIC
                negMarks: override ? override.neg : (q.marks ? q.marks.neg : 1)
            });
            questionStates[globalIndex] = 0; 
        });
    });
}

function renderTabs() {
    const subjContainer = document.getElementById('subject-tabs');
    subjContainer.innerHTML = '';

    let uniqueSubjects = [...new Set(sectionsData.map(s => s.subject))];
    uniqueSubjects.forEach((subj, idx) => {
        const tab = document.createElement('div');
        tab.className = `subj-tab`;
        
        // NEW: We add a data attribute so the JS always knows the exact subject name
        tab.setAttribute('data-subj', subj);
        
        // NEW: Removed "opacity: 0.7" and used dimmed text "color: rgba(255,255,255,0.7)" instead
        tab.style.cssText = `padding: 10px 20px; color: rgba(255,255,255,0.7); cursor: pointer; border-radius: 6px 6px 0 0; font-weight: 600; font-size: 0.95rem; transition: 0.2s; display: flex; align-items: center; gap: 8px; position: relative;`;
        
        let safeSubjId = subj.replace(/\s+/g, '-');
        
        tab.innerHTML = `
            <span>${subj}</span>
            <div class="tab-info-wrapper">
                <span class="info-icon" style="background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3);">i</span>
                <div class="info-popover" id="subj-popover-${safeSubjId}" style="top: 100%; bottom: auto; margin-top: 5px; z-index: 100;"></div>
            </div>
        `;
        
        tab.onclick = (e) => {
            if(!e.target.classList.contains('info-icon') && !e.target.closest('.info-popover')) {
                let firstSecOfSubj = sectionsData.findIndex(s => s.subject === subj);
                let firstQ = allQuestions.find(q => q.secIndex === firstSecOfSubj);
                if(firstQ) loadQuestion(firstQ.globalIndex);
            }
        };
        subjContainer.appendChild(tab);
    });
}
function updatePopovers() {
    // 1. UPDATE BOTTOM ROW (Section Popovers)
    sectionsData.forEach((sec, idx) => {
        let counts = {0:0, 1:0, 2:0, 3:0, 4:0};
        
        allQuestions.filter(q => q.secIndex === idx).forEach(q => {
            counts[questionStates[q.globalIndex]]++;
        });
        
        const popover = document.getElementById(`popover-${idx}`);
        if(popover) {
            popover.innerHTML = `
                <div class="popover-header">${sec.name} Overview</div>
                <div class="popover-stat-row">
                    <div class="nta-shape shape-sm s-answered">${counts[2]}</div> 
                    <span class="pop-text">Answered</span>
                </div>
                <div class="popover-stat-row">
                    <div class="nta-shape shape-sm s-not-answered">${counts[1]}</div> 
                    <span class="pop-text">Not Answered</span>
                </div>
                <div class="popover-stat-row">
                    <div class="nta-shape shape-sm s-not-visited">${counts[0]}</div> 
                    <span class="pop-text">Not Visited</span>
                </div>
                <div class="popover-stat-row">
                    <div class="nta-shape shape-sm s-marked">${counts[3]}</div> 
                    <span class="pop-text">Marked</span>
                </div>
                <div class="popover-stat-row">
                    <div class="nta-shape shape-sm s-answered-marked">${counts[4]}<span class="tiny-tick">✔</span></div> 
                    <span class="pop-text">Answered & Marked</span>
                </div>
            `;
        }
    });

    // 2. NEW: UPDATE TOP ROW (Subject Popovers - Combines MCQs + Numerical)
    let uniqueSubjects = [...new Set(sectionsData.map(s => s.subject))];
    uniqueSubjects.forEach(subj => {
        let counts = {0:0, 1:0, 2:0, 3:0, 4:0};
        
        // Filter by the entire subject, not just the section index!
        allQuestions.filter(q => q.subject === subj).forEach(q => {
            counts[questionStates[q.globalIndex]]++;
        });
        
        let safeSubjId = subj.replace(/\s+/g, '-');
        const popover = document.getElementById(`subj-popover-${safeSubjId}`);
        if(popover) {
            popover.innerHTML = `
                <div class="popover-header">${subj} Overall</div>
                <div class="popover-stat-row">
                    <div class="nta-shape shape-sm s-answered">${counts[2]}</div> 
                    <span class="pop-text">Answered</span>
                </div>
                <div class="popover-stat-row">
                    <div class="nta-shape shape-sm s-not-answered">${counts[1]}</div> 
                    <span class="pop-text">Not Answered</span>
                </div>
                <div class="popover-stat-row">
                    <div class="nta-shape shape-sm s-not-visited">${counts[0]}</div> 
                    <span class="pop-text">Not Visited</span>
                </div>
                <div class="popover-stat-row">
                    <div class="nta-shape shape-sm s-marked">${counts[3]}</div> 
                    <span class="pop-text">Marked</span>
                </div>
                <div class="popover-stat-row">
                    <div class="nta-shape shape-sm s-answered-marked">${counts[4]}<span class="tiny-tick">✔</span></div> 
                    <span class="pop-text">Answered & Marked</span>
                </div>
            `;
        }
    });
}
function updateActiveTab(secIndex) {
    const currentSubj = sectionsData[secIndex].subject;
    
// 1. Highlight Top Row (Subject)
    document.querySelectorAll('.subj-tab').forEach(tab => {
        // NEW: Check the data attribute, not the innerText!
        if (tab.getAttribute('data-subj') === currentSubj) {
            tab.style.background = 'var(--primary-blue)';
            tab.style.color = 'white'; // Solid white text
        } else {
            tab.style.background = 'transparent';
            tab.style.color = 'rgba(255,255,255,0.7)'; // Dimmed text (keeps parent solid)
        }
    });
    // 2. Render Bottom Row (Sections for active Subject)
    const secContainer = document.getElementById('section-tabs');
    secContainer.innerHTML = '';
    
    sectionsData.forEach((sec, idx) => {
        if (sec.subject === currentSubj) {
            const tab = document.createElement('div');
            tab.className = `tab ${idx === secIndex ? 'active' : ''}`;
            tab.innerHTML = `${sec.name} <div class="tab-info-wrapper"><span class="info-icon">i</span><div class="info-popover" id="popover-${idx}"></div></div>`;
            tab.onclick = (e) => { 
                if(!e.target.classList.contains('info-icon') && !e.target.closest('.info-popover')) {
                    let firstQ = allQuestions.find(q => q.secIndex === idx);
                    if(firstQ) loadQuestion(firstQ.globalIndex); 
                }
            };
            secContainer.appendChild(tab);
        }
    });
    updatePopovers();
}
function loadQuestion(index) {
    if(index < 0 || index >= allQuestions.length) return;
// --- NEW: TIME TRACKING LOGIC ---
    if (currentQuestionStartTime > 0) {
        let timeSpent = Math.floor((Date.now() - currentQuestionStartTime) / 1000);
        if(!timeSpentOnQuestion[currentQuestionIndex]) timeSpentOnQuestion[currentQuestionIndex] = 0;
        timeSpentOnQuestion[currentQuestionIndex] += timeSpent;
    }
    currentQuestionStartTime = Date.now();
    // ---------------------------------
    
    currentQuestionIndex = index;
    const q = allQuestions[index];

    if(questionStates[index] === 0) questionStates[index] = 1; // Mark viewed

    document.getElementById('current-q-num').innerText = q.displayNumber;
let diagData = q.diagram || q.image; 
    let imageHtml = '';
    if (diagData) {
        let imgSrc = diagData.startsWith('data:image') ? diagData : `data:image/png;base64,${diagData}`;
        imageHtml = `<div style="margin-top: 15px; text-align: left;">
                        <img src="${imgSrc}" style="max-width: 100%; max-height: 350px; border-radius: 8px; border: 1px solid var(--qz-border); box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                     </div>`;
    }
    document.getElementById('q-content').innerHTML = q.text + imageHtml;
    document.getElementById('q-pos-marks').innerText = `+${q.posMarks}`;
    document.getElementById('q-neg-marks').innerText = `-${q.negMarks}`;
    document.getElementById('q-type-text').innerText = q.type;
    document.getElementById('current-section-name').innerText = q.sectionName;

    updateActiveTab(q.secIndex);

    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    // Dynamic rendering based on question type
// Dynamic rendering based on question type
    if (q.type === 'SINGLE') {
        q.options.forEach((opt, oIdx) => {
            const isChecked = userAnswers[index] === oIdx ? 'checked' : '';
            const div = document.createElement('div');
            div.className = 'option-row';
            div.innerHTML = `<input type="radio" name="option" id="opt${oIdx}" value="${oIdx}" ${isChecked}> <label for="opt${oIdx}" style="flex:1; cursor:pointer;">${opt}</label>`;
            div.onclick = () => document.getElementById(`opt${oIdx}`).checked = true;
            optionsContainer.appendChild(div);
        });
    }else if (q.type === 'MULTI') {
        // NEW: MULTI CHECKBOX ENGINE
        let selectedArr = userAnswers[index] || [];
        q.options.forEach((opt, oIdx) => {
            const isChecked = selectedArr.includes(oIdx) ? 'checked' : '';
            const div = document.createElement('div');
            div.className = 'option-row';
            div.innerHTML = `<input type="checkbox" name="option-multi" id="opt${oIdx}" value="${oIdx}" ${isChecked}> <label for="opt${oIdx}" style="flex:1; cursor:pointer;">${opt}</label>`;
            div.onclick = (e) => { 
                if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
                    let cb = document.getElementById(`opt${oIdx}`); cb.checked = !cb.checked;
                }
            };
            optionsContainer.appendChild(div);
        });
    }

else if (q.type === 'NUMERICAL') {
        const val = userAnswers[index] !== undefined ? userAnswers[index] : '';
        optionsContainer.innerHTML = `
            <div style="margin-top: 20px; padding: 20px; background: #f8f9fa; border: 1px solid var(--border-color); border-radius: 4px;">
                <label style="font-weight: bold; display:block; margin-bottom: 10px;">Enter your numerical answer:</label>
                <input type="text" id="num-answer" value="${val}" autocomplete="off" style="padding: 10px 15px; font-size: 1.2rem; width: 100%; max-width: 300px; border: 2px solid var(--primary-blue); border-radius: 4px; outline: none;">
            </div>
        `;
    }

    updatePalette();

   // Trigger MathJax to render LaTeX equations dynamically
    if (window.MathJax && window.MathJax.typesetPromise) {
        // Clear previous math blocks to prevent memory leaks/glitches
        MathJax.typesetClear([document.getElementById('q-content'), document.getElementById('options-container')]);
        
        // Render the new math
        MathJax.typesetPromise([document.getElementById('q-content'), document.getElementById('options-container')])
            .catch(err => console.log("MathJax error: ", err));
    }
}

function updatePalette() {
    const palette = document.getElementById('question-palette');
    palette.innerHTML = '';
    
    // Find out which section we are currently in
    const currentSecIndex = allQuestions[currentQuestionIndex].secIndex;
    
    // ONLY get questions that belong to the active section
    const sectionQuestions = allQuestions.filter(q => q.secIndex === currentSecIndex);
    
    let counts = {0:0, 1:0, 2:0, 3:0, 4:0};

    sectionQuestions.forEach((q) => {
        let state = questionStates[q.globalIndex];
        counts[state]++;
        
// 🚨 NEW: Map to the exact NTA shapes from the CSS!
       const btn = document.createElement('button');
        let stateClass = ['s-not-visited', 's-not-answered', 's-answered', 's-marked', 's-answered-marked'][state];
        btn.className = `nta-shape pal-btn ${stateClass}`;
        
        if (state === 4) {
            btn.innerHTML = `${q.displayNumber}<span class="tiny-tick">✔</span>`;
        } else {
            btn.innerText = q.displayNumber; 
        }
        
        btn.onclick = () => loadQuestion(q.globalIndex);
        palette.appendChild(btn);
    });

    // Update the right-side legend counts for the CURRENT section
    document.getElementById('cnt-not-vis').innerText = counts[0];
    document.getElementById('cnt-not-ans').innerText = counts[1];
    document.getElementById('cnt-ans').innerText = counts[2];
    document.getElementById('cnt-marked').innerText = counts[3];
    document.getElementById('cnt-mark-ans').innerHTML = `${counts[4]}<span class="tiny-tick">✔</span>`;
    
    updatePopovers();
}
// Replaces getSelectedOption to handle both Radios and Text inputs
function getUserAnswer() {
    const q = allQuestions[currentQuestionIndex];
    if (q.type === 'SINGLE') {
        const selected = document.querySelector('input[name="option"]:checked');
        return selected ? parseInt(selected.value) : null;
    } else if (q.type === 'MULTI') {
        // NEW: Grab all checked boxes
        const selectedNodes = document.querySelectorAll('input[name="option-multi"]:checked');
        if (selectedNodes.length === 0) return null;
        return Array.from(selectedNodes).map(n => parseInt(n.value)); 
    } else if (q.type === 'NUMERICAL') {
        const val = document.getElementById('num-answer').value.trim();
        return val !== '' ? val : null;
    }
    return null;
}

// Action Buttons
document.getElementById('btn-save-next').addEventListener('click', () => {
    const answer = getUserAnswer();
    if(answer !== null) {
        userAnswers[currentQuestionIndex] = answer;
        questionStates[currentQuestionIndex] = 2; // Answered
    } else {
        questionStates[currentQuestionIndex] = 1; // Not Answered
    }
    loadQuestion(currentQuestionIndex + 1);
});

document.getElementById('btn-clear').addEventListener('click', () => {
    const q = allQuestions[currentQuestionIndex];
    if (q.type === 'SINGLE') document.querySelectorAll('input[name="option"]').forEach(opt => opt.checked = false);
    else if (q.type === 'MULTI') document.querySelectorAll('input[name="option-multi"]').forEach(opt => opt.checked = false);
    else if (q.type === 'NUMERICAL') document.getElementById('num-answer').value = '';
    
    delete userAnswers[currentQuestionIndex];
    questionStates[currentQuestionIndex] = 1; 
    updatePalette();
});

document.getElementById('btn-mark-review').addEventListener('click', () => {
    const answer = getUserAnswer();
    if(answer !== null) {
        userAnswers[currentQuestionIndex] = answer;
        questionStates[currentQuestionIndex] = 4; // Answered & Marked
    } else {
        questionStates[currentQuestionIndex] = 3; // Marked
    }
    loadQuestion(currentQuestionIndex + 1);
});

// Timer Setup
function startTimer(durationSeconds) {
    let timer = durationSeconds, minutes, seconds;
    clearInterval(examInterval);
    
    examInterval = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        document.getElementById('timer').textContent = minutes + ":" + seconds;

        if (--timer <= 0) {
            clearInterval(examInterval);
            alert("Time is up! Submitting exam automatically.");
            submitExam();
        }
    }, 1000);
}

document.getElementById('btn-submit').addEventListener('click', () => {
    if(confirm("Are you sure you want to submit the test?")) {
        submitExam();
    }
});

// ================= THE BEAST ANALYSIS ENGINE =================

// Sidebar Navigation
window.switchAnalysisTab = function(tabId, element) {
    document.querySelectorAll('.analysis-nav li').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    document.querySelectorAll('.analysis-view').forEach(el => el.classList.remove('active-view'));
    document.getElementById('tab-' + tabId).classList.add('active-view');
}
// ================= Qs by Qs Filter Engine =================
window.filterQbyQ = function(subject) {
    // 1. Update Tab Button Styles
    document.querySelectorAll('.qbyq-tab-btn').forEach(btn => {
        if (btn.innerText.trim() === subject || (subject === 'All' && btn.innerText.trim() === 'All Subjects')) {
            btn.style.background = '#38BDF8';
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.style.boxShadow = '0 4px 10px rgba(56, 189, 248, 0.3)';
        } else {
            btn.style.background = 'white';
            btn.style.color = '#64748B';
            btn.style.border = '1px solid #E2E8F0';
            btn.style.boxShadow = 'none';
        }
    });

    // 2. Hide/Show the Subject Blocks
    document.querySelectorAll('.qbyq-subj-wrapper').forEach(wrapper => {
        if (subject === 'All' || wrapper.dataset.subj === subject) {
            wrapper.style.display = 'block';
        } else {
            wrapper.style.display = 'none';
        }
    });
};

function submitExam() {
    clearInterval(examInterval);
    // Log time for the final question you were on
    if (currentQuestionStartTime > 0) {
        let timeSpent = Math.floor((Date.now() - currentQuestionStartTime) / 1000);
        if(!timeSpentOnQuestion[currentQuestionIndex]) timeSpentOnQuestion[currentQuestionIndex] = 0;
        timeSpentOnQuestion[currentQuestionIndex] += timeSpent;
    }
    
generateBeastReport(true);
    showScreen('screen-analysis');
}

// ================= QUIZRR-STYLE ANALYSIS LOGIC =================

// Connect Sidebar Navigation to update Title
window.switchAnalysisTab = function(tabId, element) {
    document.querySelectorAll('.qz-nav-menu li').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    document.querySelectorAll('.analysis-view').forEach(el => el.classList.remove('active-view'));
    document.getElementById('tab-' + tabId).classList.add('active-view');
    
    // Update the main header title to match the clicked tab
    document.getElementById('qz-view-title').innerText = element.innerText.trim();
}

function generateBeastReport(isNewSubmission = false) {
    let totals = { score: 0, max: 0, attempted: 0, correct: 0, wrong: 0, unattempted: 0, posMarks: 0, negMarks: 0, time: 0 };
    let sectionStats = {};
    let diffStats = { 
        'Easy': { correct: 0, wrong: 0, unattempted: 0, total: 0 },
        'Moderate': { correct: 0, wrong: 0, unattempted: 0, total: 0 },
        'Tough': { correct: 0, wrong: 0, unattempted: 0, total: 0 }
    };

    // Auto-assign colors to sections to mimic Physics/Chem/Math
    const subjColors = ['var(--subj-green)', 'var(--subj-orange)', 'var(--subj-blue)'];
    const subjIcons = ['fa-atom', 'fa-flask', 'fa-square-root-alt'];

let uniqueSubjects = [...new Set(allQuestions.map(q => q.subject))];
    uniqueSubjects.forEach((subj, idx) => {
        sectionStats[subj] = { 
            score: 0, max: 0, correct: 0, wrong: 0, unattempted: 0, total: 0, 
            color: subjColors[idx % 3], icon: subjIcons[idx % 3] 
        };
    });
allQuestions.forEach((q) => {
        totals.max += q.posMarks;
        sectionStats[q.subject].max += q.posMarks; // Fixed crash bug here!
        sectionStats[q.subject].total++;
        
        if(timeSpentOnQuestion[q.globalIndex]) totals.time += timeSpentOnQuestion[q.globalIndex];
        
        let diff = ['Easy', 'Moderate', 'Moderate', 'Tough'][q.globalIndex % 4]; 
        diffStats[diff].total++;

        const userAnswer = userAnswers[q.globalIndex];
        let isCorrect = false; let attempted = false; let earnedMarks = 0; let lostMarks = 0;

        if (userAnswer !== undefined && userAnswer !== null && userAnswer !== '') {
            attempted = true;
            totals.attempted++;
            if (q.type === 'SINGLE') {
                isCorrect = (userAnswer === q.correctIndex);
                if(isCorrect) earnedMarks = q.posMarks; else lostMarks = q.negMarks;
            } else if (q.type === 'NUMERICAL') {
                isCorrect = (parseFloat(userAnswer) === parseFloat(q.correctNum));
                if(isCorrect) earnedMarks = q.posMarks; else lostMarks = q.negMarks;
            } else if (q.type === 'MULTI') {
                // NEW: PARTIAL MARKING FOR AITSP FORMAT
                let correctArr = (q.correctIndices && q.correctIndices.length > 0) ? q.correctIndices : (Array.isArray(q.correctIndex) ? q.correctIndex : [q.correctIndex]);
                let hasWrong = userAnswer.some(val => !correctArr.includes(val));
                
                if (hasWrong) {
                    isCorrect = false; lostMarks = q.negMarks; 
                } else if (userAnswer.length === correctArr.length) {
                    isCorrect = true; earnedMarks = q.posMarks; 
                } else {
                    isCorrect = true; earnedMarks = userAnswer.length; // Partial marks
                    q.isPartial = true;
                }
            }
        }

        if (!attempted) {
            totals.unattempted++; sectionStats[q.subject].unattempted++; diffStats[diff].unattempted++;
            q.finalStatus = 'unattempted';
        } else if (isCorrect) {
            totals.correct++; totals.score += earnedMarks; totals.posMarks += earnedMarks;
            sectionStats[q.subject].correct++; sectionStats[q.subject].score += earnedMarks;
            diffStats[diff].correct++; q.finalStatus = q.isPartial ? 'partial' : 'correct';
        } else {
            totals.wrong++; totals.score -= lostMarks; totals.negMarks += lostMarks;
            sectionStats[q.subject].wrong++; sectionStats[q.subject].score -= lostMarks;
            diffStats[diff].wrong++; q.finalStatus = 'wrong';
        }
    });
    // 1. Populate Overview Tab
    document.getElementById('qz-sidebar-title').innerText = testData.title || "Practice Test";
    document.getElementById('res-total-score').innerText = totals.score;
    document.getElementById('res-max-score').innerText = totals.max;
    document.getElementById('res-attempted').innerText = totals.attempted;
    document.getElementById('res-positive').innerText = totals.posMarks;
    document.getElementById('res-pos-max').innerText = `/${totals.max}`;
    document.getElementById('res-negative').innerText = totals.negMarks;
    document.getElementById('res-neg-max').innerText = `/${totals.max}`;
    document.getElementById('res-time').innerText = Math.round(totals.time / 60); // Convert seconds to mins
    
    let accuracy = totals.attempted > 0 ? ((totals.correct / totals.attempted) * 100).toFixed(2) : "0.00";
    document.getElementById('res-accuracy').innerText = `${accuracy}%`;
// ================= SAFE SUBMISSION ENGINE =================
// ================= SAFE SUBMISSION ENGINE =================
    if (isNewSubmission) {
        let submitBtn = document.getElementById('btn-submit');
        
        // 1. PREVENT DOUBLE SUBMISSIONS: Stop the function if already saving
        if (submitBtn) {
            if (submitBtn.disabled) return; 
            submitBtn.disabled = true; // Lock the button!
            submitBtn.innerText = "Saving Analysis...";
        }

// 2. STRIP THE HEAVY DATA: Remove massive arrays to prevent Firebase crashes!
        let safeTestData = JSON.parse(JSON.stringify(testData));
        delete safeTestData.questions; 

        let safeSectionsData = JSON.parse(JSON.stringify(sectionsData));
        safeSectionsData.forEach(sec => delete sec.questions); // Strips the second hidden copy!

        const newLogData = {
            title: safeTestData.title || "Practice Test",
            date: new Date().toLocaleString(),
            score: totals.score,
            maxScore: totals.max,
            accuracy: accuracy,
            testData: safeTestData,
            sectionsData: safeSectionsData, // Now it is 100% lightweight!
            userAnswers: JSON.parse(JSON.stringify(userAnswers)),
            timeSpent: JSON.parse(JSON.stringify(timeSpentOnQuestion)),
            isMultiDoc: true 
        };
        if (currentUser) {
            db.collection('users').doc(currentUser.uid).collection('logs').add(newLogData)
            .then(async (docRef) => {
                newLogData.docId = docRef.id;
                
                // 3. SLICE INTO SMALLER BATCHES (10 Qs per chunk to be ultra-safe)
                let safeQuestions = JSON.parse(JSON.stringify(allQuestions));
                let chunks = [];
                for (let i = 0; i < safeQuestions.length; i += 10) {
                    chunks.push(safeQuestions.slice(i, i + 10));
                }
                
                for (let i = 0; i < chunks.length; i++) {
                    await db.collection('users').doc(currentUser.uid).collection('logs').doc(docRef.id).collection('sections').add({
                        chunkIndex: i,
                        questions: chunks[i]
                    });
                }
                
                newLogData.allQuestions = safeQuestions; 
                performanceLogs.push(newLogData);
                updatePerformanceLogsUI();
                
                // Unlock button when done
                if(submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-check-double"></i> Submit Exam';
                }
            }).catch(err => {
                console.error("Error saving log:", err);
                if(submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-check-double"></i> Submit Exam';
                }
                alert("Error saving your analysis to the cloud. Check your connection.");
            });
        } else {
            // GUEST MODE
            newLogData.allQuestions = JSON.parse(JSON.stringify(allQuestions));
            performanceLogs.push(newLogData);
            updatePerformanceLogsUI();
            if(submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-check-double"></i> Submit Exam';
            }
        }
    }
    // ==============================================================
    // Inject the specific subject sub-scores (Green, Orange, Blue)
    let miniHtml = '';
    for(let sec in sectionStats) {
        let s = sectionStats[sec];
        // Only grab the first word (e.g., "Physics" instead of "Physics Section")
        let shortName = sec.split(' ')[0];
        miniHtml += `<div class="qz-mini-sub">${shortName} Score <span style="color:${s.color};">${s.score}<span style="color:var(--qz-text-muted);font-weight:600;font-size:0.8rem;">/${s.max}</span></span></div>`;
    }
    document.getElementById('mini-section-scores').innerHTML = miniHtml;

    // 2. Populate Performance Table
    let perfHtml = `
        <tr>
            <td><div class="subj-icon" style="background:var(--qz-purple)"><i class="fas fa-check-double"></i></div> <strong>Overall</strong></td>
            <td style="font-weight:800;">${totals.score}<span style="font-size:0.75rem; color:var(--qz-text-muted);">/${totals.max}</span></td>
            <td><span style="border-left: 3px solid var(--subj-green); padding-left: 10px;">${totals.correct}</span><span style="font-size:0.75rem; color:var(--qz-text-muted);">/${totals.total || allQuestions.length}</span></td>
            <td><span style="border-left: 3px solid var(--subj-orange); padding-left: 10px;">${totals.wrong}</span><span style="font-size:0.75rem; color:var(--qz-text-muted);">/${totals.total || allQuestions.length}</span></td>
            <td><span style="border-left: 3px solid var(--qz-border); padding-left: 10px;">${totals.unattempted}</span><span style="font-size:0.75rem; color:var(--qz-text-muted);">/${totals.total || allQuestions.length}</span></td>
        </tr>
    `;
    for(let sec in sectionStats) {
        let s = sectionStats[sec];
        perfHtml += `
            <tr>
                <td><div class="subj-icon" style="background:${s.color}"><i class="fas ${s.icon}"></i></div> <span style="color:${s.color}">${sec.split(' ')[0]}</span></td>
                <td>${s.score}<span style="font-size:0.75rem; color:var(--qz-text-muted);">/${s.max}</span></td>
                <td><span style="border-left: 3px solid var(--subj-green); padding-left: 10px;">${s.correct}</span><span style="font-size:0.75rem; color:var(--qz-text-muted);">/${s.total}</span></td>
                <td><span style="border-left: 3px solid var(--subj-orange); padding-left: 10px;">${s.wrong}</span><span style="font-size:0.75rem; color:var(--qz-text-muted);">/${s.total}</span></td>
                <td><span style="border-left: 3px solid var(--qz-border); padding-left: 10px;">${s.unattempted}</span><span style="font-size:0.75rem; color:var(--qz-text-muted);">/${s.total}</span></td>
            </tr>
        `;
    }
    document.getElementById('performance-tbody').innerHTML = perfHtml;



// 4. Premium Qs by Qs Bubbles (Subject Tabs + Section Grouping)
    let qGridHtml = `
        <div class="qbyq-header" style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 2px solid #F1F5F9; padding-bottom: 15px; gap: 15px;">
            <div class="qbyq-tabs" id="qbyq-subject-tabs" style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="qbyq-tab-btn" onclick="filterQbyQ('All')" style="padding: 8px 18px; border-radius: 20px; border: none; background: #38BDF8; color: white; font-weight: 700; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(56, 189, 248, 0.3);">All Subjects</button>
    `;

    // Generate the Tab Buttons dynamically
    uniqueSubjects.forEach(subj => {
        qGridHtml += `<button class="qbyq-tab-btn" onclick="filterQbyQ('${subj}')" style="padding: 8px 18px; border-radius: 20px; border: 1px solid #E2E8F0; background: white; color: #64748B; font-weight: 700; cursor: pointer; transition: 0.2s;">${subj}</button>`;
    });

    qGridHtml += `
            </div>
            <div class="qbyq-legend" style="display: flex; gap: 15px; font-size: 0.85rem; font-weight: 700;">
                <span style="color: #059669; display: flex; align-items: center; gap: 5px;"><i class="fas fa-check"></i> Correct</span>
                <span style="color: #DC2626; display: flex; align-items: center; gap: 5px;"><i class="fas fa-times"></i> Wrong</span>
                <span style="color: #94A3B8; display: flex; align-items: center; gap: 5px;"><i class="fas fa-minus"></i> Skipped</span>
            </div>
        </div>
        <div id="qbyq-content-area">
    `;

    // Build the Content Blocks
    uniqueSubjects.forEach((subj, idx) => {
        let color = subjColors[idx % 3];
        let icon = subjIcons[idx % 3];

        qGridHtml += `
        <div class="qbyq-subj-wrapper" data-subj="${subj}" style="margin-bottom: 40px;">
            <div style="color:${color}; font-weight:900; font-size:1.3rem; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; display:flex; align-items:center; gap:12px; border-bottom: 1px dashed ${color}40; padding-bottom: 10px;">
                <div class="subj-icon" style="background:${color}; width: 34px !important; height: 34px !important; border-radius: 10px !important;"><i class="fas ${icon}" style="font-size:1rem !important; color: white;"></i></div>
                ${subj}
            </div>`;

        // Inner Grouping: Group by Section Type (SINGLE, MULTI, NUMERICAL)
        let subjQs = allQuestions.filter(q => q.subject === subj);
        let uniqueTypes = [...new Set(subjQs.map(q => q.type))];

        uniqueTypes.forEach(type => {
            let typeQs = subjQs.filter(q => q.type === type);
            let secName = typeQs[0].sectionName || type;
            
            // Assign custom colors based on Section Type
            let typeColor = type === 'SINGLE' ? '#10B981' : (type === 'MULTI' ? '#F59E0B' : '#3B82F6');
            let typeIcon = type === 'SINGLE' ? 'fa-dot-circle' : (type === 'MULTI' ? 'fa-check-square' : 'fa-keyboard');

            qGridHtml += `
                <div class="q-section-block" style="margin-bottom: 25px; background: white; padding: 25px; border-radius: 16px; border: 1px solid rgba(226, 232, 240, 0.8); box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02);">
                    <div style="color:${typeColor}; font-weight:800; font-size:1.05rem; margin-bottom: 20px; display:flex; align-items:center; gap:8px;">
                        <i class="fas ${typeIcon}"></i> ${secName}
                    </div>
                    <div class="q-bubble-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(45px, 1fr)); gap: 18px;">
            `;

            typeQs.forEach(q => {
                let mark = '<i class="fas fa-minus"></i>';
                let bg = '#F8FAFC'; let border = '#E2E8F0'; let text = '#94A3B8';

                if(q.finalStatus === 'correct' || q.finalStatus === 'partial') {
                    mark = '<i class="fas fa-check"></i>';
                    bg = '#D1FAE5'; border = '#10B981'; text = '#059669';
                } else if(q.finalStatus === 'wrong') {
                    mark = '<i class="fas fa-times"></i>';
                    bg = '#FEE2E2'; border = '#EF4444'; text = '#DC2626';
                }

                qGridHtml += `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                        <div style="font-size:0.8rem; font-weight:800; color:#64748B;">Q${q.displayNumber}</div>
                        <div style="width: 42px; height: 42px; border-radius: 50%; display:flex; justify-content:center; align-items:center; background: ${bg}; color: ${text}; border: 2px solid ${border}; box-shadow: 0 3px 8px rgba(0,0,0,0.06); font-size: 1.1rem; line-height: 1;" title="${q.sectionName}">
                            ${mark}
                        </div>
                    </div>
                `;
            });
            qGridHtml += `</div></div>`; 
        });
        qGridHtml += `</div>`; 
    });

    qGridHtml += `</div>`; 
    document.getElementById('qbyq-container').innerHTML = qGridHtml;
    // 5. Render exact Quizrr Stacked Potential Chart
    renderPotentialChart(totals);
}

function renderPotentialChart(totals) {
    const ctx = document.getElementById('potentialChart').getContext('2d');
    if (potentialChartInstance) potentialChartInstance.destroy();

    const actual = totals.score;
    const maxPoss = actual + totals.negMarks; // If zero mistakes were made

    // We use a Stacked Bar chart to mimic Screenshot 1203 exactly
    potentialChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Actual score', '25% less error', '50% less error', '75% less error', '100% less error'],
            datasets: [
                {
                    label: 'Actual Score',
                    data: [actual, actual, actual, actual, actual],
                    backgroundColor: '#4338CA', // Deep Blue/Purple base
                    stack: 'Stack 0',
                    barThickness: 60,
                },
                {
                    label: 'Improved score',
                    data: [
                        0, 
                        totals.negMarks * 0.25, 
                        totals.negMarks * 0.50, 
                        totals.negMarks * 0.75, 
                        totals.negMarks 
                    ],
                    backgroundColor: function(context) {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        if (!chartArea) return null;
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, '#818CF8'); // Light purple top
                        gradient.addColorStop(1, '#C7D2FE');
                        return gradient;
                    },
                    stack: 'Stack 0',
                    barThickness: 60,
                    borderRadius: {topLeft: 8, topRight: 8}
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let total = context.parsed.y;
                            if(context.datasetIndex === 1) total += context.chart.data.datasets[0].data[context.dataIndex];
                            return `Score: ${total}/${totals.max}`;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    stacked: true, 
                    beginAtZero: true, 
                    max: totals.max + 10,
                    grid: { color: '#F1F5F9', borderDash: [5, 5] },
                    ticks: { color: '#64748B', font: {family: 'Inter', weight: 600} }
                },
                x: { 
                    stacked: true, 
                    grid: { display: false },
                    ticks: { color: '#64748B', font: {family: 'Inter', weight: 600} }
                }
            }
        }
    });
}
// ================= Authentication / Guest Login Logic =================
document.getElementById('btn-guest').addEventListener('click', () => {
    // Hide the login prompt
    document.getElementById('auth-section').style.display = 'none';
    
    // Show the actual dashboard vault
    document.getElementById('user-dashboard-section').style.display = 'block';
    
    // Refresh the vault list to show the "Empty" state or existing tests
    updateVaultUI(); 
updatePerformanceLogsUI(); // NEW: Loads the logs
});
// ================= Modals Logic =================
function closeModal() {
    document.getElementById('app-modal').style.display = 'none';
}

function openInstructionsModal() {
    // 1. Find the original instructions
    const originalInstElement = document.querySelector('.nta-inst-body');
    if (!originalInstElement) return;

    // 2. Make an invisible "clone" so we don't accidentally delete the pre-exam screen buttons
    const clone = originalInstElement.cloneNode(true);

    // 3. Freeze the Duration Input
    const durationInput = clone.querySelector('#inst-custom-duration');
    if (durationInput) {
        const span = document.createElement('strong');
        span.innerText = testData.durationMinutes + " ";
        durationInput.parentNode.replaceChild(span, durationInput);
    }

    // 4. Freeze the Custom Marking Scheme Inputs
    const overrideIds = [
        'override-single-pos', 'override-single-neg',
        'override-multi-pos', 'override-multi-neg',
        'override-num-pos', 'override-num-neg'
    ];
    
    overrideIds.forEach(id => {
        const clonedInput = clone.querySelector(`#${id}`);
        const originalInput = document.getElementById(id); // Get the actual typed value
        if (clonedInput && originalInput) {
            const span = document.createElement('strong');
            span.innerText = originalInput.value;
            clonedInput.parentNode.replaceChild(span, clonedInput);
        }
    });

    // 5. Change "Override" title to "Active Scheme" and hide subtitle
    const h3s = clone.querySelectorAll('h3');
    h3s.forEach(h3 => {
        if(h3.innerText.includes('Custom Marking Scheme')) {
            h3.innerHTML = '<i class="fas fa-sliders-h"></i> Active Marking Scheme';
            if(h3.nextElementSibling && h3.nextElementSibling.tagName === 'P') {
                h3.nextElementSibling.style.display = 'none'; // Hide the "Set the marks..." subtitle
            }
        }
    });

    // 6. Completely strip out the Declaration Checkbox and "Ready to Begin" button
    const declaration = clone.querySelector('.nta-declaration');
    if (declaration) declaration.remove();
    
    const startBtn = clone.querySelector('#btn-start-exam');
    if (startBtn) startBtn.parentElement.remove(); // Removes the button and its centering div

    // 7. Inject the clean, frozen HTML into the modal
    const instContent = clone.innerHTML;
    
    document.getElementById('modal-title').innerText = "Instructions";
    document.getElementById('modal-body').innerHTML = `
        <div class="qp-warning" style="background: #FFFBEB; border: 1px solid #FEF3C7; color: #92400E; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-weight: 500;">
            <i class="fas fa-exclamation-triangle"></i> Note that the timer is ticking while you read the instructions.
        </div>
        <div class="qp-paper-container" style="font-family: 'Inter', sans-serif; color: #1E293B;">
            ${instContent}
        </div>
    `;
    
    document.getElementById('app-modal').style.display = 'flex';
}
function openQuestionPaper() {
    document.getElementById('modal-title').innerText = "Full Question Paper";
    
    let header = document.querySelector('.modal-header');
    if(!document.getElementById('btn-print-paper')) {
        let printBtn = document.createElement('button');
        printBtn.id = 'btn-print-paper';
        printBtn.className = 'btn-glass-sm';
        printBtn.style.cssText = 'background: #2563EB; color: white; border: none; margin-right: 15px; font-weight: bold; padding: 6px 15px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 8px;';
        printBtn.innerHTML = '<i class="fas fa-print"></i> Print Paper';
        printBtn.onclick = () => window.print();
        header.insertBefore(printBtn, header.querySelector('.close-btn'));
    }

    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = ''; 

    let paperContainer = document.createElement('div');
    paperContainer.className = 'qp-paper-container';

    let titleDiv = document.createElement('div');
    titleDiv.className = 'qp-main-title';
    titleDiv.innerText = testData.title || 'JEE Advanced Mock Test';
    paperContainer.appendChild(titleDiv);
    
    let uniqueSubjects = [...new Set(sectionsData.map(s => s.subject))];
    
    uniqueSubjects.forEach(subj => {
        let subjHeader = document.createElement('div');
        subjHeader.className = 'qp-subject-header';
        subjHeader.innerText = `PART: ${subj}`;
        paperContainer.appendChild(subjHeader);
        
        let subjSections = sectionsData.filter(s => s.subject === subj);
        
        subjSections.forEach((sec, localSecIdx) => {
            let secHeader = document.createElement('div');
            secHeader.className = 'qp-section-header';
            secHeader.innerText = `SECTION ${localSecIdx + 1}: ${sec.name}`;
            paperContainer.appendChild(secHeader);
            
            let processedQs = allQuestions.filter(q => q.subject === subj && q.sectionName === sec.name);
            if(processedQs.length === 0) return;

            let qCount = processedQs.length;
            let posM = processedQs[0].posMarks;
            let negM = processedQs[0].negMarks;
            
            // ================= REAL JEE ADVANCED INSTRUCTIONS =================
            let instText = "";
            if(sec.type === 'SINGLE') {
                instText = `<ul class="qp-inst-list">
                    <li>This section contains <b>${qCount}</b> questions.</li>
                    <li>Each question has FOUR options (A), (B), (C) and (D). <b>ONLY ONE</b> of these four options is the correct answer.</li>
                    <li>For each question, choose the option corresponding to the correct answer.</li>
                    <li>Answer to each question will be evaluated according to the following marking scheme:
                        <div class="qp-marks-grid">
                            <div><b>Full Marks</b></div><div><b>: +${posM}</b> If ONLY the correct option is chosen.</div>
                            <div><b>Zero Marks</b></div><div><b>: 0</b> If none of the options is chosen (i.e. the question is unanswered).</div>
                            <div><b>Negative Marks</b></div><div><b>: -${negM}</b> In all other cases.</div>
                        </div>
                    </li>
                </ul>`;
            } else if(sec.type === 'MULTI') {
                instText = `<ul class="qp-inst-list">
                    <li>This section contains <b>${qCount}</b> questions.</li>
                    <li>Each question has FOUR options (A), (B), (C) and (D). <b>ONE OR MORE THAN ONE</b> of these four option(s) is(are) correct answer(s).</li>
                    <li>For each question, choose the option(s) corresponding to (all) the correct answer(s).</li>
                    <li>Answer to each question will be evaluated according to the following marking scheme:
                        <div class="qp-marks-grid">
                            <div><b>Full Marks</b></div><div><b>: +${posM}</b> If only (all) the correct option(s) is(are) chosen.</div>
                            <div><b>Partial Marks</b></div><div><b>: +1</b> For each correct option chosen, provided NO incorrect option is chosen.</div>
                            <div><b>Zero Marks</b></div><div><b>: 0</b> If none of the options is chosen (i.e. the question is unanswered).</div>
                            <div><b>Negative Marks</b></div><div><b>: -${negM}</b> In all other cases.</div>
                        </div>
                    </li>
                </ul>`;
            } else if(sec.type === 'NUMERICAL') {
                instText = `<ul class="qp-inst-list">
                    <li>This section contains <b>${qCount}</b> questions.</li>
                    <li>The answer to each question is a <b>NUMERICAL VALUE</b>.</li>
                    <li>For each question, enter the correct numerical value in the designated space.</li>
                    <li>Answer to each question will be evaluated according to the following marking scheme:
                        <div class="qp-marks-grid">
                            <div><b>Full Marks</b></div><div><b>: +${posM}</b> If ONLY the correct numerical value is entered.</div>
                            <div><b>Zero Marks</b></div><div><b>: 0</b> If the question is unanswered.</div>
                            <div><b>Negative Marks</b></div><div><b>: -${negM}</b> In all other cases.</div>
                        </div>
                    </li>
                </ul>`;
            }
            // ==============================================================
            
            let instDiv = document.createElement('div');
            instDiv.className = 'qp-instructions';
            instDiv.innerHTML = `<strong><i class="fas fa-info-circle"></i> SECTION INSTRUCTIONS:</strong> ${instText}`;
            paperContainer.appendChild(instDiv);
            
            // Render Questions
            processedQs.forEach(q => {
                let qBlock = document.createElement('div');
                qBlock.className = 'qp-q-block'; // The container we will turn into a box
                
                let qNum = document.createElement('div');
                qNum.className = 'qp-q-num';
                qNum.innerText = `Q.${q.displayNumber}`;
                
                let qContent = document.createElement('div');
                qContent.className = 'qp-q-content';
                
                let qTextDiv = document.createElement('div');
                qTextDiv.innerHTML = q.text;
                qContent.appendChild(qTextDiv);
                
                let diagData = q.diagram || q.image; 
                if (diagData) {
                    let imgSrc = diagData.startsWith('data:image') ? diagData : `data:image/png;base64,${diagData}`;
                    let imgWrapper = document.createElement('div');
                    imgWrapper.className = 'qp-img-wrapper';
                    imgWrapper.innerHTML = `<img src="${imgSrc}">`;
                    qContent.appendChild(imgWrapper);
                }

                if(q.type === 'SINGLE' || q.type === 'MULTI') {
                    let optGrid = document.createElement('div');
                    optGrid.className = 'qp-options-grid';
                    let labels = ['(A)', '(B)', '(C)', '(D)'];
                    
                    if (q.options && Array.isArray(q.options)) {
                        q.options.forEach((opt, oIdx) => {
                            let optDiv = document.createElement('div');
                            optDiv.innerHTML = `<span class="qp-opt-label">${labels[oIdx]}</span> ${opt}`;
                            optGrid.appendChild(optDiv);
                        });
                    }
                    qContent.appendChild(optGrid);
                } else if (q.type === 'NUMERICAL') {
                    let numDiv = document.createElement('div');
                    numDiv.style.cssText = 'margin-top: 15px; font-weight: bold; font-family: monospace; font-size: 1.1rem;';
                    numDiv.innerText = 'Answer: ____________________';
                    qContent.appendChild(numDiv);
                }

                qBlock.appendChild(qNum);
                qBlock.appendChild(qContent);
                paperContainer.appendChild(qBlock);
            });
        });
    });
    
    modalBody.appendChild(paperContainer);
    document.getElementById('app-modal').style.display = 'flex';
    
    if (window.MathJax && window.MathJax.typesetPromise) {
        MathJax.typesetClear([modalBody]);
        MathJax.typesetPromise([modalBody]).catch(err => console.log(err));
    }
}
