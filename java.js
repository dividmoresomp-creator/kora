/* Firebase Configuration */
const firebaseConfig = {
  apiKey: "AIzaSyCHpkIlf8A13cL6TLggr7-3u8FM-PxzfSY",
  authDomain: "activitiescommittee-5b22c.firebaseapp.com",
  projectId: "activitiescommittee-5b22c",
  storageBucket: "activitiescommittee-5b22c.firebasestorage.app",
  messagingSenderId: "378991885059",
  appId: "1:378991885059:web:d8db039a6fc569fffb8736"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const tournamentDoc = db.collection('tournaments').doc('main');

/* Auth and initial state */
const AUTH = { user: 'admin', pass: 'marson20263' };
const state = {
  teams: [],
  groups: {}, // ✅ تم التغيير من [] إلى {}
  standings: {},
  matches: {},
  knockout: {}
};

let isLoadingFromFirebase = false;

/* Load from Firestore on startup */
async function loadFromFirestore() {
  try {
    isLoadingFromFirebase = true;
    const doc = await tournamentDoc.get();
    if (doc.exists) {
      const data = doc.data();
      state.teams = data.teams || [];
      state.groups = data.groups || {}; // ✅ object
      state.standings = data.standings || {};
      state.matches = data.matches || {};
      state.knockout = data.knockout || {};
    }
    isLoadingFromFirebase = false;
  } catch (error) {
    console.error('Error loading from Firestore:', error);
    isLoadingFromFirebase = false;
  }
}

/* Save to Firestore */
async function saveToFirestore() {
  if (isLoadingFromFirebase) return;
  try {
    await tournamentDoc.set({
      teams: state.teams,
      groups: state.groups, // ✅ object
      standings: state.standings,
      matches: state.matches,
      knockout: state.knockout,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error saving to Firestore:', error);
  }
}

/* Listen to real-time updates */
tournamentDoc.onSnapshot((doc) => {
  if (!isLoadingFromFirebase && doc.exists) {
    const data = doc.data();
    state.teams = data.teams || [];
    state.groups = data.groups || {}; // ✅ object
    state.standings = data.standings || {};
    state.matches = data.matches || {};
    state.knockout = data.knockout || {};

    // Update UI if elements exist
    if (document.getElementById('teams-list')) renderTeamsList();
    if (document.getElementById('org-groups')) renderGroupsOrg();
    if (document.getElementById('org-brackets')) renderBracketsOrg();
    if (document.getElementById('audience-groups')) renderAudience();
  }
});

function saveAll() {
  saveToFirestore();
}

/* Navigation */
function show(id) {
  document.querySelectorAll('[id^="page-"]').forEach(e => e.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}
function goHome() { show('page-main') }
function enterOrganizer() { show('page-login') }
function enterAudience() { show('page-audience'); renderAudience(); }
function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value.trim();
  if (u === AUTH.user && p === AUTH.pass) { show('page-org'); renderOrganizer(); }
  else alert('بيانات الدخول غلط');
}

/* Teams */
function addTeam() {
  const v = document.getElementById('team-input').value.trim();
  if (!v) return;
  if (state.teams.includes(v)) { alert('الفريق موجود'); return; }
  state.teams.push(v);
  document.getElementById('team-input').value = '';
  saveAll(); renderTeamsList();
}
function renderTeamsList() {
  const wrap = document.getElementById('teams-list');
  if (!wrap) return;
  wrap.innerHTML = '';
  state.teams.forEach((t, i) => {
    const el = document.createElement('div'); el.className = 'tag'; el.style.display = 'inline-flex'; el.style.gap = '8px';
    el.innerHTML = `<span>⚽ ${t}</span> <button class="ghost" onclick="removeTeam(${i})">حذف</button>`;
    wrap.appendChild(el);
  });
}
function removeTeam(i) { state.teams.splice(i, 1); saveAll(); renderTeamsList(); }

/* Helper: get groups as array */
function getGroupsArray() {
  return Object.keys(state.groups).sort((a, b) => a - b).map(k => state.groups[k]);
}

/* Helper: get group count */
function getGroupCount() {
  return Object.keys(state.groups).length;
}

/* Draw groups & create schedule (each pair once) */
function runGroupsDraw() {
  const teamsPerGroup = parseInt(document.getElementById('teams-per-group').value);
  if (state.teams.length < teamsPerGroup) { 
    alert(`سجل ${teamsPerGroup} فرق على الأقل`); 
    return; 
  }
  const shuffled = [...state.teams].sort(() => Math.random() - 0.5);

  // ✅ create groups as OBJECT
  state.groups = {};
  let groupIndex = 0;
  for (let i = 0; i < shuffled.length; i += teamsPerGroup) {
    state.groups[groupIndex] = shuffled.slice(i, i + teamsPerGroup);
    groupIndex++;
  }

  createScheduleAndStandings();
  alert('تم عمل القرعة وإنشاء جدول المباريات لكل مجموعة');
}

/* Manual distribution functions */
function startManualDistribution() {
  const teamsPerGroup = parseInt(document.getElementById('teams-per-group').value);
  if (state.teams.length < teamsPerGroup) { 
    alert(`سجل ${teamsPerGroup} فرق على الأقل`); 
    return; 
  }
  
  document.getElementById('manual-distribution').classList.remove('hidden');
  const container = document.getElementById('manual-groups-container');
  container.innerHTML = '';
  
  const numGroups = Math.ceil(state.teams.length / teamsPerGroup);
  
  for (let i = 0; i < numGroups; i++) {
    const groupDiv = document.createElement('div');
    groupDiv.style.marginBottom = '15px';
    groupDiv.style.padding = '10px';
    groupDiv.style.border = '1px solid #ddd';
    groupDiv.style.borderRadius = '8px';
    
    let html = `<h4>المجموعة ${i + 1}</h4>`;
    html += `<select id="manual-group-${i}" multiple size="${teamsPerGroup}" style="width:100%; padding:8px">`;
    state.teams.forEach(team => {
      html += `<option value="${team}">${team}</option>`;
    });
    html += `</select>`;
    html += `<div class="muted" style="margin-top:5px">اضغط Ctrl (أو Cmd) لاختيار فرق متعددة</div>`;
    
    groupDiv.innerHTML = html;
    container.appendChild(groupDiv);
  }
}

function cancelManualDistribution() {
  document.getElementById('manual-distribution').classList.add('hidden');
}

function saveManualDistribution() {
  const teamsPerGroup = parseInt(document.getElementById('teams-per-group').value);
  const numGroups = Math.ceil(state.teams.length / teamsPerGroup);
  
  state.groups = {};
  const usedTeams = new Set();
  
  for (let i = 0; i < numGroups; i++) {
    const select = document.getElementById(`manual-group-${i}`);
    const selectedTeams = Array.from(select.selectedOptions).map(opt => opt.value);
    
    if (selectedTeams.length === 0) {
      alert(`المجموعة ${i + 1} فارغة! اختر فرق لكل مجموعة`);
      return;
    }
    
    // Check for duplicates
    for (const team of selectedTeams) {
      if (usedTeams.has(team)) {
        alert(`الفريق "${team}" موجود في أكثر من مجموعة!`);
        return;
      }
      usedTeams.add(team);
    }
    
    state.groups[i] = selectedTeams;
  }
  
  // Check if all teams are assigned
  if (usedTeams.size !== state.teams.length) {
    alert('بعض الفرق لم يتم توزيعها! تأكد من توزيع كل الفرق');
    return;
  }
  
  createScheduleAndStandings();
  document.getElementById('manual-distribution').classList.add('hidden');
  alert('تم حفظ التوزيع اليدوي وإنشاء جدول المباريات');
}

function createScheduleAndStandings() {
  // ✅ create empty standings as OBJECT
  state.standings = {};
  Object.keys(state.groups).forEach(gi => {
    const g = state.groups[gi];
    state.standings[gi] = g.map(name => ({ name, played: 0, win: 0, draw: 0, lose: 0, gf: 0, ga: 0, pts: 0, yellow: 0, red: 0 }));
  });

  // create schedule (all unique pairs per group)
  state.matches = {};
  Object.keys(state.groups).forEach(gi => {
    const g = state.groups[gi];
    const pairs = [];
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        pairs.push({ a: g[i], b: g[j], sA: null, sB: null, yA: 0, yB: 0, rA: 0, rB: 0, played: false });
      }
    }
    state.matches[gi] = pairs;
  });

  state.knockout = {}; // clear previous brackets
  saveAll(); renderGroupsOrg(); renderAudience();
}

/* Sorting rules */
function sortGroup(arr) {
  return arr.slice().sort((A, B) => {
    const gdA = A.gf - A.ga, gdB = B.gf - B.ga;
    if (B.pts !== A.pts) return B.pts - A.pts;
    if (gdB !== gdA) return gdB - gdA;
    if (A.red !== B.red) return A.red - B.red;
    if (A.yellow !== B.yellow) return A.yellow - B.yellow;
    if (B.gf !== A.gf) return B.gf - A.gf;
    return A.name.localeCompare(B.name, 'ar');
  });
}

/* Recalculate standings from all recorded matches */
function rebuildStandings() {
  // ✅ reset standings as OBJECT
  state.standings = {};
  Object.keys(state.groups).forEach(gi => {
    const g = state.groups[gi];
    state.standings[gi] = g.map(name => ({ name, played: 0, win: 0, draw: 0, lose: 0, gf: 0, ga: 0, pts: 0, yellow: 0, red: 0 }));
  });

  // apply all matches
  Object.keys(state.matches).forEach(gi => {
    const groupMatches = state.matches[gi];
    groupMatches.forEach(m => {
      if (m.played && Number.isFinite(m.sA) && Number.isFinite(m.sB)) {
        const g = state.standings[gi];
        const A = g.find(x => x.name === m.a);
        const B = g.find(x => x.name === m.b);
        if (!A || !B) return;
        A.played++; B.played++;
        A.gf += m.sA; A.ga += m.sB; B.gf += m.sB; B.ga += m.sA;
        A.yellow += (m.yA || 0); B.yellow += (m.yB || 0);
        A.red += (m.rA || 0); B.red += (m.rB || 0);
        if (m.sA > m.sB) { A.win++; B.lose++; A.pts += 3; }
        else if (m.sA < m.sB) { B.win++; A.lose++; B.pts += 3; }
        else { A.draw++; B.draw++; A.pts++; B.pts++; }
      }
    });
  });
  saveAll();
}

/* Organizer: render groups + schedule + match editors */
function renderGroupsOrg() {
  const host = document.getElementById('org-groups');
  if (!host) return;
  host.innerHTML = '';
  if (getGroupCount() === 0) { host.innerHTML = '<div class="muted">لا توجد مجموعات بعد — قم بالقرعة</div>'; return; }

  Object.keys(state.groups).sort((a, b) => a - b).forEach(gi => {
    const g = state.groups[gi];
    const c = document.createElement('div'); c.className = 'card';
    // table
    const sorted = sortGroup(state.standings[gi] || []);
    let html = `<h3>المجموعة ${parseInt(gi) + 1}</h3>
      <div class="table"><table><thead><tr>
      <th>الفريق</th><th>لعب</th><th>فوز</th><th>تعادل</th><th>خسارة</th>
      <th>له</th><th>عليه</th><th>فرق</th><th>نقاط</th><th>إنذار</th><th>طرد</th>
      </tr></thead><tbody>`;
    sorted.forEach(t => {
      html += `<tr><td>${t.name}</td><td>${t.played}</td><td>${t.win}</td><td>${t.draw}</td><td>${t.lose}</td>
        <td>${t.gf}</td><td>${t.ga}</td><td>${t.gf - t.ga}</td><td><b>${t.pts}</b></td><td>${t.yellow}</td><td>${t.red}</td></tr>`;
    });
    html += `</tbody></table></div>`;
    // schedule (matches)
    html += `<div style="margin-top:10px"><h4>جدول المباريات (Schedule)</h4>`;
    const matches = state.matches[gi] || [];
    if (!matches.length) html += `<div class="muted">لا توجد مباريات</div>`;
    matches.forEach((m, mi) => {
      html += `<div class="pair" id="m-${gi}-${mi}">
        <span>${m.a}</span>
        <span class="vs">—</span>
        <span>${m.b}</span>
        <input type="number" id="m-${gi}-${mi}-a" placeholder="أهداف ${m.a}" style="width:90px" value="${m.sA === null ? '' : m.sA}" />
        <input type="number" id="m-${gi}-${mi}-b" placeholder="أهداف ${m.b}" style="width:90px" value="${m.sB === null ? '' : m.sB}" />
        <input type="number" id="m-${gi}-${mi}-yA" placeholder="إنذارات ${m.a}" style="width:120px" value="${m.yA || 0}" />
        <input type="number" id="m-${gi}-${mi}-yB" placeholder="إنذارات ${m.b}" style="width:120px" value="${m.yB || 0}" />
        <input type="number" id="m-${gi}-${mi}-rA" placeholder="طرد ${m.a}" style="width:100px" value="${m.rA || 0}" />
        <input type="number" id="m-${gi}-${mi}-rB" placeholder="طرد ${m.b}" style="width:100px" value="${m.rB || 0}" />
        <button onclick="saveMatchResult('${gi}',${mi})">${m.played ? 'تحديث' : 'حفظ'}</button>
        <button class="ghost" onclick="clearMatchResult('${gi}',${mi})">مسح نتيجة</button>
      </div>`;
    });
    html += `</div>`;
    c.innerHTML = html;
    host.appendChild(c);
  });
}

/* Save match result, then rebuild standings from all matches */
function saveMatchResult(gi, mi) {
  const m = state.matches[gi][mi];
  const sA = document.getElementById(`m-${gi}-${mi}-a`).value;
  const sB = document.getElementById(`m-${gi}-${mi}-b`).value;
  if (sA === '' || sB === '') { if (!confirm('سجل الأهداف كـ0 إذا تريد ذلك؟')) return; }
  const a = parseInt(sA || '0', 10), b = parseInt(sB || '0', 10);
  const yA = parseInt(document.getElementById(`m-${gi}-${mi}-yA`).value || '0', 10);
  const yB = parseInt(document.getElementById(`m-${gi}-${mi}-yB`).value || '0', 10);
  const rA = parseInt(document.getElementById(`m-${gi}-${mi}-rA`).value || '0', 10);
  const rB = parseInt(document.getElementById(`m-${gi}-${mi}-rB`).value || '0', 10);
  m.sA = a; m.sB = b; m.yA = yA; m.yB = yB; m.rA = rA; m.rB = rB; m.played = true;
  // rebuild full standings to avoid double-counting / support edits
  rebuildStandings();
  renderGroupsOrg(); renderAudience(); saveAll();
}

/* Clear a match (make it unplayed) and rebuild standings */
function clearMatchResult(gi, mi) {
  if (!confirm('هل أنت متأكد من مسح نتيجة هذه المباراة؟')) return;
  const m = state.matches[gi][mi];
  m.sA = null; m.sB = null; m.yA = 0; m.yB = 0; m.rA = 0; m.rB = 0; m.played = false;
  rebuildStandings(); renderGroupsOrg(); renderAudience(); saveAll();
}

/* Knockout functions */
function topTwoFromGroupIndex(gi) { return sortGroup(state.standings[gi] || []).slice(0, 2).map(x => x.name) }

function createKnockoutFromGroups() {
  if (getGroupCount() === 0) { alert('لا توجد مجموعات'); return; }
  const qualified = [];
  Object.keys(state.groups).forEach(i => {
    qualified.push(...topTwoFromGroupIndex(i));
  });
  if (qualified.length < 2) { alert('المتأهلون أقل من اللازم'); return; }
  const shuffled = qualified.sort(() => Math.random() - 0.5);
  const pairs = []; for (let i = 0; i < shuffled.length; i += 2) if (shuffled[i + 1]) pairs.push({ a: shuffled[i], b: shuffled[i + 1], sA: null, sB: null, winner: null, loser: null });
  state.knockout.R2 = pairs; saveAll(); renderBracketsOrg(); renderAudience(); alert('تم إنشاء الدور الثاني من المتأهلين');
}

/* Knockout round options - manual or automatic */
let pendingKnockoutData = null;

function showRoundOptions(fromKey, toKey) {
  const from = state.knockout[fromKey];
  if (!from || !from.length) { 
    alert('لا توجد مباريات في هذا الدور'); 
    return; 
  }
  
  const winners = from.filter(p => p.winner).map(p => p.winner);
  if (winners.length !== from.length) { 
    alert('سجِّل نتائج كل مباريات هذا الدور أولاً'); 
    return; 
  }
  
  // Store data for later use
  pendingKnockoutData = { fromKey, toKey, from, winners };
  
  // Show choice dialog
  const choice = confirm('اختر طريقة التوزيع:\n\nموافق = توزيع أوتوماتيكي (قرعة)\nإلغاء = توزيع يدوي');
  
  if (choice) {
    // Automatic
    advanceKnockoutAuto(fromKey, toKey);
  } else {
    // Manual
    startManualKnockout(fromKey, toKey);
  }
}

function advanceKnockoutAuto(fromKey, toKey) {
  if (!pendingKnockoutData) return;
  const { from, winners } = pendingKnockoutData;
  
  // ✅ Special case: R2 → R3 with 5 winners
  if (fromKey === 'R2' && toKey === 'R3' && winners.length === 5) {
    handleFiveWinnersCase(from, winners, toKey);
    pendingKnockoutData = null;
    return;
  }
  
  // ✅ Special case: R3 → SF when there's a direct qualifier
  if (fromKey === 'R3' && toKey === 'SF' && state.knockout.directToSF) {
    handleDirectQualifierCase(winners);
    pendingKnockoutData = null;
    return;
  }
  
  // Normal case - automatic shuffle
  const shuffled = winners.sort(() => Math.random() - 0.5);
  const next = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (shuffled[i + 1]) {
      next.push({ a: shuffled[i], b: shuffled[i + 1], sA: null, sB: null, winner: null, loser: null });
    }
  }
  state.knockout[toKey] = next;
  saveAll();
  renderBracketsOrg();
  renderAudience();
  alert('تم إنشاء الدور التالي (توزيع أوتوماتيكي)');
  pendingKnockoutData = null;
}

