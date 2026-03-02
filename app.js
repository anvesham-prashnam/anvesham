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
            querySnapshot.forEach((doc) => performanceLogs.push(doc.data()));
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


function showScreen(screenId) {
    document.querySelectorAll('.app-screen').forEach(el => el.classList.remove('active-screen'));
    document.getElementById(screenId).classList.add('active-screen');
}
// ================= Screen 1: File Upload & Dashboard Logic =================
// ================= Screen 1: File Upload & Dashboard Logic =================
document.getElementById('json-upload').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsedData = JSON.parse(e.target.result);
            
            if (currentUser) {
                // USER IS LOGGED IN: Save permanently to Firestore
                db.collection('users').doc(currentUser.uid).collection('vault').add(parsedData)
                .then(() => {
                    testVault.push(parsedData);
                    updateVaultUI();
                    alert(`"${parsedData.title || 'New Test'}" permanently saved to your Cloud Vault!`);
                }).catch(err => console.error("Error saving to DB:", err));
            } else {
                // GUEST MODE: Save temporarily
                testVault.push(parsedData);
                updateVaultUI();
                alert(`"${parsedData.title || 'New Test'}" added temporarily (Guest Mode).`);
            }
            
        } catch (error) {
            alert("Error parsing JSON file. Please ensure it is valid.");
            console.error(error);
        }
        event.target.value = ''; 
    };
    reader.readAsText(file);
});