function startManualKnockout(fromKey, toKey) {
  if (!pendingKnockoutData) return;
  let { from, winners } = pendingKnockoutData;
  
  // Handle special cases to get correct teams list
  let availableTeams = [...winners];
  let directQualifier = null;
  
  if (fromKey === 'R2' && toKey === 'R3' && winners.length === 5) {
    // Get best winner and best loser
    const rankedWinners = from.map(p => ({
      team: p.winner,
      scored: p.sA > p.sB ? p.sA : p.sB,
      conceded: p.sA > p.sB ? p.sB : p.sA,
      diff: (p.sA > p.sB ? p.sA : p.sB) - (p.sA > p.sB ? p.sB : p.sA)
    })).sort((a, b) => {
      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.scored !== a.scored) return b.scored - a.scored;
      if (a.conceded !== b.conceded) return a.conceded - b.conceded;
      return 0;
    });
    
    directQualifier = rankedWinners[0].team;
    const remainingFour = rankedWinners.slice(1).map(w => w.team);
    
    const losers = from.map(p => ({
      team: p.loser,
      scored: p.sA > p.sB ? p.sB : p.sA,
      conceded: p.sA > p.sB ? p.sA : p.sB,
      diff: (p.sA > p.sB ? p.sB : p.sA) - (p.sA > p.sB ? p.sA : p.sB)
    })).sort((a, b) => {
      if (b.scored !== a.scored) return b.scored - a.scored;
      if (a.conceded !== b.conceded) return a.conceded - b.conceded;
      return b.diff - a.diff;
    });
    
    const luckyLoser = losers[0].team;
    availableTeams = [...remainingFour, luckyLoser];
    state.knockout.directToSF = directQualifier;
  } else if (fromKey === 'R3' && toKey === 'SF' && state.knockout.directToSF) {
    directQualifier = state.knockout.directToSF;
    availableTeams = [...winners, directQualifier];
  }
  
  // Show manual pairing interface
  document.getElementById('manual-knockout').classList.remove('hidden');
  const container = document.getElementById('manual-knockout-container');
  const title = document.getElementById('manual-knockout-title');
  
  const roundNames = {
    'R3': 'الدور الثالث',
    'SF': 'نصف النهائي'
  };
  
  title.textContent = `توزيع مباريات ${roundNames[toKey] || toKey} يدوياً`;
  container.innerHTML = '';
  
  if (directQualifier) {
    const notice = document.createElement('div');
    notice.style.background = '#4CAF50';
    notice.style.color = 'white';
    notice.style.padding = '10px';
    notice.style.borderRadius = '6px';
    notice.style.marginBottom = '15px';
    notice.innerHTML = `<strong>⭐ متأهل مباشر: ${directQualifier}</strong>`;
    container.appendChild(notice);
  }
  
  const numMatches = Math.floor(availableTeams.length / 2);
  
  for (let i = 0; i < numMatches; i++) {
    const matchDiv = document.createElement('div');
    matchDiv.style.marginBottom = '15px';
    matchDiv.style.padding = '15px';
    matchDiv.style.border = '1px solid #ddd';
    matchDiv.style.borderRadius = '8px';
    matchDiv.style.background = 'white';
    
    let html = `<h4>المباراة ${i + 1}</h4>`;
    html += `<div style="display:flex; gap:10px; align-items:center; margin-top:10px;">`;
    html += `<select id="knockout-team-a-${i}" style="flex:1; padding:8px">
      <option value="">اختر الفريق الأول</option>`;
    availableTeams.forEach(team => {
      html += `<option value="${team}">${team}</option>`;
    });
    html += `</select>`;
    html += `<span style="font-weight:bold; font-size:18px;">VS</span>`;
    html += `<select id="knockout-team-b-${i}" style="flex:1; padding:8px">
      <option value="">اختر الفريق الثاني</option>`;
    availableTeams.forEach(team => {
      html += `<option value="${team}">${team}</option>`;
    });
    html += `</select>`;
    html += `</div>`;
    
    matchDiv.innerHTML = html;
    container.appendChild(matchDiv);
  }
  
  // Store context
  pendingKnockoutData.availableTeams = availableTeams;
  pendingKnockoutData.numMatches = numMatches;
}

function saveManualKnockout() {
  if (!pendingKnockoutData) return;
  
  const { toKey, availableTeams, numMatches } = pendingKnockoutData;
  const matches = [];
  const usedTeams = new Set();
  
  for (let i = 0; i < numMatches; i++) {
    const teamA = document.getElementById(`knockout-team-a-${i}`).value;
    const teamB = document.getElementById(`knockout-team-b-${i}`).value;
    
    if (!teamA || !teamB) {
      alert(`المباراة ${i + 1}: اختر الفريقين`);
      return;
    }
    
    if (teamA === teamB) {
      alert(`المباراة ${i + 1}: لا يمكن للفريق أن يلعب ضد نفسه!`);
      return;
    }
    
    if (usedTeams.has(teamA)) {
      alert(`الفريق "${teamA}" موجود في أكثر من مباراة!`);
      return;
    }
    
    if (usedTeams.has(teamB)) {
      alert(`الفريق "${teamB}" موجود في أكثر من مباراة!`);
      return;
    }
    
    usedTeams.add(teamA);
    usedTeams.add(teamB);
    matches.push({ a: teamA, b: teamB, sA: null, sB: null, winner: null, loser: null });
  }
  
  // Check all teams are used
  if (usedTeams.size !== availableTeams.length) {
    alert('بعض الفرق لم يتم توزيعها! تأكد من توزيع كل الفرق');
    return;
  }
  
  state.knockout[toKey] = matches;
  document.getElementById('manual-knockout').classList.add('hidden');
  saveAll();
  renderBracketsOrg();
  renderAudience();
  alert('تم حفظ التوزيع اليدوي بنجاح!');
  pendingKnockoutData = null;
}