// Refreshes the Test Vault UI in the Dashboard
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
        const qCount = test.questions ? test.questions.length : 0;

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
                <button class="btn-glass-sm" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: #ef4444;" onclick="deleteTestFromVault(${index})">
                    <i class="fas fa-trash-alt"></i>
                </button>
                <button class="btn-glass-sm" style="background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.3); color: #38bdf8;" onclick="attemptTest(${index})">
                    <i class="fas fa-play"></i> Attempt
                </button>
            </div>
        `;
        vaultList.appendChild(li);
    });
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
    const list = document.getElementById('db-results-list');
    list.innerHTML = '';

    if (performanceLogs.length === 0) {
        list.innerHTML = `<li class="db-item-glass empty-state">No past attempts found.</li>`;
        return;
    }

    // Loop through past attempts and build the UI
    performanceLogs.forEach((log, index) => {
        const li = document.createElement('li');
        li.className = 'db-item-glass';
        li.innerHTML = `
            <div>
                <strong style="display:block; margin-bottom: 5px; color: white;">${log.title}</strong>
                <span style="font-size: 0.8rem; color: #94a3b8;">Score: <span class="text-green" style="font-weight:bold;">${log.score}</span>/${log.maxScore} | Acc: ${log.accuracy}%</span>
                <div style="font-size: 0.7rem; color: #64748b; margin-top: 5px;"><i class="far fa-clock"></i> ${log.date}</div>
            </div>
            <button class="btn-glass-sm" style="background: rgba(139, 92, 246, 0.1); border-color: rgba(139, 92, 246, 0.3); color: #a78bfa;" onclick="viewPastLog(${index})">
                <i class="fas fa-chart-pie"></i> View
            </button>
        `;
        list.appendChild(li);
    });
}

window.viewPastLog = function(index) {
    const log = performanceLogs[index];
    
    // Restore the exact state of the engine from the saved snapshot
    testData = log.testData;
    userAnswers = log.userAnswers;
    timeSpentOnQuestion = log.timeSpent;
    allQuestions = log.allQuestions;
    sectionsData = log.sectionsData;

    // Generate the report WITHOUT saving it again (false flag)
    generateBeastReport(false);
    
    // Switch to analysis screen and force the Overview tab to be active
    showScreen('screen-analysis');
    switchAnalysisTab('overview', document.querySelector('.qz-nav-menu li:first-child'));
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

    // Check if testData and questions exist
    if (testData && testData.questions) {
        testData.questions.forEach(q => {
            if (!grouped[q.type]) grouped[q.type] = [];
            grouped[q.type].push(q);
        });
    }

    // Build the section arrays
    for (const type in grouped) {
        let sectionName = type === 'SINGLE' ? 'Single Correct (MCQ)' : (type === 'NUMERICAL' ? 'Numerical Answer' : type);
        sectionsData.push({
            name: sectionName,
            type: type,
            questions: grouped[type]
        });
    }
}
// ================= Screen 2: Instructions =================
function prepareInstructions() {
    // 1. Safely update title
    const titleEl = document.getElementById('inst-test-title');
    if (titleEl) {
        titleEl.innerText = testData.title || "Anvesham Mock Test";
    }

    // 2. Handle Variable Duration (If JSON misses it, default to 60)
    let defaultDuration = testData.duration || 60;
    const durationInput = document.getElementById('inst-custom-duration');
    if (durationInput) {
        durationInput.value = defaultDuration;
    }

    // 3. Safely Populate the NTA Sidebar Profile
    const userNameEl = document.getElementById('inst-user-name');
    const userAvatarEl = document.getElementById('inst-user-avatar');
    
    if (currentUser) {
        if (userNameEl) userNameEl.innerText = currentUser.displayName;
        if (userAvatarEl) userAvatarEl.src = currentUser.photoURL;
    } else {
        if (userNameEl) userNameEl.innerText = "Guest Candidate";
        if (userAvatarEl) userAvatarEl.src = "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png";
    }

    // 4. Safely Reset the checkbox and button every time you open a new test
    const declCheck = document.getElementById('declaration-check');
    const btnStart = document.getElementById('btn-start-exam');
    if (declCheck && btnStart) {
        declCheck.checked = false;
        btnStart.disabled = true;
        btnStart.style.opacity = "0.5";
    }
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
    allQuestions = []; 
userAnswers = {}; 
    timeSpentOnQuestion = {}; // NEW: Reset time for new attempt
    currentQuestionStartTime = 0; // NEW: Reset time for new attempt
    sectionsData.forEach((sec, sIdx) => {
        sec.questions.forEach((q) => {
            let globalIndex = allQuestions.length;
            allQuestions.push({
                ...q,
                sectionName: sec.name,
                globalIndex: globalIndex,
                displayNumber: globalIndex + 1,
                secIndex: sIdx,
                posMarks: q.marks.pos,
                negMarks: q.marks.neg
            });
            questionStates[globalIndex] = 0; // 0: Not Visited
        });
    });
}

// Replace the existing renderTabs function with this:
function renderTabs() {
    const tabsContainer = document.getElementById('section-tabs');
    tabsContainer.innerHTML = '';
    
    sectionsData.forEach((sec, idx) => {
        const firstQuestionOfSection = allQuestions.find(q => q.secIndex === idx);
        const tab = document.createElement('div');
        tab.className = `tab ${idx === 0 ? 'active' : ''}`;
        tab.dataset.secIndex = idx;
        
        // ADDED: The hoverable wrapper and the hidden dropdown menu structure
        tab.innerHTML = `
            ${sec.name} 
            <div class="tab-info-wrapper">
                <span class="info-icon">i</span>
                <div class="info-popover" id="popover-${idx}">
                    </div>
            </div>
        `;
        
        // Ensure clicking the tab changes the section, but ignore clicks on the 'i' icon itself
        tab.onclick = (e) => { 
            if(!e.target.classList.contains('info-icon') && !e.target.closest('.info-popover') && firstQuestionOfSection) {
                loadQuestion(firstQuestionOfSection.globalIndex); 
            }
        };
        tabsContainer.appendChild(tab);
    });
    
    updatePopovers(); // Initialize the counts
}

// NEW: Strict grid HTML for hover popovers
function updatePopovers() {
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
}

function updateActiveTab(secIndex) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', parseInt(tab.dataset.secIndex) === secIndex);
    });
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
    document.getElementById('q-content').innerHTML = q.text;
    document.getElementById('q-pos-marks').innerText = `+${q.posMarks}`;
    document.getElementById('q-neg-marks').innerText = `-${q.negMarks}`;
    document.getElementById('q-type-text').innerText = q.type;
    document.getElementById('current-section-name').innerText = q.sectionName;

    updateActiveTab(q.secIndex);

    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    // Dynamic rendering based on question type
    if (q.type === 'SINGLE') {
        q.options.forEach((opt, oIdx) => {
            const isChecked = userAnswers[index] === oIdx ? 'checked' : '';
            const div = document.createElement('div');
            div.className = 'option-row';
            div.innerHTML = `
                <input type="radio" name="option" id="opt${oIdx}" value="${oIdx}" ${isChecked}>
                <label for="opt${oIdx}" style="flex:1; cursor:pointer;">${opt}</label>
            `;
            div.onclick = () => document.getElementById(`opt${oIdx}`).checked = true;
            optionsContainer.appendChild(div);
        });
    } else if (q.type === 'NUMERICAL') {
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
        let stateClass = ['s-not-visited', 's-not-answered', 's-answered', 's-marked', 's-answered-marked'][state];

        const btn = document.createElement('button');
        btn.className = `badge pal-btn ${stateClass}`;
        btn.innerText = q.displayNumber; // Keeps global question number (e.g., 9, 10, 11)
        btn.onclick = () => loadQuestion(q.globalIndex);
        palette.appendChild(btn);btn.className = `nta-shape pal-btn ${stateClass}`;
        
        // Inject the tiny green tick if it's "Answered & Marked"
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
    if (q.type === 'SINGLE') {
        document.querySelectorAll('input[name="option"]').forEach(opt => opt.checked = false);
    } else if (q.type === 'NUMERICAL') {
        document.getElementById('num-answer').value = '';
    }
    
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

    sectionsData.forEach((sec, idx) => {
        sectionStats[sec.name] = { 
            score: 0, max: 0, correct: 0, wrong: 0, unattempted: 0, total: 0, 
            color: subjColors[idx % 3], icon: subjIcons[idx % 3] 
        };
    });

    allQuestions.forEach((q) => {
        totals.max += q.posMarks;
        sectionStats[q.sectionName].max += q.posMarks;
        sectionStats[q.sectionName].total++;
        
        // Sum time
        if(timeSpentOnQuestion[q.globalIndex]) totals.time += timeSpentOnQuestion[q.globalIndex];
        
        let diff = ['Easy', 'Moderate', 'Moderate', 'Tough'][q.globalIndex % 4]; 
        diffStats[diff].total++;

        const userAnswer = userAnswers[q.globalIndex];
        let isCorrect = false; let attempted = false;

        if (userAnswer !== undefined && userAnswer !== null && userAnswer !== '') {
            attempted = true;
            totals.attempted++;
            if (q.type === 'SINGLE') isCorrect = (userAnswer === q.correctIndex);
            else if (q.type === 'NUMERICAL') isCorrect = (parseFloat(userAnswer) === parseFloat(q.correctNum));
        }

        if (!attempted) {
            totals.unattempted++; sectionStats[q.sectionName].unattempted++; diffStats[diff].unattempted++;
            q.finalStatus = 'unattempted';
        } else if (isCorrect) {
            totals.correct++; totals.score += q.posMarks; totals.posMarks += q.posMarks;
            sectionStats[q.sectionName].correct++; sectionStats[q.sectionName].score += q.posMarks;
            diffStats[diff].correct++; q.finalStatus = 'correct';
        } else {
            totals.wrong++; totals.score -= q.negMarks; totals.negMarks += q.negMarks;
            sectionStats[q.sectionName].wrong++; sectionStats[q.sectionName].score -= q.negMarks;
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
// ================= NEW: SAVE SNAPSHOT TO LOGS =================
    if (isNewSubmission) {
        performanceLogs.push({
            title: testData.title || "Practice Test",
            date: new Date().toLocaleString(),
            score: totals.score,
            maxScore: totals.max,
            accuracy: accuracy,
            // Deep copy the state so subsequent tests don't overwrite this data
            testData: JSON.parse(JSON.stringify(testData)),
            userAnswers: JSON.parse(JSON.stringify(userAnswers)),
            timeSpent: JSON.parse(JSON.stringify(timeSpentOnQuestion)),
            allQuestions: JSON.parse(JSON.stringify(allQuestions)),
            sectionsData: JSON.parse(JSON.stringify(sectionsData))
        });
        updatePerformanceLogsUI();
    }
  // --- SAVE TO LOGS ---
    if (isNewLog) {
        const newLogData = {
            title: testData.title || "Practice Test",
            date: new Date().toLocaleString(),
            score: totals.score,
            maxScore: totals.max,
            accuracy: accuracy,
            testData: JSON.parse(JSON.stringify(testData)),
            userAnswers: JSON.parse(JSON.stringify(userAnswers)),
            timeSpent: JSON.parse(JSON.stringify(timeSpentOnQuestion)),
            allQuestions: JSON.parse(JSON.stringify(allQuestions)),
            sectionsData: JSON.parse(JSON.stringify(sectionsData))
        };

        if (currentUser) {
            // USER IS LOGGED IN: Save report to Firestore
            db.collection('users').doc(currentUser.uid).collection('logs').add(newLogData)
            .then(() => {
                performanceLogs.push(newLogData);
                updatePerformanceLogsUI();
            }).catch(err => console.error("Error saving log:", err));
        } else {
            // GUEST MODE: Save temporarily
            performanceLogs.push(newLogData);
            updatePerformanceLogsUI();
        }
    }
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

    // 3. Difficulty Table
    let diffHtml = '';
    ['Easy', 'Moderate', 'Tough'].forEach(d => {
        let s = diffStats[d];
        if(s.total > 0) {
            diffHtml += `
                <tr>
                    <td style="text-align:left; padding-left: 30px;"><strong>${d}</strong></td>
                    <td>${s.correct}<span style="font-size:0.75rem; color:var(--qz-text-muted);">/${s.total} Qs</span></td>
                    <td>${s.wrong}<span style="font-size:0.75rem; color:var(--qz-text-muted);">/${s.total} Qs</span></td>
                    <td>${s.unattempted}<span style="font-size:0.75rem; color:var(--qz-text-muted);">/${s.total} Qs</span></td>
                </tr>
            `;
        }
    });
    document.getElementById('difficulty-tbody').innerHTML = diffHtml;

    // 4. Qs by Qs Bubbles
    let qGridHtml = '';
    sectionsData.forEach((sec, idx) => {
        let color = subjColors[idx % 3];
        let icon = subjIcons[idx % 3];
        qGridHtml += `<div class="q-section-block">
            <div style="color:${color}; font-weight:700; font-size:1.1rem; margin-bottom: 15px;"><i class="fas ${icon}"></i> ${sec.name.split(' ')[0]}</div>
            <div class="q-bubble-grid">`;
        
        allQuestions.filter(q => q.secIndex === idx).forEach(q => {
            let mark = '<i class="fas fa-ban text-muted"></i>';
            let bClass = 'unattempted';
            if(q.finalStatus === 'correct') { mark = '<i class="fas fa-check text-green"></i>'; bClass = 'correct'; }
            if(q.finalStatus === 'wrong') { mark = '<i class="fas fa-times text-red"></i>'; bClass = 'wrong'; }
            
            qGridHtml += `
                <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                    <div style="font-size:0.8rem; font-weight:600; color:var(--qz-text-muted);">${q.displayNumber}</div>
                    <div style="width: 32px; height: 32px; border-radius: 50%; display:flex; justify-content:center; align-items:center; background: ${bClass === 'correct' ? '#D1FAE5' : (bClass === 'wrong' ? '#FEE2E2' : '#F1F5F9')}; color: ${bClass === 'correct' ? '#10B981' : (bClass === 'wrong' ? '#EF4444' : '#94A3B8')}; border: 1px solid ${bClass === 'correct' ? '#34D399' : (bClass === 'wrong' ? '#F87171' : '#CBD5E1')};">
                        ${mark}
                    </div>
                </div>
            `;
        });
        qGridHtml += `</div></div>`;
    });
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
    // We reuse the exact HTML from the pre-exam screen
    const instContent = document.querySelector('.instructions-text').innerHTML;
    
    document.getElementById('modal-title').innerText = "Instructions";
    document.getElementById('modal-body').innerHTML = `
        <div class="qp-warning">Note that the timer is ticking while you read the instructions. Close this page to return to answering the questions.</div>
        ${instContent}
    `;
    
    document.getElementById('app-modal').style.display = 'flex';
}

function openQuestionPaper() {
    document.getElementById('modal-title').innerText = "Question Paper";
    
    let html = `<div class="qp-warning">Note that the timer is ticking while you read the questions. Close this page to return to answering the questions.</div>`;
    
    allQuestions.forEach(q => {
        html += `
            <div class="qp-item">
                <div class="qp-num">Question No. ${q.displayNumber} (${q.sectionName})</div>
                <div class="qp-text">${q.text}</div>
            </div>
        `;
    });
    
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = html;
    
    document.getElementById('app-modal').style.display = 'flex';
    
    // Crucial: Re-render MathJax inside the modal!
    if (window.MathJax && window.MathJax.typesetPromise) {
        MathJax.typesetClear([modalBody]);
        MathJax.typesetPromise([modalBody]).catch(err => console.log(err));
    }
}