function cancelManualKnockout() {
  document.getElementById('manual-knockout').classList.add('hidden');
  pendingKnockoutData = null;
}

/* Helper functions for special cases */
function handleFiveWinnersCase(from, winners, toKey) {
  // Rank winners by performance
  const rankedWinners = from.map(p => ({
    team: p.winner,
    scored: p.sA > p.sB ? p.sA : p.sB,
    conceded: p.sA > p.sB ? p.sB : p.sA,
    diff: (p.sA > p.sB ? p.sA : p.sB) - (p.sA > p.sB ? p.sB : p.sA)
  })).sort((a, b) => {
    if (b.diff !== a.diff) return b.diff - a.diff;
    if (b.scored !== a.scored) return b.scored - a.scored;
    if (a.conceded !== b.conceded) return a.conceded - b.conceded;
    return 0;
  });
  
  const directQualifier = rankedWinners[0].team;
  const remainingFour = rankedWinners.slice(1).map(w => w.team);
  
  // Get best loser
  const losers = from.map(p => ({
    team: p.loser,
    scored: p.sA > p.sB ? p.sB : p.sA,
    conceded: p.sA > p.sB ? p.sA : p.sB,
    diff: (p.sA > p.sB ? p.sB : p.sA) - (p.sA > p.sB ? p.sA : p.sB)
  })).sort((a, b) => {
    if (b.scored !== a.scored) return b.scored - a.scored;
    if (a.conceded !== b.conceded) return a.conceded - b.conceded;
    return b.diff - a.diff;
  });
  
  const luckyLoser = losers[0].team;
  
  // Store direct qualifier for semi-final
  state.knockout.directToSF = directQualifier;
  
  // Create R3 with remaining 4 winners + best loser
  const r3Teams = [...remainingFour, luckyLoser];
  const shuffled = r3Teams.sort(() => Math.random() - 0.5);
  const next = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (shuffled[i + 1]) {
      next.push({ a: shuffled[i], b: shuffled[i + 1], sA: null, sB: null, winner: null, loser: null });
    }
  }
  state.knockout[toKey] = next;
  saveAll();
  renderBracketsOrg();
  renderAudience();
  alert(`✅ توزيع أوتوماتيكي:\n\n- متأهل مباشر: ${directQualifier}\n- أفضل خاسر: ${luckyLoser}\n- الدور الثالث: 6 فرق`);
}

function handleDirectQualifierCase(winners) {
  const directQualifier = state.knockout.directToSF;
  const shuffled = [...winners, directQualifier].sort(() => Math.random() - 0.5);
  
  state.knockout.SF = [
    { a: shuffled[0], b: shuffled[1], sA: null, sB: null, winner: null, loser: null },
    { a: shuffled[2], b: shuffled[3], sA: null, sB: null, winner: null, loser: null }
  ];
  
  delete state.knockout.directToSF;
  saveAll();
  renderBracketsOrg();
  renderAudience();
  alert(`✅ توزيع أوتوماتيكي:\n\n- المتأهل المباشر: ${directQualifier}\n- 3 فائزين من الدور الثالث\n= نصف نهائي (4 فرق)`);
}

function advanceKnockout(fromKey, toKey) {
  const from = state.knockout[fromKey];
  if (!from || !from.length) { alert('لا توجد مباريات في هذا الدور'); return; }
  const winners = from.filter(p => p.winner).map(p => p.winner);
  if (winners.length !== from.length) { alert('سجِّل نتائج كل مباريات هذا الدور أولاً'); return; }
  
  // ✅ Special case: R2 → R3 with 5 winners
  if (fromKey === 'R2' && toKey === 'R3' && winners.length === 5) {
    // Rank winners by performance
    const rankedWinners = from.map(p => ({
      team: p.winner,
      scored: p.sA > p.sB ? p.sA : p.sB,
      conceded: p.sA > p.sB ? p.sB : p.sA,
      diff: (p.sA > p.sB ? p.sA : p.sB) - (p.sA > p.sB ? p.sB : p.sA)
    })).sort((a, b) => {
      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.scored !== a.scored) return b.scored - a.scored;
      if (a.conceded !== b.conceded) return a.conceded - b.conceded;
      return 0;
    });
    
    const directQualifier = rankedWinners[0].team;
    const remainingFour = rankedWinners.slice(1).map(w => w.team);
    
    // Get best loser
    const losers = from.map(p => ({
      team: p.loser,
      scored: p.sA > p.sB ? p.sB : p.sA,
      conceded: p.sA > p.sB ? p.sA : p.sB,
      diff: (p.sA > p.sB ? p.sB : p.sA) - (p.sA > p.sB ? p.sA : p.sB)
    })).sort((a, b) => {
      if (b.scored !== a.scored) return b.scored - a.scored;
      if (a.conceded !== b.conceded) return a.conceded - b.conceded;
      return b.diff - a.diff;
    });
    
    const luckyLoser = losers[0].team;
    
    if (!confirm(`نظام التأهل:\n\n✅ "${directQualifier}" - متأهل مباشرة لنصف النهائي (أفضل فائز)\n\n📋 الدور الثالث (3 مباريات):\n- 4 فائزين متبقين\n- أفضل خاسر: "${luckyLoser}"\n= 6 فرق → 3 فائزين\n\n🏆 نصف النهائي:\n- المتأهل المباشر\n- 3 فائزين من الدور الثالث\n= 4 فرق\n\nهل توافق؟`)) {
      return;
    }
    
    // Store direct qualifier for semi-final
    state.knockout.directToSF = directQualifier;
    
    // Create R3 with remaining 4 winners + best loser
    const r3Teams = [...remainingFour, luckyLoser];
    const shuffled = r3Teams.sort(() => Math.random() - 0.5);
    const next = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      if (shuffled[i + 1]) {
        next.push({ a: shuffled[i], b: shuffled[i + 1], sA: null, sB: null, winner: null, loser: null });
      }
    }
    state.knockout[toKey] = next;
    saveAll();
    renderBracketsOrg();
    renderAudience();
    alert(`✅ تم الإعداد:\n\n- متأهل مباشر: ${directQualifier}\n- الدور الثالث: 6 فرق\n\nبعد انتهاء الدور الثالث، استخدم زر "إنشاء نصف النهائي"`);
    return;
  }
  
  // ✅ Special case: R3 → SF when there's a direct qualifier
  if (fromKey === 'R3' && toKey === 'SF' && state.knockout.directToSF) {
    const directQualifier = state.knockout.directToSF;
    const shuffled = [...winners, directQualifier].sort(() => Math.random() - 0.5);
    
    state.knockout.SF = [
      { a: shuffled[0], b: shuffled[1], sA: null, sB: null, winner: null, loser: null },
      { a: shuffled[2], b: shuffled[3], sA: null, sB: null, winner: null, loser: null }
    ];
    
    delete state.knockout.directToSF; // Clear after use
    saveAll();
    renderBracketsOrg();
    renderAudience();
    alert(`✅ تم إنشاء نصف النهائي:\n\n- المتأهل المباشر: ${directQualifier}\n- 3 فائزين من الدور الثالث\n= 4 فرق (مباراتين)`);
    return;
  }
  
  // Normal case
  const shuffled = winners.sort(() => Math.random() - 0.5);
  const next = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (shuffled[i + 1]) {
      next.push({ a: shuffled[i], b: shuffled[i + 1], sA: null, sB: null, winner: null, loser: null });
    }
  }
  state.knockout[toKey] = next;
  saveAll();
  renderBracketsOrg();
  renderAudience();
  alert('تم إنشاء الدور التالي');
}

function skipToSemiFinal() {
  // Check if R2 exists and has winners
  const r2 = state.knockout.R2;
  if (!r2 || !r2.length) { 
    alert('يجب إنشاء الدور الثاني أولاً'); 
    return; 
  }
  
  const winners = r2.filter(p => p.winner).map(p => p.winner);
  if (winners.length !== r2.length) { 
    alert('سجِّل نتائج كل مباريات الدور الثاني أولاً'); 
    return; 
  }
  
  // Check if we have exactly 4 winners for semi-final
  if (winners.length !== 4) {
    alert(`عدد الفائزين ${winners.length} - نصف النهائي يحتاج 4 فرق بالضبط`);
    return;
  }
  
  // Create semi-final directly
  const shuffled = winners.sort(() => Math.random() - 0.5);
  state.knockout.SF = [
    { a: shuffled[0], b: shuffled[1], sA: null, sB: null, winner: null, loser: null },
    { a: shuffled[2], b: shuffled[3], sA: null, sB: null, winner: null, loser: null }
  ];
  
  // Clear R3 if it exists
  delete state.knockout.R3;
  
  saveAll();
  updateKnockoutButtons(); // ✅ Update buttons
  renderBracketsOrg(); 
  renderAudience(); 
  alert('تم تخطي الدور الثالث والانتقال مباشرة لنصف النهائي');
}

function advanceFinals() {
  const sf = state.knockout.SF; 
  if (!sf || !sf.length) { alert('لا يوجد نصف نهائي'); return; }
  if (sf.some(p => !p.winner)) { alert('سجل نتائج نصف النهائي أولاً'); return; }
  const winners = sf.map(p => p.winner), losers = sf.map(p => p.loser);
  state.knockout.F = [{ a: winners[0], b: winners[1], sA: null, sB: null, winner: null, loser: null }];
  state.knockout.P3 = [{ a: losers[0], b: losers[1], sA: null, sB: null, winner: null, loser: null }];
  saveAll();
  updateKnockoutButtons(); // ✅ Update buttons
  renderBracketsOrg(); 
  renderAudience(); 
  alert('تم إنشاء النهائي ومباراة المركز الثالث');
}

function renderBracketsOrg() {
  const host = document.getElementById('org-brackets');
  if (!host) return;
  host.innerHTML = '';
  
  // ✅ Show direct qualifier notice if exists
  if (state.knockout.directToSF) {
    const noticeCard = document.createElement('div');
    noticeCard.className = 'card';
    noticeCard.style.background = '#4CAF50';
    noticeCard.style.color = 'white';
    noticeCard.style.padding = '15px';
    noticeCard.style.marginBottom = '15px';
    noticeCard.innerHTML = `<h4 style="margin:0">⭐ متأهل مباشر لنصف النهائي: <strong>${state.knockout.directToSF}</strong></h4>`;
    host.appendChild(noticeCard);
  }
  
  const order = [['R2', 'الدور الثاني'], ['R3', 'الدور الثالث'], ['SF', 'نصف النهائي'], ['F', 'النهائي'], ['P3', 'مركز ثالث']];
  order.forEach(([k, label]) => {
    const list = state.knockout[k] || [];
    const card = document.createElement('div'); card.className = 'card';
    let html = `<h4>${label}</h4>`;
    if (!list.length) html += `<div class="muted">لا يوجد</div>`;
    list.forEach((p, idx) => {
      html += `<div class="pair">
        <span>${p.a}</span><input type="number" id="${k}-a-${idx}" placeholder="أهداف ${p.a}" style="width:80px" value="${p.sA === null ? '' : p.sA}" />
        <span class="vs">:</span>
        <input type="number" id="${k}-b-${idx}" placeholder="أهداف ${p.b}" style="width:80px" value="${p.sB === null ? '' : p.sB}" />
        <button onclick="saveBracketResult('${k}',${idx})">حفظ</button>
        ${p.winner ? `<span class="ok">الفائز: ${p.winner}</span>` : ''}
        ${p.loser ? `<span class="bad">الخاسر: ${p.loser}</span>` : ''}
      </div>`;
    });
    card.innerHTML = html; host.appendChild(card);
  });
}

function saveBracketResult(stage, idx) {
  const list = state.knockout[stage]; if (!list) return;
  const p = list[idx];
  const sA = parseInt(document.getElementById(`${stage}-a-${idx}`).value || '0', 10);
  const sB = parseInt(document.getElementById(`${stage}-b-${idx}`).value || '0', 10);
  if (isNaN(sA) || isNaN(sB)) { alert('أدخل أرقام صحيحة'); return; }
  p.sA = sA; p.sB = sB;
  if (sA === sB) { alert('الأدوار الإقصائية تحتاج فائز (سجِّل نتيجة مختلفة أو ضع نتيجة بعد ضربات الترجيح)'); return; }
  p.winner = sA > sB ? p.a : p.b; p.loser = sA > sB ? p.b : p.a;
  saveAll();
  updateKnockoutButtons(); // ✅ Update buttons after saving result
  renderBracketsOrg(); 
  renderAudience();
}

/* Audience render */
function renderAudience() {
  // groups
  const gHost = document.getElementById('audience-groups');
  if (!gHost) return;
  gHost.innerHTML = '';

  // ✅ Show final results at the top if available
  const finalMatch = state.knockout.F?.[0];
  const thirdPlaceMatch = state.knockout.P3?.[0];
  
  if (finalMatch && finalMatch.winner) {
    const podiumCard = document.createElement('div');
    podiumCard.className = 'card';
    podiumCard.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    podiumCard.style.color = 'white';
    podiumCard.style.textAlign = 'center';
    podiumCard.style.padding = '30px';
    podiumCard.style.marginBottom = '20px';
    
    let podiumHTML = '<h2 style="margin-bottom:25px; font-size:28px;">🏆 نتائج البطولة النهائية 🏆</h2>';
    podiumHTML += '<div style="display:flex; justify-content:center; align-items:flex-end; gap:20px; margin-top:20px;">';
    
    // Second place
    const secondPlace = finalMatch.loser;
    podiumHTML += `
      <div style="flex:1; max-width:200px;">
        <div style="background:rgba(255,255,255,0.2); padding:20px; border-radius:12px; backdrop-filter:blur(10px);">
          <div style="font-size:48px; margin-bottom:10px;">🥈</div>
          <div style="font-size:20px; font-weight:bold; margin-bottom:5px;">${secondPlace}</div>
          <div style="font-size:16px; opacity:0.9;">المركز الثاني</div>
        </div>
      </div>
    `;
    
    // First place (Champion)
    const champion = finalMatch.winner;
    podiumHTML += `
      <div style="flex:1; max-width:220px; transform:translateY(-20px);">
        <div style="background:rgba(255,215,0,0.3); padding:25px; border-radius:12px; backdrop-filter:blur(10px); border:3px solid gold;">
          <div style="font-size:64px; margin-bottom:10px;">🏆</div>
          <div style="font-size:24px; font-weight:bold; margin-bottom:5px; text-shadow:2px 2px 4px rgba(0,0,0,0.3);">${champion}</div>
          <div style="font-size:18px; opacity:0.95;">🌟 البطل 🌟</div>
        </div>
      </div>
    `;
    
    // Third place
    if (thirdPlaceMatch && thirdPlaceMatch.winner) {
      const thirdPlace = thirdPlaceMatch.winner;
      podiumHTML += `
        <div style="flex:1; max-width:200px;">
          <div style="background:rgba(255,255,255,0.2); padding:20px; border-radius:12px; backdrop-filter:blur(10px);">
            <div style="font-size:48px; margin-bottom:10px;">🥉</div>
            <div style="font-size:20px; font-weight:bold; margin-bottom:5px;">${thirdPlace}</div>
            <div style="font-size:16px; opacity:0.9;">المركز الثالث</div>
          </div>
        </div>
      `;
    }
    
    podiumHTML += '</div>';
    
    // Show final scores
    podiumHTML += '<div style="margin-top:30px; padding-top:20px; border-top:2px solid rgba(255,255,255,0.3);">';
    podiumHTML += `<div style="font-size:18px; margin-bottom:10px;"><strong>المباراة النهائية:</strong> ${finalMatch.a} (${finalMatch.sA}) - (${finalMatch.sB}) ${finalMatch.b}</div>`;
    if (thirdPlaceMatch && thirdPlaceMatch.winner) {
      podiumHTML += `<div style="font-size:16px; opacity:0.9;"><strong>مباراة المركز الثالث:</strong> ${thirdPlaceMatch.a} (${thirdPlaceMatch.sA}) - (${thirdPlaceMatch.sB}) ${thirdPlaceMatch.b}</div>`;
    }
    podiumHTML += '</div>';
    
    podiumCard.innerHTML = podiumHTML;
    gHost.appendChild(podiumCard);
  }

  Object.keys(state.groups).sort((a, b) => a - b).forEach(gi => {
    const g = state.groups[gi];
    const sorted = sortGroup(state.standings[gi] || []);
    const card = document.createElement('div'); card.className = 'card';
    let html = `<h3>المجموعة ${parseInt(gi) + 1}</h3><div class="table"><table><thead><tr>
      <th>الفريق</th><th>لعب</th><th>فوز</th><th>تعادل</th><th>خسارة</th><th>له</th><th>عليه</th><th>فرق</th><th>نقاط</th><th>إنذار</th><th>طرد</th>
      </tr></thead><tbody>`;
    sorted.forEach(t => html += `<tr><td>${t.name}</td><td>${t.played}</td><td>${t.win}</td><td>${t.draw}</td><td>${t.lose}</td>
      <td>${t.gf}</td><td>${t.ga}</td><td>${t.gf - t.ga}</td><td><b>${t.pts}</b></td><td>${t.yellow}</td><td>${t.red}</td></tr>`);
    html += `</tbody></table></div><details style="margin-top:10px"><summary>عرض جدول المباريات</summary>`;
    const matches = state.matches[gi] || [];
    matches.forEach(m => html += `<div class="pair">${m.a} ${m.played ? '(' + m.sA + ':' + m.sB + ')' : '(لم تُسجَّل)'} <span style="margin-inline:8px">—</span> ${m.b}</div>`);
    html += `</details>`;
    card.innerHTML = html; gHost.appendChild(card);
  });

  // brackets
  const bHost = document.getElementById('audience-brackets');
  if (!bHost) return;
  bHost.innerHTML = '';
  const order = [['R2', 'الدور الثاني'], ['R3', 'الدور الثالث'], ['SF', 'نصف النهائي'], ['F', 'النهائي'], ['P3', 'مركز ثالث']];
  order.forEach(([k, label]) => {
    const list = state.knockout[k]; if (!list || !list.length) return;
    const card = document.createElement('div'); card.className = 'card';
    let html = `<h3>${label}</h3>`;
    list.forEach(p => html += `<div class="pair">${p.a} ${(p.sA === null ? '' : '(' + p.sA + ':' + p.sB + ')')} — ${p.b} ${p.winner ? `<span class="ok"> (فائز: ${p.winner})</span>` : ''}</div>`);
    card.innerHTML = html; bHost.appendChild(card);
  });
}

/* Organizer render */
function renderOrganizer() { 
  renderTeamsList(); 
  renderGroupsOrg(); 
  renderBracketsOrg();
  updateKnockoutButtons(); // ✅ Update buttons when rendering organizer page
}

/* Reset all */
function resetAll() {
  if (!confirm('مسح كل البيانات؟')) return;
  state.teams = []; state.groups = {}; state.standings = {}; state.matches = {}; state.knockout = {};
  saveAll(); renderOrganizer(); renderAudience(); alert('تم المسح');
}

/* Init - Load data from Firestore */
loadFromFirestore().then(() => {
  renderTeamsList();
});