/* ============================================================
   FleetOps TMS — app.js  v2.2
   Fixes applied in this version:
     1. Trip duplication — FIXED: saveTrip() uses idx guard;
        all expense "New" buttons now call dedicated openNew
        functions that explicitly reset edit-index to -1
     2. Light/Dark theme — FIXED: initTheme() runs immediately
        on script load (before login); toggle button wired;
        full light-mode CSS overrides in style.css
     3. Edit for all sections — CONFIRMED: every section has
        editXxx(idx) / saveXxx() with idx>=0 update guard
     4. Adblue edit/delete — FIXED: openNewAdblue() added;
        renderAdblue() always emits the ACTIONS column
     5. Billing trip dropdown — FIXED: _wireBillingTripSelect()
        rebuilds options + attaches onchange each time the
        billing modal opens, not in populateSelects()
     6. Duplicate c-km assignment in calcTrip — REMOVED
     7. clearAllData / resetDemoData — both available in sidebar
   ============================================================ */

const SUPABASE_URL = '';
const SUPABASE_KEY = '';

/* ── THEME ────────────────────────────────────────────────── */
function initTheme() {
  applyTheme(localStorage.getItem('fleetops_theme') || 'dark');
}
function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('fleetops_theme', mode);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = mode === 'dark' ? '☀ Light' : '🌙 Dark';
}
function toggleTheme() {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}
// Apply saved theme immediately — before login, so page doesn't flash
initTheme();

/* ── DATA STORE ───────────────────────────────────────────── */
function getEmptyDB() {
  return {
    trips:[], vehicles:[], drivers:[], transporters:[],
    bills:[], maintenance:[], loans:[], privateLoans:[],
    repayments:[], diesel:[], fastag:[], adblue:[], otherExp:[],
    driverAdvances:[],  // NEW: advance payment records per driver
    tripCounter:1, billCounter:1,
  };
}

function loadDB() {
  const saved = localStorage.getItem('fleetops_db');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Migrate old DBs that lack driverAdvances
      if (!parsed.driverAdvances) parsed.driverAdvances = [];
      // Migrate drivers missing new salary fields
      (parsed.drivers||[]).forEach(d => {
        if (!d.salaryType)  d.salaryType  = 'fixed';
        if (!d.perTripRate) d.perTripRate = 0;
        if (!d.perKmRate)   d.perKmRate   = 0;
      });
      return parsed;
    } catch(e) {}
  }
  return {
    trips:[
      {id:1,num:'T-0001',date:'2026-04-11',vehicle:'TN01AB1234',driver:'Rajan Kumar',transporter:'Shree Transports',from:'Chennai',to:'Mumbai',startKm:82000,endKm:84400,km:2400,freight:28000,mileage:4.2,dprice:94.5,maintKm:1.8,status:'Running',notes:'',driverSalaryPaid:false,driverAdvance:0},
      {id:2,num:'T-0002',date:'2026-04-10',vehicle:'TN02CD5678',driver:'Selvam P.',transporter:'Kumar Logistics',from:'Chennai',to:'Delhi',startKm:68000,endKm:70200,km:2200,freight:32000,mileage:4.2,dprice:92,maintKm:1.8,status:'Completed',notes:'',driverSalaryPaid:false,driverAdvance:500},
    ],
    vehicles:[
      {id:1,reg:'TN01AB1234',type:'40 Ton',make:'Tata',model:'Prima 4028S',year:2022,own:'Own',chassis:'MAT123456789',engine:'E123456',ins:'2026-09-12',permit:'2026-12-31',fc:'2026-09-20',puc:'2026-08-15',status:'Active'},
      {id:2,reg:'TN02CD5678',type:'32 Ton',make:'Ashok Leyland',model:'3518',year:2021,own:'Own',chassis:'MAT987654321',engine:'E654321',ins:'2026-09-30',permit:'2026-11-30',fc:'2026-07-15',puc:'2026-06-20',status:'Active'},
    ],
    drivers:[
      {id:1,name:'Rajan Kumar',mobile:'9876543210',lic:'TN2012345678',licExp:'2028-12-31',aadhar:'1234 5678 9012',
       salary:16000,salaryType:'fixed',perTripRate:0,perKmRate:0,
       address:'Chennai',ecName:'Rajan Wife',ecMobile:'9876500001',status:'Active'},
      {id:2,name:'Selvam P.',mobile:'9765432109',lic:'TN2034567890',licExp:'2027-08-31',aadhar:'2345 6789 0123',
       salary:0,salaryType:'per-trip',perTripRate:2500,perKmRate:0,
       address:'Chennai',ecName:'Selvam Wife',ecMobile:'9765500002',status:'Active'},
    ],
    transporters:[
      {id:1,name:'Shree Transports',contact:'Ramesh',mobile:'9887766554',gstin:'33AABCS1234K1Z5',pan:'AABCS1234K',terms:30,address:'Chennai'},
      {id:2,name:'Kumar Logistics',contact:'Suresh Kumar',mobile:'9776655443',gstin:'33AABCK5678L2Z1',pan:'AABCK5678L',terms:30,address:'Coimbatore'},
    ],
    bills:[],
    maintenance:[
      {id:1,date:'2026-04-05',vehicle:'TN01AB1234',type:'Oil Change',workshop:'Tata Service Center',curKm:84000,nextKm:89000,parts:1800,labour:1400,notes:'Engine oil + filter change'},
    ],
    loans:[
      {id:1,vehicle:'TN01AB1234',fin:'HDFC Bank',principal:2800000,rate:9.5,tenure:60,emi:62000,start:'2024-10-15',dueDay:15,paid:18,acc:'HDFC123456789',status:'Active'},
    ],
    privateLoans:[],
    repayments:[],
    diesel:[
      {id:1,date:'2026-04-10',vehicle:'TN01AB1234',trip:'T-0001',litres:120,rate:94.5,amount:11340,location:'Pune Highway Pump'},
    ],
    fastag:[],
    adblue:[
      {id:1,date:'2026-04-10',vehicle:'TN01AB1234',curKm:84200,prevKm:82800,qty:20,rate:48,amount:960},
    ],
    otherExp:[],
    driverAdvances:[
      {id:1,date:'2026-04-10',driver:'Selvam P.',trip:'T-0002',amount:500,note:'Pre-trip advance'},
    ],
    tripCounter:3,
    billCounter:1,
  };
}

function saveDB() { localStorage.setItem('fleetops_db', JSON.stringify(db)); }
let db = loadDB();

function money(n) {
  return '₹' + Math.round(Number(n) || 0).toLocaleString();
}

function netBillAmount(b) {
  const freight = parseFloat(b.freight) || 0;
  const deduct = parseFloat(b.deduct) || 0;
  const tds = parseFloat(b.tds) || 0;
  const other = parseFloat(b.other) || 0;
  return freight - deduct - ((freight * tds) / 100) + other;
}

function tripFuelCost(t) {
  const km = parseFloat(t.km) || 0;
  const mileage = parseFloat(t.mileage) || 0;
  const price = parseFloat(t.dprice) || 0;
  return km > 0 && mileage > 0 ? (km / mileage) * price : 0;
}

function tripMaintCost(t) {
  return (parseFloat(t.km) || 0) * (parseFloat(t.maintKm) || 0);
}

/* ── AUTH ─────────────────────────────────────────────────── */
function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  if (u==='admin' && p==='password') {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    initApp();
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
}
document.getElementById('login-pass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
function doLogout() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
}

/* ── INIT ─────────────────────────────────────────────────── */
function initApp() {
  const btn = document.getElementById('theme-toggle');
  const mode = document.documentElement.getAttribute('data-theme') || 'dark';
  if (btn) btn.textContent = mode === 'dark' ? '☀ Light' : '🌙 Dark';
  applyRepaymentsToLoans();
  saveDB();
  populateSelects();
  renderDashboard();
  updateLiveBadges();
  startLiveTracking();   // start 30-second live refresh
}

function populateSelects() {
  const vehOpts = db.vehicles.map(v=>`<option value="${v.reg}">${v.reg}</option>`).join('');
  const drvOpts = db.drivers.map(d=>`<option value="${d.name}">${d.name}</option>`).join('');
  const trpOpts = db.transporters.map(t=>`<option value="${t.name}">${t.name}</option>`).join('');
  const tripOpts= ['<option value="">— None —</option>',...db.trips.map(t=>`<option value="${t.num}">${t.num} — ${t.from}→${t.to}</option>`)].join('');

  ['t-vehicle','ed-vehicle','ef-vehicle','ab-vehicle','eo-vehicle','m-vehicle','l-vehicle']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=vehOpts; });
  const td=document.getElementById('t-driver');      if(td) td.innerHTML=drvOpts;
  const tt=document.getElementById('t-transporter'); if(tt) tt.innerHTML=trpOpts;
  const bt=document.getElementById('b-transporter'); if(bt) bt.innerHTML=trpOpts;
  ['ed-trip','ef-trip','eo-trip'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=tripOpts; });

  // Driver advance modal driver select
  const adv=document.getElementById('adv-driver'); if(adv) adv.innerHTML=drvOpts;
  const advTrip=document.getElementById('adv-trip'); if(advTrip) advTrip.innerHTML=tripOpts;

  const bTrips = document.getElementById('b-trips');
  if (bTrips) {
    bTrips.innerHTML = db.trips.map(t=>`<option value="${t.num}">${t.num} — ${t.from}→${t.to} — ₹${t.freight.toLocaleString()}</option>`).join('');
  }

  const vf = document.getElementById('trip-vehicle-filter');
  if (vf) vf.innerHTML = '<option value="">All Vehicles</option>'+db.vehicles.map(v=>`<option value="${v.reg}">${v.reg}</option>`).join('');

  const df = document.getElementById('trip-driver-filter');
  if (df) df.innerHTML = '<option value="">All Drivers</option>'+db.drivers.map(d=>`<option value="${d.name}">${d.name}</option>`).join('');

  buildPnLMonthOptions();
}

function buildPnLMonthOptions() {
  const sel = document.getElementById('pnl-month');
  if (!sel) return;
  const prev = sel.value;
  const months = new Set();
  [
    ...db.trips.map(t => t.date),
    ...db.diesel.map(d => d.date),
    ...db.fastag.map(f => f.date),
    ...db.adblue.map(a => a.date),
    ...db.maintenance.map(m => m.date),
    ...db.otherExp.map(e => e.date),
  ].forEach(d => { if (d) months.add(d.slice(0, 7)); });
  const now = new Date();
  months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const sorted = [...months].sort().reverse();
  sel.innerHTML = '<option value="">All Time</option>' + sorted.map(m => {
    const [y, mo] = m.split('-');
    const label = new Date(y, mo - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    return `<option value="${m}">${label}</option>`;
  }).join('');
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
}

/* ── SALARY CALCULATOR ────────────────────────────────────── */
// Single source of truth: how much salary does this driver earn per trip?
/* ── SALARY ENGINE ────────────────────────────────────────────
   DESIGN PRINCIPLE:
   - When a trip is saved, the salary for that trip is LOCKED into
     trip.tripSalary. This preserves historical accuracy — changing
     a driver's rate later does NOT retroactively alter past trips.
   - If tripSalary is 0 / not set, auto-compute from driver rate × km.
   - Advances are stored in db.driverAdvances (separate table).
   - getDriverLedger() is the ONLY place salary is summed up.
   ──────────────────────────────────────────────────────────────── */

// Compute the salary for a trip from the driver's CURRENT rate settings
// Used only when filling in the trip form auto-suggestion
function computeSalaryForTrip(driverName, km) {
  const driver = db.drivers.find(d => d.name === driverName);
  if (!driver) return 0;
  const type = driver.salaryType || 'fixed';
  if (type === 'per-trip') return parseFloat(driver.perTripRate) || 0;
  if (type === 'per-km')   return Math.round((parseFloat(driver.perKmRate) || 0) * (parseFloat(km) || 0));
  return parseFloat(driver.salary) || 0;
}

// Read locked salary from the trip record (historical-safe)
function _lockedSalary(trip) {
  const locked = parseFloat(trip.tripSalary);
  if (!isNaN(locked) && locked > 0) return locked;
  return computeSalaryForTrip(trip.driver, trip.km);
}

function _driverSalaryRateLabel(driver) {
  const type = driver.salaryType || 'fixed';
  if (type === 'per-trip') return `₹${(driver.perTripRate || 0).toLocaleString()}/trip`;
  if (type === 'per-km') return `₹${(driver.perKmRate || 0).toFixed(2)}/km`;
  return `₹${(driver.salary || 0).toLocaleString()}/trip`;
}

function _driverSummarySalaryLabel(driver, trips) {
  const completed = trips.filter(t => t.status === 'Completed');
  const salaries = completed.map(_lockedSalary).filter(v => v > 0);
  if (!salaries.length) return _driverSalaryRateLabel(driver);
  const unique = [...new Set(salaries)];
  if (unique.length === 1) return `₹${unique[0].toLocaleString()}/trip`;
  const avg = Math.round(salaries.reduce((s, v) => s + v, 0) / salaries.length);
  return `Avg ₹${avg.toLocaleString()}/trip`;
}

// All advance records for a specific driver+trip
function _advancesForTrip(driverName, tripNum) {
  return db.driverAdvances
    .filter(a => a.driver === driverName && a.trip === tripNum)
    .reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
}

// SINGLE SOURCE OF TRUTH for driver salary ledger
function getDriverLedger(driverName) {
  const driver = db.drivers.find(d => d.name === driverName);
  if (!driver) return {
    driver: null, earned: 0, totalAdvances: 0,
    balance: 0, paidOut: 0, pendingPay: 0,
    trips: [], advances_list: []
  };

  // Only COMPLETED trips contribute to earned salary
  const completedTrips = db.trips.filter(t =>
    t.driver === driverName && t.status === 'Completed'
  );

  // ALL advances for this driver (trip-linked + unlinked)
  const allAdvances   = db.driverAdvances.filter(a => a.driver === driverName);
  const totalAdvances = allAdvances.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

  let totalEarned  = 0;
  let totalPaidOut = 0;

  const tripRows = completedTrips.map(t => {
    const sal  = _lockedSalary(t);         // read locked value from trip record
    const adv  = _advancesForTrip(driverName, t.num);
    const paid = t.driverSalaryPaid || false;
    const net  = sal - adv;                // net due for this trip
    totalEarned += sal;
    if (paid) totalPaidOut += net;
    return {
      num: t.num, date: t.date,
      from: t.from || '', to: t.to || '',
      km: t.km || 0,
      salary: sal,   // what was locked when trip was saved
      advance: adv,  // advances specifically for this trip
      net,           // salary − trip advances
      paid
    };
  });

  // balance  = earned − ALL advances (including unlinked ones)
  // pendingPay = balance still to hand over (after marking trips paid)
  const balance    = totalEarned - totalAdvances;
  const pendingPay = balance - totalPaidOut;

  return {
    driver, earned: totalEarned,
    totalAdvances, balance,
    paidOut: totalPaidOut, pendingPay,
    trips: tripRows,
    advances_list: allAdvances,
  };
}

/* ── NAVIGATION ───────────────────────────────────────────── */
const PAGE_TITLES  = {dashboard:'Dashboard',trips:'Trips',expenses:'Expenses',billing:'Billing',maintenance:'Maintenance',vehicles:'Vehicles',drivers:'Drivers',transporters:'Transporters',loans:'Loans',summary:'Summary',reports:'Reports'};
const TOP_BTN_LBLS = {dashboard:'+ New Trip',trips:'+ New Trip',expenses:'+ Add Expense',billing:'+ New Invoice',maintenance:'+ Add Service',vehicles:'+ Add Vehicle',drivers:'+ Add Driver',transporters:'+ Add Transporter',loans:'+ Add Loan',summary:'Export',reports:'Print / PDF'};

function showPage(page) {
  document.querySelectorAll('[id^="page-"]').forEach(el=>el.classList.add('hidden'));
  document.getElementById('page-'+page).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(el=>{
    el.classList.toggle('active', !!(el.getAttribute('onclick')&&el.getAttribute('onclick').includes("'"+page+"'")));
  });
  document.getElementById('page-title').textContent = PAGE_TITLES[page]||page;
  document.getElementById('topbar-action').textContent = TOP_BTN_LBLS[page]||'+ New';
  ({dashboard:renderDashboard,trips:renderTrips,billing:renderBilling,vehicles:renderVehicles,
    drivers:renderDrivers,transporters:renderTransporters,maintenance:renderMaintenance,loans:renderLoans,
    expenses:()=>{renderDiesel();renderFastag();renderAdblue();renderOtherExp();},
    summary:renderPnL,reports:initReportsPage})[page]?.();
}

function handleTopAction() {
  const page = document.getElementById('page-title').textContent.toLowerCase();
  if (page.includes('trip'))        openNewTrip();
  else if (page.includes('expense'))openNewExpenseDiesel();
  else if (page.includes('billing'))openNewBilling();
  else if (page.includes('maint'))  openNewMaintenance();
  else if (page.includes('vehicle'))openNewVehicle();
  else if (page.includes('driver')) openNewDriver();
  else if (page.includes('trans'))  openNewTransporter();
  else if (page.includes('loan'))   openNewLoan();
  else if (page.includes('report')) window.print();
  // summary: no-op (Export CSV button is separate)
}

function refreshSummaryViews() {
  renderPnL();
}

function refreshAfterDataChange(defaultRender) {
  if (defaultRender) defaultRender();
  refreshSummaryViews();
  renderDashboard();
  const activeReport = document.querySelector('#page-reports .tab.active');
  if (activeReport) {
    const tab = activeReport.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || 'monthly';
    if (tab === 'monthly') renderMonthlyReport();
    else if (tab === 'pending') renderPendingReport();
    else if (tab === 'balance') renderBalanceSheet();
    else if (tab === 'emi-rep') renderEmiReport();
  }
  updateLiveBadges();
}
/* ── GLOBAL SEARCH ────────────────────────────────────────── */
function globalSearch(q) {
  if(!q || q.length < 2) return;
  q=q.toLowerCase();
  // Show trips page and filter by query
  showPage('trips');
  const ts=document.getElementById('trip-search');
  if(ts){ ts.value=q; renderTrips(); }
  // Also update global search box to stay in sync
}

/* ── CSV EXPORT ENGINE ────────────────────────────────────── */
function toggleExportMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('export-menu');
  menu.classList.toggle('hidden');
}
document.addEventListener('click', () => {
  const m = document.getElementById('export-menu');
  if (m) m.classList.add('hidden');
});

function _csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
}
function _csvRow(arr) { return arr.map(_csvEscape).join(','); }
function _download(filename, csvContent) {
  const bom = '\uFEFF'; // UTF-8 BOM so Excel opens ₹ correctly
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const CSV_DEFS = {
  'trips': {
    label: 'Trips',
    headers: ['Trip#','Date','Vehicle','Driver','Transporter','From','To','Start KM','End KM','Total KM','Freight (Rs)','Mileage (kmpl)','Diesel Price (Rs/L)','Maint/km (Rs)','Fuel Cost (Rs)','Maint Cost (Rs)','Profit (Rs)','Status','Notes'],
    rows: () => db.trips.map(t => {
      const fuel = t.km > 0 ? Math.round((t.km / t.mileage) * t.dprice) : 0;
      const maint = Math.round(t.km * t.maintKm);
      return [t.num,t.date,t.vehicle,t.driver,t.transporter,t.from,t.to,t.startKm,t.endKm,t.km,t.freight,t.mileage,t.dprice,t.maintKm,fuel,maint,t.freight-fuel-maint,t.status,t.notes];
    })
  },
  'expenses-diesel': {
    label: 'Diesel_Expenses',
    headers: ['Date','Vehicle','Trip#','Litres','Rate (Rs/L)','Amount (Rs)','Location'],
    rows: () => db.diesel.map(d => [d.date,d.vehicle,d.trip,d.litres,d.rate,d.amount,d.location])
  },
  'expenses-fastag': {
    label: 'Fastag_Expenses',
    headers: ['Date','Vehicle','Trip#','Toll Plaza','Amount (Rs)'],
    rows: () => db.fastag.map(f => [f.date,f.vehicle,f.trip,f.plaza,f.amount])
  },
  'expenses-adblue': {
    label: 'Adblue_Records',
    headers: ['Date','Vehicle','Current KM','Prev Fill KM','KM per 20L','Next Fill Est. KM','Qty (L)','Rate (Rs/L)','Amount (Rs)'],
    rows: () => db.adblue.map(a => [a.date,a.vehicle,a.curKm,a.prevKm,a.curKm-a.prevKm,a.curKm+(a.curKm-a.prevKm),a.qty,a.rate,a.amount])
  },
  'expenses-other': {
    label: 'Other_Expenses',
    headers: ['Date','Vehicle','Trip#','Category','Description','Amount (Rs)'],
    rows: () => db.otherExp.map(e => [e.date,e.vehicle,e.trip,e.cat,e.desc,e.amount])
  },
  'billing': {
    label: 'Billing_Invoices',
    headers: ['Bill#','Date','Transporter','Trips','Freight (Rs)','Deduction (Rs)','TDS%','TDS Amount (Rs)','Other Charges (Rs)','Net Payable (Rs)','Status'],
    rows: () => db.bills.map(b => {
      const tds = Math.round((b.freight * b.tds) / 100);
      const net = b.freight - b.deduct - tds + b.other;
      return [b.num,b.date,b.transporter,(b.trips||[]).join('|'),b.freight,b.deduct,b.tds,tds,b.other,net,b.status];
    })
  },
  'maintenance': {
    label: 'Maintenance',
    headers: ['Date','Vehicle','Service Type','Workshop','Current KM','Next Service KM','Parts Cost (Rs)','Labour Cost (Rs)','Total Cost (Rs)','Notes'],
    rows: () => db.maintenance.map(m => [m.date,m.vehicle,m.type,m.workshop,m.curKm,m.nextKm,m.parts,m.labour,m.parts+m.labour,m.notes])
  },
  'vehicles': {
    label: 'Vehicles',
    headers: ['Reg. No','Type','Make','Model','Year','Ownership','Chassis No','Engine No','Insurance Expiry','Permit Expiry','FC Expiry','PUC Expiry','Status'],
    rows: () => db.vehicles.map(v => [v.reg,v.type,v.make,v.model,v.year,v.own,v.chassis,v.engine,v.ins,v.permit,v.fc,v.puc,v.status])
  },
  'drivers': {
    label: 'Drivers',
    headers: ['Name','Mobile','Aadhar','License No','License Expiry','Monthly Salary (Rs)','Address','Emergency Contact','Emergency Mobile','Status'],
    rows: () => db.drivers.map(d => [d.name,d.mobile,d.aadhar,d.lic,d.licExp,d.salary,d.address,d.ecName,d.ecMobile,d.status])
  },
  'transporters': {
    label: 'Transporters',
    headers: ['Name','Contact Person','Mobile','GSTIN','PAN','Payment Terms (Days)','Address'],
    rows: () => db.transporters.map(t => [t.name,t.contact,t.mobile,t.gstin,t.pan,t.terms,t.address])
  },
  'loans': {
    label: 'Vehicle_Loans',
    headers: ['Vehicle','Financier','Account No','Principal (Rs)','Interest Rate %','Tenure (Months)','EMI (Rs)','Start Date','EMI Due Day','EMIs Paid','Balance (Rs)','Status'],
    rows: () => db.loans.map(l => [l.vehicle,l.fin,l.acc,l.principal,l.rate,l.tenure,l.emi,l.start,l.dueDay,l.paid,Math.max(0,l.principal-l.emi*l.paid),l.status])
  },
  'private-loans': {
    label: 'Private_Loans',
    headers: ['Lender','Amount (Rs)','Interest Rate %','Date','Amount Paid (Rs)','Balance (Rs)','Status','Notes'],
    rows: () => db.privateLoans.map(p => [p.lender,p.amount,p.rate,p.date,p.paid||0,p.amount-(p.paid||0),p.status,p.notes])
  },
  'repayments': {
    label: 'Repayments',
    headers: ['Date','Loan Type','Loan / Lender','Amount Paid (Rs)','Reference No'],
    rows: () => db.repayments.map(r => [r.date,r.type,r.loan,r.amount,r.ref])
  },
};

function exportCSV(section) {
  document.getElementById('export-menu').classList.add('hidden');
  const ts = new Date().toISOString().slice(0,10);

  if (section === 'all') {
    // Export every section as separate files with a small delay between
    const keys = Object.keys(CSV_DEFS);
    keys.forEach((key, i) => {
      setTimeout(() => _exportSingle(key, ts), i * 300);
    });
    return;
  }
  _exportSingle(section, ts);
}

function _exportSingle(key, ts) {
  const def = CSV_DEFS[key];
  if (!def) return;
  const rows = def.rows();
  if (!rows.length) {
    alert(`No data to export for "${def.label.replace(/_/g,' ')}"`);
    return;
  }
  const csv = [_csvRow(def.headers), ...rows.map(_csvRow)].join('\r\n');
  _download(`FleetOps_${def.label}_${ts}.csv`, csv);
}

/* ── MODAL OPEN/CLOSE ─────────────────────────────────────── */
function _show(id) { document.getElementById('modal-'+id).classList.remove('hidden'); }
function closeModal(id) {
  document.getElementById('modal-'+id).classList.add('hidden');
  // reset edit indices
  const map = {trip:'edit-trip-index',vehicle:'edit-vehicle-index',driver:'edit-driver-index',
    transporter:'edit-transporter-index',maintenance:'edit-maint-index',loan:'edit-loan-index',
    billing:'edit-bill-index','expense-diesel':'edit-diesel-index',
    'expense-fastag':'edit-fastag-index','expense-adblue':'edit-adblue-index',
    'expense-other':'edit-other-index'};
  if (map[id]) { const el=document.getElementById(map[id]); if(el) el.value='-1'; }
}

document.addEventListener('keydown', e=>{
  if(e.key==='Escape') document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m=>closeModal(m.id.replace('modal-','')));
});
document.querySelectorAll('.modal-overlay').forEach(ov=>{
  ov.addEventListener('click', e=>{ if(e.target===ov) closeModal(ov.id.replace('modal-','')); });
});

const today = () => new Date().toISOString().split('T')[0];

/* ── NEW TRIP ─────────────────────────────────────────────── */
function openNewTrip() {
  populateSelects();
  document.getElementById('edit-trip-index').value = '-1';
  document.getElementById('trip-modal-title').textContent = 'New Trip';
  document.getElementById('t-num').value      = 'T-'+String(db.tripCounter).padStart(4,'0');
  document.getElementById('t-date').value     = today();
  ['t-freight','t-from','t-to','t-start-km','t-end-km','t-notes','t-trip-salary'].forEach(id=>{
    const el = document.getElementById(id); if(el) el.value='';
  });
  const salEl = document.getElementById('t-trip-salary');
  if (salEl) salEl.dataset.autoFilled = 'true';
  document.getElementById('t-mileage').value  = '4.2';
  document.getElementById('t-dprice').value   = '94.50';
  document.getElementById('t-maint-km').value = '1.8';
  calcTrip(); _show('trip');
}

// FIX #3 — editTrip sets idx BEFORE modal opens to prevent double-insert
function editTrip(idx) {
  populateSelects();
  const t = db.trips[idx];
  document.getElementById('edit-trip-index').value   = idx;
  document.getElementById('trip-modal-title').textContent = 'Edit Trip';
  document.getElementById('t-num').value             = t.num;
  document.getElementById('t-date').value            = t.date;
  document.getElementById('t-vehicle').value         = t.vehicle;
  document.getElementById('t-driver').value          = t.driver;
  document.getElementById('t-transporter').value     = t.transporter;
  document.getElementById('t-from').value            = t.from;
  document.getElementById('t-to').value              = t.to;
  document.getElementById('t-start-km').value        = t.startKm;
  document.getElementById('t-end-km').value          = t.endKm;
  document.getElementById('t-freight').value         = t.freight;
  document.getElementById('t-mileage').value         = t.mileage;
  document.getElementById('t-dprice').value          = t.dprice;
  document.getElementById('t-maint-km').value        = t.maintKm;
  document.getElementById('t-status').value          = t.status;
  document.getElementById('t-notes').value           = t.notes;
  // Load locked salary — shows what was set when trip was originally saved
  const salEl = document.getElementById('t-trip-salary');
  if (salEl) {
    salEl.value = t.tripSalary != null ? t.tripSalary : '';
    salEl.dataset.autoFilled = t.tripSalary ? 'false' : 'true';
  }
  calcTrip(); _show('trip');
}

// Auto-fill salary field when driver or km changes
function autoFillSalary() {
  const driver = document.getElementById('t-driver')?.value || '';
  const sk     = parseFloat(document.getElementById('t-start-km').value) || 0;
  const ek     = parseFloat(document.getElementById('t-end-km').value)   || 0;
  const km     = Math.max(0, ek - sk);
  const sal    = computeSalaryForTrip(driver, km);
  const salEl  = document.getElementById('t-trip-salary');
  if (salEl && (salEl.value === '' || salEl.dataset.autoFilled === 'true')) {
    salEl.value = sal || '';
    salEl.dataset.autoFilled = 'true'; // mark as auto so next driver change overwrites
  }
}

// FIX #1 — idx >= 0 = UPDATE (no duplicate), idx === -1 = INSERT
function saveTrip() {
  const idx    = parseInt(document.getElementById('edit-trip-index').value);
  const sk     = parseFloat(document.getElementById('t-start-km').value)  || 0;
  const ek     = parseFloat(document.getElementById('t-end-km').value)    || 0;
  const km     = Math.max(0, ek - sk);
  const driver = document.getElementById('t-driver').value;
  const status = document.getElementById('t-status').value;

  // tripSalary: read the field value; if blank, auto-compute from driver rate
  const salaryFieldVal = parseFloat(document.getElementById('t-trip-salary').value);
  const autoSalary     = computeSalaryForTrip(driver, km);
  // Lock salary only for Completed trips — for others store 0 until completed
  const tripSalary     = status === 'Completed'
    ? (isNaN(salaryFieldVal) || salaryFieldVal === 0 ? autoSalary : salaryFieldVal)
    : (isNaN(salaryFieldVal) ? 0 : salaryFieldVal);

  const trip = {
    id:               idx >= 0 ? db.trips[idx].id : Date.now(),
    num:              document.getElementById('t-num').value,
    date:             document.getElementById('t-date').value,
    vehicle:          document.getElementById('t-vehicle').value,
    driver,
    transporter:      document.getElementById('t-transporter').value,
    from:             document.getElementById('t-from').value,
    to:               document.getElementById('t-to').value,
    startKm: sk, endKm: ek, km,
    freight:          parseFloat(document.getElementById('t-freight').value)   || 0,
    mileage:          parseFloat(document.getElementById('t-mileage').value)   || 4.2,
    dprice:           parseFloat(document.getElementById('t-dprice').value)    || 94.5,
    maintKm:          parseFloat(document.getElementById('t-maint-km').value)  || 1.8,
    status,
    notes:            document.getElementById('t-notes').value,
    tripSalary,                        // LOCKED salary for this trip
    driverSalaryPaid: idx >= 0 ? (db.trips[idx].driverSalaryPaid || false) : false,
  };

  if (idx >= 0) db.trips[idx] = trip;
  else { db.trips.unshift(trip); db.tripCounter++; }

  saveDB(); populateSelects(); closeModal('trip'); refreshAfterDataChange(renderTrips);
}
function deleteTrip(idx){ db.trips.splice(idx,1); saveDB(); populateSelects(); refreshAfterDataChange(renderTrips); }

function deleteVehicle(idx) {
  const reg = db.vehicles[idx]?.reg;
  if (!reg) return;
  if (db.trips.some(t => t.vehicle === reg) || db.loans.some(l => l.vehicle === reg)) {
    alert('This vehicle is used in trips or loans. Edit those records before deleting it.');
    return;
  }
  db.vehicles.splice(idx, 1);
  saveDB(); populateSelects(); refreshAfterDataChange(renderVehicles);
}

function deleteDriver(idx) {
  const name = db.drivers[idx]?.name;
  if (!name) return;
  if (db.trips.some(t => t.driver === name) || db.driverAdvances.some(a => a.driver === name)) {
    alert('This driver is used in trips or advances. Edit those records before deleting the driver.');
    return;
  }
  db.drivers.splice(idx, 1);
  saveDB(); populateSelects(); refreshAfterDataChange(renderDrivers);
}

function deleteTransporter(idx) {
  const name = db.transporters[idx]?.name;
  if (!name) return;
  if (db.trips.some(t => t.transporter === name) || db.bills.some(b => b.transporter === name)) {
    alert('This transporter is used in trips or bills. Edit those records before deleting it.');
    return;
  }
  db.transporters.splice(idx, 1);
  saveDB(); populateSelects(); refreshAfterDataChange(renderTransporters);
}

/* ── VEHICLES ─────────────────────────────────────────────── */
function openNewVehicle() {
  document.getElementById('edit-vehicle-index').value=-1;
  document.getElementById('vehicle-modal-title').textContent='Add Vehicle';
  ['v-reg','v-make','v-model','v-chassis','v-engine','v-ins','v-permit','v-fc','v-puc'].forEach(id=>{ document.getElementById(id).value=''; });
  document.getElementById('v-year').value=new Date().getFullYear();
  _show('vehicle');
}
function editVehicle(idx) {
  const v=db.vehicles[idx];
  document.getElementById('edit-vehicle-index').value=idx;
  document.getElementById('vehicle-modal-title').textContent='Edit Vehicle';
  document.getElementById('v-reg').value=v.reg; document.getElementById('v-type').value=v.type;
  document.getElementById('v-make').value=v.make; document.getElementById('v-model').value=v.model;
  document.getElementById('v-year').value=v.year; document.getElementById('v-own').value=v.own;
  document.getElementById('v-chassis').value=v.chassis; document.getElementById('v-engine').value=v.engine;
  document.getElementById('v-ins').value=v.ins; document.getElementById('v-permit').value=v.permit;
  document.getElementById('v-fc').value=v.fc; document.getElementById('v-puc').value=v.puc;
  _show('vehicle');
}
function saveVehicle() {
  const idx=parseInt(document.getElementById('edit-vehicle-index').value);
  const oldReg = idx >= 0 ? db.vehicles[idx].reg : '';
  const veh={
    id:idx>=0?db.vehicles[idx].id:Date.now(),
    reg:document.getElementById('v-reg').value, type:document.getElementById('v-type').value,
    make:document.getElementById('v-make').value, model:document.getElementById('v-model').value,
    year:parseInt(document.getElementById('v-year').value)||0, own:document.getElementById('v-own').value,
    chassis:document.getElementById('v-chassis').value, engine:document.getElementById('v-engine').value,
    ins:document.getElementById('v-ins').value, permit:document.getElementById('v-permit').value,
    fc:document.getElementById('v-fc').value, puc:document.getElementById('v-puc').value,
    status:idx>=0?db.vehicles[idx].status:'Active',
  };
  if(!veh.reg.trim()){ alert('Vehicle registration is required'); return; }
  if (idx >= 0 && oldReg && oldReg !== veh.reg) {
    db.trips.forEach(t => { if (t.vehicle === oldReg) t.vehicle = veh.reg; });
    db.diesel.forEach(d => { if (d.vehicle === oldReg) d.vehicle = veh.reg; });
    db.fastag.forEach(f => { if (f.vehicle === oldReg) f.vehicle = veh.reg; });
    db.adblue.forEach(a => { if (a.vehicle === oldReg) a.vehicle = veh.reg; });
    db.otherExp.forEach(e => { if (e.vehicle === oldReg) e.vehicle = veh.reg; });
    db.maintenance.forEach(m => { if (m.vehicle === oldReg) m.vehicle = veh.reg; });
    db.loans.forEach(l => { if (l.vehicle === oldReg) l.vehicle = veh.reg; });
  }
  if(idx>=0) db.vehicles[idx]=veh; else db.vehicles.push(veh);
  saveDB(); populateSelects(); closeModal('vehicle'); refreshAfterDataChange(renderVehicles);
}

/* ── DRIVERS ──────────────────────────────────────────────── */
function openNewDriver() {
  document.getElementById('edit-driver-index').value=-1;
  document.getElementById('driver-modal-title').textContent='Add Driver';
  ['dr-name','dr-mobile','dr-lic','dr-lic-exp','dr-aadhar','dr-address','dr-ec-name','dr-ec-mobile'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('dr-salary').value='';
  document.getElementById('dr-salary-type').value='fixed';
  document.getElementById('dr-per-trip-rate').value='';
  document.getElementById('dr-per-km-rate').value='';
  toggleSalaryFields();
  _show('driver');
}
function editDriver(idx) {
  const d=db.drivers[idx];
  document.getElementById('edit-driver-index').value=idx;
  document.getElementById('driver-modal-title').textContent='Edit Driver';
  document.getElementById('dr-name').value=d.name;
  document.getElementById('dr-mobile').value=d.mobile;
  document.getElementById('dr-lic').value=d.lic;
  document.getElementById('dr-lic-exp').value=d.licExp;
  document.getElementById('dr-aadhar').value=d.aadhar;
  document.getElementById('dr-salary').value=d.salary||'';
  document.getElementById('dr-salary-type').value=d.salaryType||'fixed';
  document.getElementById('dr-per-trip-rate').value=d.perTripRate||'';
  document.getElementById('dr-per-km-rate').value=d.perKmRate||'';
  document.getElementById('dr-address').value=d.address;
  document.getElementById('dr-ec-name').value=d.ecName;
  document.getElementById('dr-ec-mobile').value=d.ecMobile;
  toggleSalaryFields();
  _show('driver');
}

function toggleSalaryFields() {
  const t = document.getElementById('dr-salary-type').value;
  const fixedRow   = document.getElementById('dr-salary-row');
  const tripRow    = document.getElementById('dr-per-trip-row');
  const kmRow      = document.getElementById('dr-per-km-row');
  if(fixedRow)  fixedRow.style.display   = t==='fixed'    ? '' : 'none';
  if(tripRow)   tripRow.style.display    = t==='per-trip' ? '' : 'none';
  if(kmRow)     kmRow.style.display      = t==='per-km'   ? '' : 'none';
}

/* ── DRIVER ADVANCES ──────────────────────────────────────── */
function openNewAdvance(driverName, tripNum) {
  document.getElementById('edit-adv-index').value = -1;
  document.getElementById('adv-modal-title').textContent = 'Record Driver Advance';
  document.getElementById('adv-date').value = today();
  document.getElementById('adv-amount').value = '';
  document.getElementById('adv-note').value = '';
  populateSelects(); // ensure dropdowns are fresh
  if (driverName) {
    const sel = document.getElementById('adv-driver');
    if (sel) sel.value = driverName;
  }
  if (tripNum) {
    const tSel = document.getElementById('adv-trip');
    if (tSel) tSel.value = tripNum;
  }
  _show('driver-advance');
}

function editAdvance(idx, driverName) {
  const a = db.driverAdvances[idx];
  if (!a) return;
  document.getElementById('edit-adv-index').value = idx;
  document.getElementById('adv-modal-title').textContent = 'Edit Advance Record';
  document.getElementById('adv-date').value   = a.date;
  document.getElementById('adv-amount').value = a.amount;
  document.getElementById('adv-note').value   = a.note || '';
  populateSelects();
  const dSel = document.getElementById('adv-driver'); if (dSel) dSel.value = a.driver;
  const tSel = document.getElementById('adv-trip');   if (tSel) tSel.value = a.trip || '';
  _show('driver-advance');
}
function saveAdvance() {
  const idx = parseInt(document.getElementById('edit-adv-index').value);
  const rec = {
    id:     idx >= 0 ? db.driverAdvances[idx].id : Date.now(),
    date:   document.getElementById('adv-date').value,
    driver: document.getElementById('adv-driver').value,
    trip:   document.getElementById('adv-trip').value || '',
    amount: parseFloat(document.getElementById('adv-amount').value) || 0,
    note:   document.getElementById('adv-note').value,
  };
  if (!rec.driver) { alert('Please select a driver'); return; }
  if (!rec.amount || rec.amount <= 0) { alert('Please enter a valid advance amount'); return; }
  if (!rec.date)  { alert('Please enter a date'); return; }

  if (idx >= 0) db.driverAdvances[idx] = rec;
  else db.driverAdvances.unshift(rec);

  saveDB();
  closeModal('driver-advance');
  refreshAfterDataChange(renderDrivers); // refresh drivers table + summaries
  // Also refresh salary detail modal if it's open for this driver
  const nameEl = document.getElementById('salary-driver-name');
  if (nameEl && nameEl.textContent === rec.driver) {
    renderDriverSalaryDetail(rec.driver);
  }
}

function markSalaryPaid(tripIdx) {
  if (tripIdx < 0 || tripIdx >= db.trips.length) return;
  db.trips[tripIdx].driverSalaryPaid = true;
  saveDB();
  // Refresh salary modal with current driver name
  const nameEl = document.getElementById('salary-driver-name');
  if (nameEl && nameEl.textContent) renderDriverSalaryDetail(nameEl.textContent);
  refreshAfterDataChange(renderDrivers); // also refresh the main drivers table + summaries
}

function markSalaryUnpaid(tripIdx) {
  if (tripIdx < 0 || tripIdx >= db.trips.length) return;
  db.trips[tripIdx].driverSalaryPaid = false;
  saveDB();
  const nameEl = document.getElementById('salary-driver-name');
  if (nameEl && nameEl.textContent) renderDriverSalaryDetail(nameEl.textContent);
  refreshAfterDataChange(renderDrivers);
}

/* ── DRIVER SALARY DETAIL MODAL ────────────────────────────── */
function openDriverSalary(driverName) {
  document.getElementById('salary-driver-name').textContent = driverName;
  renderDriverSalaryDetail(driverName);
  _show('driver-salary');
}

function renderDriverSalaryDetail(driverName) {
  if (!driverName) {
    const nameEl = document.getElementById('salary-driver-name');
    driverName = nameEl ? nameEl.textContent : '';
  }
  if (!driverName) return;

  const ledger = getDriverLedger(driverName);
  const d = ledger.driver;
  if (!d) return;

  // Salary type label and rate display
  const typeLabel = { fixed: 'Fixed Per Trip', 'per-trip': 'Per Trip Rate', 'per-km': 'Per KM Rate' }[d.salaryType] || 'Fixed';
  const rateLabel = d.salaryType === 'per-trip' ? `₹${(d.perTripRate||0).toLocaleString()} / trip`
                  : d.salaryType === 'per-km'   ? `₹${(d.perKmRate||0).toFixed(2)} / km`
                  : `₹${(d.salary||0).toLocaleString()} / trip (fixed)`;

  const summary = document.getElementById('salary-summary-html');
  if (summary) summary.innerHTML = `
    <div class="stat-grid" style="grid-template-columns:repeat(5,1fr)">
      <div class="stat-card">
        <div class="stat-label">Salary Type</div>
        <div class="stat-value" style="font-size:15px">${typeLabel}</div>
        <div class="stat-sub">${rateLabel}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Earned</div>
        <div class="stat-value text-green">₹${ledger.earned.toLocaleString()}</div>
        <div class="stat-sub">${ledger.trips.length} completed trip(s)</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Advances</div>
        <div class="stat-value text-red">₹${ledger.totalAdvances.toLocaleString()}</div>
        <div class="stat-sub">${ledger.advances_list.length} advance record(s)</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Already Paid Out</div>
        <div class="stat-value text-blue">₹${ledger.paidOut.toLocaleString()}</div>
        <div class="stat-sub">Marked as paid</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Net Still Payable</div>
        <div class="stat-value ${ledger.pendingPay >= 0 ? 'text-accent' : 'text-red'}">
          ₹${Math.abs(ledger.pendingPay).toLocaleString()}
        </div>
        <div class="stat-sub">${ledger.pendingPay >= 0 ? 'To pay driver' : 'Overpaid / excess advance'}</div>
      </div>
    </div>
    <div style="margin-top:10px;padding:10px 14px;background:var(--bg3);border-radius:6px;font-size:12px;color:var(--text2)">
      <b>How balance works:</b> Earned (₹${ledger.earned.toLocaleString()}) − All Advances (₹${ledger.totalAdvances.toLocaleString()}) = Balance (₹${ledger.balance.toLocaleString()}) &nbsp;|&nbsp; Paid Out so far: ₹${ledger.paidOut.toLocaleString()} &nbsp;|&nbsp; <b>Still to pay: ₹${Math.abs(ledger.pendingPay).toLocaleString()}</b>
    </div>`;

  // Trip-wise salary table
  const tripBody = document.getElementById('salary-trips-body');
  if (tripBody) {
    tripBody.innerHTML = ledger.trips.length ? ledger.trips.map(r => {
      const tripIdx = db.trips.findIndex(t => t.num === r.num);
      return `<tr>
        <td><span class="mono text-accent">${r.num}</span></td>
        <td>${r.date}</td>
        <td>${r.from}→${r.to}</td>
        <td class="mono">${(r.km||0).toLocaleString()} km</td>
        <td class="text-green mono">₹${r.salary.toLocaleString()}</td>
        <td class="text-red mono">₹${r.advance.toLocaleString()}</td>
        <td class="${r.net >= 0 ? 'text-accent' : 'text-red'} mono"><b>₹${r.net.toLocaleString()}</b></td>
        <td>
          ${r.paid
            ? `<span class="badge badge-green">PAID</span>`
            : `<span class="badge badge-amber">PENDING</span>`}
        </td>
        <td>
          <div class="action-row">
            ${!r.paid
              ? `<button class="btn btn-primary btn-sm" onclick="markSalaryPaid(${tripIdx})">✓ Mark Paid</button>`
              : `<button class="btn btn-ghost btn-sm" onclick="markSalaryUnpaid(${tripIdx})">↩ Undo</button>`}
            <button class="btn btn-ghost btn-sm" onclick="openNewAdvance('${driverName}','${r.num}')">+ Adv</button>
          </div>
        </td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text3)">No completed trips yet. Mark a trip as "Completed" to see salary here.</td></tr>';
  }

  // All advance records
  const advBody = document.getElementById('salary-advances-body');
  if (advBody) {
    advBody.innerHTML = ledger.advances_list.length ? ledger.advances_list.map(a => {
      const realIdx = db.driverAdvances.findIndex(x => x.id === a.id);
      return `<tr>
        <td>${a.date}</td>
        <td>${a.trip ? `<span class="mono text-accent">${a.trip}</span>` : '<span class="text-muted">Unlinked</span>'}</td>
        <td class="text-red mono">₹${(a.amount||0).toLocaleString()}</td>
        <td>${a.note || '—'}</td>
        <td><div class="action-row">
          <div class="icon-btn" onclick="editAdvance(${realIdx},'${driverName}')" title="Edit">✎</div>
          <div class="icon-btn" onclick="confirmDelete('Delete this advance record?',()=>{db.driverAdvances.splice(${realIdx},1);saveDB();renderDriverSalaryDetail('${driverName}');refreshAfterDataChange(renderDrivers)})">✕</div>
        </div></td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:14px;color:var(--text3)">No advance records — click + Advance to add one</td></tr>';
  }
}
function saveDriver() {
  const idx=parseInt(document.getElementById('edit-driver-index').value);
  const salType = document.getElementById('dr-salary-type').value;
  const oldName = idx >= 0 ? db.drivers[idx].name : '';
  const drv={
    id:idx>=0?db.drivers[idx].id:Date.now(),
    name:document.getElementById('dr-name').value,
    mobile:document.getElementById('dr-mobile').value,
    lic:document.getElementById('dr-lic').value,
    licExp:document.getElementById('dr-lic-exp').value,
    aadhar:document.getElementById('dr-aadhar').value,
    salary:parseFloat(document.getElementById('dr-salary').value)||0,
    salaryType: salType,
    perTripRate: parseFloat(document.getElementById('dr-per-trip-rate').value)||0,
    perKmRate:   parseFloat(document.getElementById('dr-per-km-rate').value)||0,
    address:document.getElementById('dr-address').value,
    ecName:document.getElementById('dr-ec-name').value,
    ecMobile:document.getElementById('dr-ec-mobile').value,
    status:idx>=0?db.drivers[idx].status:'Active',
  };
  if(!drv.name.trim()){ alert('Driver name is required'); return; }
  if (idx >= 0 && oldName && oldName !== drv.name) {
    db.trips.forEach(t => { if (t.driver === oldName) t.driver = drv.name; });
    db.driverAdvances.forEach(a => { if (a.driver === oldName) a.driver = drv.name; });
  }
  if(idx>=0) db.drivers[idx]=drv; else db.drivers.push(drv);
  saveDB(); populateSelects(); closeModal('driver'); refreshAfterDataChange(renderDrivers);
}

/* ── TRANSPORTERS ─────────────────────────────────────────── */
function openNewTransporter() {
  document.getElementById('edit-transporter-index').value=-1;
  document.getElementById('transporter-modal-title').textContent='Add Transporter';
  ['tr-name','tr-contact','tr-mobile','tr-gstin','tr-pan','tr-address'].forEach(id=>{ document.getElementById(id).value=''; });
  document.getElementById('tr-terms').value='30';
  _show('transporter');
}
function editTransporter(idx) {
  const t=db.transporters[idx];
  document.getElementById('edit-transporter-index').value=idx;
  document.getElementById('transporter-modal-title').textContent='Edit Transporter';
  document.getElementById('tr-name').value=t.name; document.getElementById('tr-contact').value=t.contact;
  document.getElementById('tr-mobile').value=t.mobile; document.getElementById('tr-gstin').value=t.gstin;
  document.getElementById('tr-pan').value=t.pan; document.getElementById('tr-terms').value=t.terms;
  document.getElementById('tr-address').value=t.address;
  _show('transporter');
}
function saveTransporter() {
  const idx=parseInt(document.getElementById('edit-transporter-index').value);
  const oldName = idx >= 0 ? db.transporters[idx].name : '';
  const trp={
    id:idx>=0?db.transporters[idx].id:Date.now(),
    name:document.getElementById('tr-name').value, contact:document.getElementById('tr-contact').value,
    mobile:document.getElementById('tr-mobile').value, gstin:document.getElementById('tr-gstin').value,
    pan:document.getElementById('tr-pan').value, terms:parseInt(document.getElementById('tr-terms').value)||30,
    address:document.getElementById('tr-address').value,
  };
  if (!trp.name.trim()) { alert('Transporter name is required'); return; }
  if (idx >= 0 && oldName && oldName !== trp.name) {
    db.trips.forEach(t => { if (t.transporter === oldName) t.transporter = trp.name; });
    db.bills.forEach(b => { if (b.transporter === oldName) b.transporter = trp.name; });
  }
  if(idx>=0) db.transporters[idx]=trp; else db.transporters.push(trp);
  saveDB(); populateSelects(); closeModal('transporter'); refreshAfterDataChange(renderTransporters);
}

/* ── BILLING ──────────────────────────────────────────────── */
function _wireBillingTripSelect() {
  const bTrips = document.getElementById('b-trips');
  if (!bTrips) return;
  // Rebuild options with latest trip data
  bTrips.innerHTML = db.trips.map(t=>
    `<option value="${t.num}">${t.num} — ${t.from}→${t.to} — ₹${t.freight.toLocaleString()}</option>`
  ).join('');
  // Single onchange: sum freight of selected trips
  bTrips.onchange = () => {
    const total = [...bTrips.selectedOptions].reduce((s,o)=>{
      const trip = db.trips.find(t=>t.num===o.value);
      return s + (trip ? trip.freight : 0);
    }, 0);
    const fEl = document.getElementById('b-freight');
    if (fEl) { fEl.value = total; calcBill(); }
  };
}

function openNewBilling() {
  document.getElementById('edit-bill-index').value=-1;
  document.getElementById('billing-modal-title').textContent='Create Invoice';
  document.getElementById('b-num').value   ='INV-'+String(db.billCounter).padStart(4,'0');
  document.getElementById('b-date').value  =today();
  document.getElementById('b-freight').value=''; document.getElementById('b-deduct').value='0';
  document.getElementById('b-tds').value='2'; document.getElementById('b-other').value='0';
  _wireBillingTripSelect();
  // deselect all
  const bTrips=document.getElementById('b-trips');
  if(bTrips) [...bTrips.options].forEach(o=>o.selected=false);
  calcBill(); _show('billing');
}
function editBill(idx) {
  const b=db.bills[idx];
  document.getElementById('edit-bill-index').value=idx;
  document.getElementById('billing-modal-title').textContent='Edit Invoice';
  document.getElementById('b-num').value=b.num; document.getElementById('b-date').value=b.date;
  document.getElementById('b-transporter').value=b.transporter;
  document.getElementById('b-freight').value=b.freight; document.getElementById('b-deduct').value=b.deduct;
  document.getElementById('b-tds').value=b.tds; document.getElementById('b-other').value=b.other;
  _wireBillingTripSelect();
  const bTrips=document.getElementById('b-trips');
  if(bTrips) [...bTrips.options].forEach(o=>{ o.selected=(b.trips||[]).includes(o.value); });
  calcBill(); _show('billing');
}
function saveBill() {
  const idx=parseInt(document.getElementById('edit-bill-index').value);
  const selTrips=[...document.getElementById('b-trips').selectedOptions].map(o=>o.value);
  const bill={
    id:idx>=0?db.bills[idx].id:Date.now(),
    num:document.getElementById('b-num').value, date:document.getElementById('b-date').value,
    transporter:document.getElementById('b-transporter').value, trips:selTrips,
    freight:parseFloat(document.getElementById('b-freight').value)||0,
    deduct:parseFloat(document.getElementById('b-deduct').value)||0,
    tds:isNaN(parseFloat(document.getElementById('b-tds').value)) ? 2 : parseFloat(document.getElementById('b-tds').value),
    other:parseFloat(document.getElementById('b-other').value)||0,
    status:idx>=0?db.bills[idx].status:'Pending',
  };
  if(idx>=0) db.bills[idx]=bill; else { db.bills.unshift(bill); db.billCounter++; }
  saveDB(); closeModal('billing'); refreshAfterDataChange(renderBilling);
}
function markBillPaid(idx){ db.bills[idx].status='Paid'; saveDB(); refreshAfterDataChange(renderBilling); }
function deleteBill(idx){ db.bills.splice(idx,1); saveDB(); refreshAfterDataChange(renderBilling); }

/* ── MAINTENANCE ──────────────────────────────────────────── */
function openNewMaintenance() {
  document.getElementById('edit-maint-index').value=-1;
  document.getElementById('maint-modal-title').textContent='Add Service Record';
  ['m-workshop','m-cur-km','m-next-km','m-notes'].forEach(id=>{ document.getElementById(id).value=''; });
  document.getElementById('m-parts').value='0'; document.getElementById('m-labour').value='0';
  document.getElementById('m-date').value=today();
  _show('maintenance');
}
function editMaintenance(idx) {
  const m=db.maintenance[idx];
  document.getElementById('edit-maint-index').value=idx;
  document.getElementById('maint-modal-title').textContent='Edit Service Record';
  document.getElementById('m-date').value=m.date; document.getElementById('m-vehicle').value=m.vehicle;
  document.getElementById('m-type').value=m.type; document.getElementById('m-workshop').value=m.workshop;
  document.getElementById('m-cur-km').value=m.curKm; document.getElementById('m-next-km').value=m.nextKm;
  document.getElementById('m-parts').value=m.parts; document.getElementById('m-labour').value=m.labour;
  document.getElementById('m-notes').value=m.notes;
  _show('maintenance');
}
function saveMaintenance() {
  const idx=parseInt(document.getElementById('edit-maint-index').value);
  const rec={
    id:idx>=0?db.maintenance[idx].id:Date.now(),
    date:document.getElementById('m-date').value, vehicle:document.getElementById('m-vehicle').value,
    type:document.getElementById('m-type').value, workshop:document.getElementById('m-workshop').value,
    curKm:parseFloat(document.getElementById('m-cur-km').value)||0,
    nextKm:parseFloat(document.getElementById('m-next-km').value)||0,
    parts:parseFloat(document.getElementById('m-parts').value)||0,
    labour:parseFloat(document.getElementById('m-labour').value)||0,
    notes:document.getElementById('m-notes').value,
  };
  if(idx>=0) db.maintenance[idx]=rec; else db.maintenance.unshift(rec);
  saveDB(); closeModal('maintenance'); refreshAfterDataChange(renderMaintenance);
}
function deleteMaintenance(idx){ db.maintenance.splice(idx,1); saveDB(); refreshAfterDataChange(renderMaintenance); }

/* ── LOANS ────────────────────────────────────────────────── */
function openNewLoan() {
  document.getElementById('edit-loan-index').value=-1;
  document.getElementById('loan-modal-title').textContent='Add Vehicle Loan';
  ['l-fin','l-principal','l-rate','l-tenure','l-emi','l-start','l-acc'].forEach(id=>{ document.getElementById(id).value=''; });
  document.getElementById('l-due-day').value='1'; document.getElementById('l-paid').value='0';
  _show('loan');
}
function editLoan(idx) {
  const l=db.loans[idx];
  document.getElementById('edit-loan-index').value=idx;
  document.getElementById('loan-modal-title').textContent='Edit Vehicle Loan';
  document.getElementById('l-vehicle').value=l.vehicle; document.getElementById('l-fin').value=l.fin;
  document.getElementById('l-principal').value=l.principal; document.getElementById('l-rate').value=l.rate;
  document.getElementById('l-tenure').value=l.tenure; document.getElementById('l-emi').value=l.emi;
  document.getElementById('l-start').value=l.start; document.getElementById('l-due-day').value=l.dueDay;
  document.getElementById('l-paid').value=l.paid; document.getElementById('l-acc').value=l.acc;
  _show('loan');
}
function saveLoan() {
  const idx=parseInt(document.getElementById('edit-loan-index').value);
  const loan={
    id:idx>=0?db.loans[idx].id:Date.now(),
    vehicle:document.getElementById('l-vehicle').value, fin:document.getElementById('l-fin').value,
    principal:parseFloat(document.getElementById('l-principal').value)||0,
    rate:parseFloat(document.getElementById('l-rate').value)||0,
    tenure:parseInt(document.getElementById('l-tenure').value)||60,
    emi:parseFloat(document.getElementById('l-emi').value)||0,
    start:document.getElementById('l-start').value,
    dueDay:parseInt(document.getElementById('l-due-day').value)||1,
    paid:parseInt(document.getElementById('l-paid').value)||0,
    acc:document.getElementById('l-acc').value,
    status:idx>=0?db.loans[idx].status:'Active',
  };
  if(idx>=0) db.loans[idx]=loan; else db.loans.push(loan);
  saveDB(); closeModal('loan'); refreshAfterDataChange(renderLoans);
}
function deleteLoan(idx){ db.loans.splice(idx,1); saveDB(); refreshAfterDataChange(renderLoans); }

/* ── PRIVATE LOANS ────────────────────────────────────────── */
function openNewPrivateLoan() {
  document.getElementById('edit-pl-index').value = -1;
  document.getElementById('pl-modal-title').textContent = 'Add Private Loan';
  document.getElementById('pl-lender').value = '';
  document.getElementById('pl-amount').value = '';
  document.getElementById('pl-rate').value = '0';
  document.getElementById('pl-notes').value = '';
  document.getElementById('pl-date').value = today();
  _show('private-loan');
}
function editPrivateLoan(idx) {
  const p = db.privateLoans[idx];
  document.getElementById('edit-pl-index').value = idx;
  document.getElementById('pl-modal-title').textContent = 'Edit Private Loan';
  document.getElementById('pl-lender').value = p.lender;
  document.getElementById('pl-amount').value = p.amount;
  document.getElementById('pl-rate').value = p.rate;
  document.getElementById('pl-date').value = p.date;
  document.getElementById('pl-notes').value = p.notes || '';
  _show('private-loan');
}
function savePrivateLoan() {
  const idx = parseInt(document.getElementById('edit-pl-index').value);
  const rec = {
    id: idx >= 0 ? db.privateLoans[idx].id : Date.now(),
    lender: document.getElementById('pl-lender').value.trim(),
    amount: parseFloat(document.getElementById('pl-amount').value) || 0,
    rate:   parseFloat(document.getElementById('pl-rate').value) || 0,
    date:   document.getElementById('pl-date').value,
    paid:   idx >= 0 ? db.privateLoans[idx].paid : 0,
    status: idx >= 0 ? db.privateLoans[idx].status : 'Active',
    notes:  document.getElementById('pl-notes').value,
  };
  if (!rec.lender) { alert('Lender name is required'); return; }
  if (idx >= 0) db.privateLoans[idx] = rec;
  else db.privateLoans.unshift(rec);
  saveDB(); closeModal('private-loan'); refreshAfterDataChange(renderLoans);
}
function deletePrivateLoan(idx){ db.privateLoans.splice(idx,1); saveDB(); refreshAfterDataChange(renderLoans); }

/* ── REPAYMENTS ───────────────────────────────────────────── */
function updateRepaymentLoans() {
  const type = document.getElementById('rp-type').value;
  const sel  = document.getElementById('rp-loan');
  if (type === 'Vehicle Loan') {
    sel.innerHTML = db.loans.length
      ? db.loans.map(l => `<option value="${l.fin} — ${l.vehicle}">${l.fin} — ${l.vehicle}</option>`).join('')
      : '<option value="">No vehicle loans found</option>';
  } else {
    sel.innerHTML = db.privateLoans.length
      ? db.privateLoans.map(p => `<option value="${p.lender}">${p.lender}</option>`).join('')
      : '<option value="">No private loans found</option>';
  }
}

function applyRepaymentsToLoans() {
  db.privateLoans.forEach(p => {
    p.paid = db.repayments
      .filter(r => r.type === 'Private Loan' && r.loan === p.lender)
      .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    p.status = p.paid >= p.amount && p.amount > 0 ? 'Paid' : 'Active';
  });
  db.loans.forEach(l => {
    const key = `${l.fin} — ${l.vehicle}`;
    const paidAmount = db.repayments
      .filter(r => r.type === 'Vehicle Loan' && r.loan === key)
      .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const paidByAmount = l.emi > 0 ? Math.floor(paidAmount / l.emi) : 0;
    l.paid = Math.max(parseInt(l.paid) || 0, Math.min(parseInt(l.tenure) || 0, paidByAmount));
    l.status = l.paid >= l.tenure && l.tenure > 0 ? 'Paid' : 'Active';
  });
}

function openNewRepayment() {
  document.getElementById('edit-rp-index').value = -1;
  document.getElementById('rp-modal-title').textContent = 'Record Repayment';
  document.getElementById('rp-date').value = today();
  document.getElementById('rp-type').value = 'Vehicle Loan';
  document.getElementById('rp-amount').value = '';
  document.getElementById('rp-ref').value = '';
  updateRepaymentLoans();
  _show('repayment');
}
function saveRepayment() {
  const idx = parseInt(document.getElementById('edit-rp-index').value);
  const rec = {
    id:     idx >= 0 ? db.repayments[idx].id : Date.now(),
    date:   document.getElementById('rp-date').value,
    type:   document.getElementById('rp-type').value,
    loan:   document.getElementById('rp-loan').value,
    amount: parseFloat(document.getElementById('rp-amount').value) || 0,
    ref:    document.getElementById('rp-ref').value,
  };
  if (!rec.loan) { alert('Please select a loan'); return; }
  if (!rec.amount) { alert('Please enter the amount paid'); return; }
  if (idx >= 0) db.repayments[idx] = rec;
  else db.repayments.unshift(rec);
  applyRepaymentsToLoans();
  saveDB(); closeModal('repayment'); refreshAfterDataChange(renderLoans);
}
function deleteRepayment(idx){ db.repayments.splice(idx,1); applyRepaymentsToLoans(); saveDB(); refreshAfterDataChange(renderLoans); }

/* ── EXPENSES ─────────────────────────────────────────────── */
function openNewExpenseDiesel() {
  document.getElementById('edit-diesel-index').value=-1;
  ['ed-litres','ed-amount','ed-location'].forEach(id=>{ document.getElementById(id).value=''; });
  document.getElementById('ed-date').value=today(); document.getElementById('ed-rate').value='94.50';
  _show('expense-diesel');
}

/* FIX: dedicated New openers so edit-index is always reset to -1 */
function openNewExpenseFastag() {
  document.getElementById('edit-fastag-index').value=-1;
  document.getElementById('ef-plaza').value='';
  document.getElementById('ef-amount').value='';
  document.getElementById('ef-date').value=today();
  _show('expense-fastag');
}
function openNewAdblue() {
  document.getElementById('edit-adblue-index').value=-1;
  document.getElementById('ab-cur-km').value='';
  document.getElementById('ab-prev-km').value='';
  document.getElementById('ab-date').value=today();
  document.getElementById('ab-qty').value='20';
  document.getElementById('ab-rate').value='48';
  calcAdblue();
  _show('expense-adblue');
}
function openNewOtherExpense() {
  document.getElementById('edit-other-index').value=-1;
  document.getElementById('eo-amount').value='';
  document.getElementById('eo-desc').value='';
  document.getElementById('eo-date').value=today();
  _show('expense-other');
}

function editDiesel(idx) {
  const d=db.diesel[idx];
  document.getElementById('edit-diesel-index').value=idx;
  document.getElementById('ed-date').value=d.date; document.getElementById('ed-vehicle').value=d.vehicle;
  document.getElementById('ed-trip').value=d.trip; document.getElementById('ed-litres').value=d.litres;
  document.getElementById('ed-rate').value=d.rate; document.getElementById('ed-amount').value=d.amount;
  document.getElementById('ed-location').value=d.location;
  _show('expense-diesel');
}
function saveDiesel() {
  const idx=parseInt(document.getElementById('edit-diesel-index').value);
  const rec={
    id:idx>=0?db.diesel[idx].id:Date.now(),
    date:document.getElementById('ed-date').value, vehicle:document.getElementById('ed-vehicle').value,
    trip:document.getElementById('ed-trip').value,
    litres:parseFloat(document.getElementById('ed-litres').value)||0,
    rate:parseFloat(document.getElementById('ed-rate').value)||0,
    amount:parseFloat(document.getElementById('ed-amount').value)||0,
    location:document.getElementById('ed-location').value,
  };
  if(idx>=0) db.diesel[idx]=rec; else db.diesel.unshift(rec);
  saveDB(); closeModal('expense-diesel'); refreshAfterDataChange(renderDiesel);
}
function deleteDiesel(idx){ db.diesel.splice(idx,1); saveDB(); refreshAfterDataChange(renderDiesel); }

function editFastag(idx) {
  const f=db.fastag[idx];
  document.getElementById('edit-fastag-index').value=idx;
  document.getElementById('ef-date').value=f.date; document.getElementById('ef-vehicle').value=f.vehicle;
  document.getElementById('ef-trip').value=f.trip; document.getElementById('ef-plaza').value=f.plaza;
  document.getElementById('ef-amount').value=f.amount;
  _show('expense-fastag');
}
function saveFastag() {
  const idx=parseInt(document.getElementById('edit-fastag-index').value);
  const rec={
    id:idx>=0?db.fastag[idx].id:Date.now(),
    date:document.getElementById('ef-date').value, vehicle:document.getElementById('ef-vehicle').value,
    trip:document.getElementById('ef-trip').value, plaza:document.getElementById('ef-plaza').value,
    amount:parseFloat(document.getElementById('ef-amount').value)||0,
  };
  if(idx>=0) db.fastag[idx]=rec; else db.fastag.unshift(rec);
  saveDB(); closeModal('expense-fastag'); refreshAfterDataChange(renderFastag);
}
function deleteFastag(idx){ db.fastag.splice(idx,1); saveDB(); refreshAfterDataChange(renderFastag); }

// FIX #4 — Adblue has full edit/delete support
function editAdblue(idx) {
  const a=db.adblue[idx];
  document.getElementById('edit-adblue-index').value=idx;
  document.getElementById('ab-date').value=a.date; document.getElementById('ab-vehicle').value=a.vehicle;
  document.getElementById('ab-cur-km').value=a.curKm; document.getElementById('ab-prev-km').value=a.prevKm;
  document.getElementById('ab-qty').value=a.qty; document.getElementById('ab-rate').value=a.rate;
  calcAdblue();
  _show('expense-adblue');
}
function saveAdblue() {
  const idx=parseInt(document.getElementById('edit-adblue-index').value);
  const cur=parseFloat(document.getElementById('ab-cur-km').value)||0;
  const prev=parseFloat(document.getElementById('ab-prev-km').value)||0;
  const qty=parseFloat(document.getElementById('ab-qty').value)||20;
  const rate=parseFloat(document.getElementById('ab-rate').value)||48;
  const rec={id:idx>=0?db.adblue[idx].id:Date.now(),
    date:document.getElementById('ab-date').value,vehicle:document.getElementById('ab-vehicle').value,
    curKm:cur,prevKm:prev,qty,rate,amount:qty*rate};
  if(idx>=0) db.adblue[idx]=rec; else db.adblue.unshift(rec);
  saveDB(); closeModal('expense-adblue'); refreshAfterDataChange(renderAdblue);
}
function deleteAdblue(idx){ db.adblue.splice(idx,1); saveDB(); refreshAfterDataChange(renderAdblue); }

function editOtherExp(idx) {
  const e=db.otherExp[idx];
  document.getElementById('edit-other-index').value=idx;
  document.getElementById('eo-date').value=e.date; document.getElementById('eo-vehicle').value=e.vehicle;
  document.getElementById('eo-trip').value=e.trip; document.getElementById('eo-cat').value=e.cat;
  document.getElementById('eo-desc').value=e.desc; document.getElementById('eo-amount').value=e.amount;
  _show('expense-other');
}
function saveOtherExpense() {
  const idx=parseInt(document.getElementById('edit-other-index').value);
  const rec={
    id:idx>=0?db.otherExp[idx].id:Date.now(),
    date:document.getElementById('eo-date').value, vehicle:document.getElementById('eo-vehicle').value,
    trip:document.getElementById('eo-trip').value, cat:document.getElementById('eo-cat').value,
    desc:document.getElementById('eo-desc').value,
    amount:parseFloat(document.getElementById('eo-amount').value)||0,
  };
  if(idx>=0) db.otherExp[idx]=rec; else db.otherExp.unshift(rec);
  saveDB(); closeModal('expense-other'); refreshAfterDataChange(renderOtherExp);
}
function deleteOtherExpense(idx){ db.otherExp.splice(idx,1); saveDB(); refreshAfterDataChange(renderOtherExp); }

/* ── CALCULATIONS ─────────────────────────────────────────── */
function calcTrip() {
  const sk    = parseFloat(document.getElementById('t-start-km').value) || 0;
  const ek    = parseFloat(document.getElementById('t-end-km').value)   || 0;
  const ml    = parseFloat(document.getElementById('t-mileage').value)  || 4.2;
  const dp    = parseFloat(document.getElementById('t-dprice').value)   || 94.5;
  const mk    = parseFloat(document.getElementById('t-maint-km').value) || 1.8;
  const fr    = parseFloat(document.getElementById('t-freight').value)  || 0;
  const km    = Math.max(0, ek - sk);
  const fuel  = km > 0 ? (km / ml) * dp : 0;
  const maint = km * mk;

  // Auto-fill salary if field is empty or was previously auto-filled
  autoFillSalary();
  const sal   = parseFloat(document.getElementById('t-trip-salary').value) || 0;

  const totalCost = fuel + maint + sal;
  const profit    = fr - totalCost;

  document.getElementById('c-km').textContent    = km.toLocaleString() + ' km';
  document.getElementById('c-fuel').textContent  = '₹' + Math.round(fuel).toLocaleString();
  document.getElementById('c-maint').textContent = '₹' + Math.round(maint).toLocaleString();
  document.getElementById('c-sal').textContent   = '₹' + Math.round(sal).toLocaleString();
  document.getElementById('c-cost').textContent  = '₹' + Math.round(totalCost).toLocaleString();
  const pe = document.getElementById('c-profit');
  pe.textContent  = '₹' + Math.round(profit).toLocaleString();
  pe.style.color  = profit >= 0 ? 'var(--green)' : 'var(--red)';
}

function calcBill() {
  const fr=parseFloat(document.getElementById('b-freight').value)||0;
  const ded=parseFloat(document.getElementById('b-deduct').value)||0;
  const tdsVal=parseFloat(document.getElementById('b-tds').value);
  const tds=isNaN(tdsVal)?2:tdsVal;
  const other=parseFloat(document.getElementById('b-other').value)||0;
  const tdsAmt=(fr*tds)/100;
  document.getElementById('b-c-gross').textContent='₹'+Math.round(fr).toLocaleString();
  document.getElementById('b-c-ded').textContent='- ₹'+Math.round(ded).toLocaleString();
  document.getElementById('b-c-tds').textContent='- ₹'+Math.round(tdsAmt).toLocaleString();
  document.getElementById('b-c-other').textContent='+ ₹'+Math.round(other).toLocaleString();
  document.getElementById('b-c-net').textContent='₹'+Math.round(fr-ded-tdsAmt+other).toLocaleString();
}

function calcAdblue() {
  const cur=parseFloat(document.getElementById('ab-cur-km').value)||0;
  const prev=parseFloat(document.getElementById('ab-prev-km').value)||0;
  const used=cur-prev;
  document.getElementById('ab-km-used').textContent=used>0?used.toLocaleString()+' km':'— km';
  document.getElementById('ab-eff').textContent=used>0?used.toLocaleString()+' km / 20L':'— km';
  document.getElementById('ab-next').textContent=(used>0&&cur>0)?(cur+used).toLocaleString()+' km':'— km';
}

function calcDiesel() {
  const l=parseFloat(document.getElementById('ed-litres').value)||0;
  const r=parseFloat(document.getElementById('ed-rate').value)||0;
  document.getElementById('ed-amount').value=(l*r).toFixed(2);
}

/* ── DELETE HELPER ────────────────────────────────────────── */
function confirmDelete(msg, cb) {
  document.getElementById('confirm-msg').textContent=msg;
  document.getElementById('confirm-ok-btn').onclick=()=>{ cb(); closeModal('confirm'); };
  _show('confirm');
}

/* ── HELPERS ──────────────────────────────────────────────── */
function expiryBadge(d) {
  if(!d) return '<span class="text-muted">—</span>';
  const now=new Date(); now.setHours(0,0,0,0);
  const exp=new Date(d);
  const days=Math.round((exp-now)/86400000);
  const fmt=exp.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  if(days<0)  return `<span class="expiry-expired">${fmt} ⚠</span>`;
  if(days<30) return `<span class="expiry-warn">${fmt} ⚠</span>`;
  return `<span class="expiry-ok">${fmt}</span>`;
}
function statusBadge(s) {
  const m={Running:'badge-green',Active:'badge-green',Paid:'badge-green',Loading:'badge-amber',
    Pending:'badge-amber','On Leave':'badge-amber',Service:'badge-amber',Overdue:'badge-red',
    Cancelled:'badge-red',Completed:'badge-blue',Inactive:'badge-blue'};
  return `<span class="badge ${m[s]||'badge-blue'}">${(s||'').toUpperCase()}</span>`;
}

/* ── RENDER DASHBOARD ─────────────────────────────────────── */
function renderDashboard() {
  const active=db.trips.filter(t=>t.status==='Running'||t.status==='Loading').length;
  const revenue=db.trips.reduce((s,t)=>s+t.freight,0);
  const pendingBills=db.bills.filter(b=>b.status==='Pending');
  const pendingAmt=pendingBills.reduce((s,b)=>s+netBillAmount(b),0);
  const el=id=>document.getElementById(id);

  if(el('d-active-trips')) el('d-active-trips').textContent=active;
  if(el('d-revenue'))      el('d-revenue').textContent='₹'+(revenue/100000).toFixed(1)+'L';
  if(el('d-fleet'))        el('d-fleet').textContent=db.vehicles.filter(v=>v.status==='Active').length+' / '+db.vehicles.length;
  if(el('d-pending'))      el('d-pending').textContent='₹'+(pendingAmt/100000).toFixed(1)+'L';
  if(el('d-pending-count')) el('d-pending-count').textContent=pendingBills.length+' unpaid invoice'+(pendingBills.length!==1?'s':'');

  // Recent trips
  const dash=el('dash-trips-body');
  if(dash) dash.innerHTML=db.trips.slice(0,5).map(t=>
    `<tr><td><span class="mono text-accent">${t.num}</span></td><td>${t.vehicle}</td>
     <td>${(t.from||'').slice(0,3).toUpperCase()}→${(t.to||'').slice(0,3).toUpperCase()}</td>
     <td>${statusBadge(t.status)}</td></tr>`
  ).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:12px">No trips yet — click + New Trip</td></tr>';

  // Expiry alerts — pull from all vehicles, all doc types
  const now=new Date(); now.setHours(0,0,0,0);
  const alerts=[];
  db.vehicles.forEach(v=>{
    [['Insurance',v.ins],['Permit',v.permit],['FC',v.fc],['PUC',v.puc]].forEach(([type,d])=>{
      if(!d) return;
      const exp=new Date(d); const days=Math.round((exp-now)/86400000);
      if(days<=60) alerts.push({reg:v.reg,type,d,days});
    });
  });
  alerts.sort((a,b)=>a.days-b.days);
  const urgent=alerts.filter(a=>a.days<0).length;
  const exBadge=el('d-expiry-badge');
  if(exBadge){ exBadge.textContent=urgent?urgent+' expired':alerts.length?alerts.length+' expiring soon':'All OK'; exBadge.className='badge '+(urgent?'badge-red':'badge-amber'); }
  const exBody=el('dash-expiry-body');
  if(exBody) exBody.innerHTML=alerts.slice(0,6).map(a=>{
    const badge=a.days<0?'badge-red':a.days<15?'badge-amber':'badge-blue';
    const label=a.days<0?'EXPIRED':a.days===0?'TODAY':a.days+' days';
    const fmt=new Date(a.d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    return `<tr><td>${a.reg}</td><td>${a.type}</td><td>${fmt}</td><td><span class="badge ${badge}">${label.toUpperCase()}</span></td></tr>`;
  }).join('')||'<tr><td colspan="4" style="text-align:center;padding:12px;color:var(--text3)">No expiry alerts — all documents valid</td></tr>';

  // Vehicle utilization (real KM data)
  const utilEl=el('dash-util-body');
  if(utilEl){
    if(!db.vehicles.length){ utilEl.innerHTML='<div style="color:var(--text3);font-size:12px;padding:4px">No vehicles added yet</div>'; return; }
    const kmByVeh=db.vehicles.map(v=>({reg:v.reg,km:db.trips.filter(t=>t.vehicle===v.reg).reduce((s,t)=>s+t.km,0)}));
    const maxKm=Math.max(1,...kmByVeh.map(x=>x.km));
    utilEl.innerHTML=kmByVeh.map(({reg,km})=>{
      const pct=Math.round((km/maxKm)*100);
      const barColor=pct>=70?'var(--accent)':pct>=40?'var(--amber)':'var(--red)';
      return `<div class="gauge-row">
        <span class="gauge-label">${reg}</span>
        <div class="gauge-bar"><div class="gauge-fill" style="width:${pct}%;background:${barColor}"></div></div>
        <span class="gauge-val">${pct}% · ${km.toLocaleString()} km</span>
      </div>`;
    }).join('');
  }
}

/* ── LIVE TRACKING ────────────────────────────────────────── */
// Re-render the currently visible page every 30 seconds for live feel
let _liveInterval = null;
function startLiveTracking() {
  if (_liveInterval) clearInterval(_liveInterval);
  _liveInterval = setInterval(() => {
    const page = document.getElementById('page-title')?.textContent?.toLowerCase()||'';
    if (page.includes('dashboard'))     renderDashboard();
    else if (page.includes('trip'))     renderTrips();
    else if (page.includes('billing'))  renderBilling();
    else if (page.includes('expense'))  { renderDiesel();renderFastag();renderAdblue();renderOtherExp(); }
    else if (page.includes('loan'))     renderLoans();
    else if (page.includes('summary'))  renderPnL();
    else if (page.includes('report'))   {
      const activeTab=document.querySelector('#page-reports .tab.active');
      const tab=activeTab?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1]||'monthly';
      if(tab==='monthly') renderMonthlyReport();
      else if(tab==='pending') renderPendingReport();
      else if(tab==='balance') renderBalanceSheet();
      else if(tab==='emi-rep') renderEmiReport();
    }
    // Update live counters in topbar/sidebar on every tick
    updateLiveBadges();
  }, 30000);
}

function updateLiveBadges() {
  // Nav badge: pending bills
  const pending=db.bills.filter(b=>b.status==='Pending').length;
  const badge=document.getElementById('nav-billing-badge');
  if(badge){ badge.textContent=pending||''; badge.style.display=pending?'':'none'; }
  // Running trips count
  const running=db.trips.filter(t=>t.status==='Running'||t.status==='Loading').length;
  const tb=document.getElementById('nav-trips-badge');
  if(tb){ tb.textContent=running||''; tb.style.display=running?'':'none'; }
}

/* ── RENDER TRIPS ─────────────────────────────────────────── */
function renderTrips() {
  const sf=document.getElementById('trip-status-filter')?.value||'';
  const vf=document.getElementById('trip-vehicle-filter')?.value||'';
  const df=document.getElementById('trip-driver-filter')?.value||'';
  const qf=(document.getElementById('trip-search')?.value||'').toLowerCase();
  const filtered=db.trips.filter(t=>{
    if(sf&&t.status!==sf) return false;
    if(vf&&t.vehicle!==vf) return false;
    if(df&&t.driver!==df) return false;
    if(qf&&![t.num,t.from,t.to,t.vehicle,t.driver].some(x=>(x||'').toLowerCase().includes(qf))) return false;
    return true;
  });
  const cc=document.getElementById('trip-count'); if(cc) cc.textContent=filtered.length+' trip(s)';
  const tbody=document.getElementById('trips-table-body'); if(!tbody) return;
  tbody.innerHTML=filtered.map(t=>{
    const i=db.trips.indexOf(t);
    const fuel    = Math.round(tripFuelCost(t));
    const maint   = Math.round(tripMaintCost(t));
    const drvSal  = Math.round(_driverSalForTrip(t));
    const profit  = t.freight - fuel - maint - drvSal;
    return `<tr>
      <td><span class="mono text-accent">${t.num}</span></td>
      <td>${t.date}</td><td>${t.vehicle}</td><td>${t.driver}</td>
      <td>${t.from}</td><td>${t.to}</td>
      <td class="mono">${(t.km||0).toLocaleString()}</td>
      <td>₹${t.freight.toLocaleString()}</td>
      <td class="text-red">₹${fuel.toLocaleString()}</td>
      <td class="text-amber">₹${maint.toLocaleString()}</td>
      <td class="${profit>=0?'text-green':'text-red'}">₹${profit.toLocaleString()}</td>
      <td class="mono" style="font-size:11px">₹${drvSal.toLocaleString()}</td>
      <td>${t.driverSalaryPaid ? '<span class="badge badge-green">PAID</span>' : (t.status==='Completed' ? '<span class="badge badge-amber">PENDING</span>' : '<span class="badge" style="background:var(--bg3);color:var(--text3)">N/A</span>')}</td>
      <td>${statusBadge(t.status)}</td>
      <td><div class="action-row">
        <div class="icon-btn" onclick="editTrip(${i})" title="Edit">✎</div>
        <div class="icon-btn" onclick="confirmDelete('Delete trip ${t.num}?',()=>deleteTrip(${i}))" title="Delete">✕</div>
      </div></td></tr>`;
  }).join('')||'<tr><td colspan="15" style="text-align:center;padding:20px;color:var(--text3)">No trips found</td></tr>';
}

/* ── RENDER EXPENSES ──────────────────────────────────────── */
function renderDiesel() {
  const tbody=document.getElementById('diesel-table-body'); if(!tbody) return;
  tbody.innerHTML=db.diesel.map((d,i)=>
    `<tr><td>${d.date}</td><td>${d.vehicle}</td><td class="mono text-accent">${d.trip||'—'}</td>
     <td>${d.litres}</td><td>₹${d.rate}</td><td>₹${(d.amount||0).toLocaleString()}</td><td>${d.location}</td>
     <td><div class="action-row">
       <div class="icon-btn" onclick="editDiesel(${i})" title="Edit">✎</div>
       <div class="icon-btn" onclick="confirmDelete('Delete record?',()=>deleteDiesel(${i}))">✕</div>
     </div></td></tr>`
  ).join('')||'<tr><td colspan="8" style="text-align:center;padding:14px;color:var(--text3)">No records</td></tr>';
}

function renderFastag() {
  const tbody=document.getElementById('fastag-table-body'); if(!tbody) return;
  tbody.innerHTML=db.fastag.map((f,i)=>
    `<tr><td>${f.date}</td><td>${f.vehicle}</td><td class="mono text-accent">${f.trip||'—'}</td>
     <td>${f.plaza}</td><td>₹${(f.amount||0).toLocaleString()}</td>
     <td><div class="action-row">
       <div class="icon-btn" onclick="editFastag(${i})" title="Edit">✎</div>
       <div class="icon-btn" onclick="confirmDelete('Delete record?',()=>deleteFastag(${i}))">✕</div>
     </div></td></tr>`
  ).join('')||'<tr><td colspan="6" style="text-align:center;padding:14px;color:var(--text3)">No records</td></tr>';
}

// FIX #4 — Adblue action column is always rendered; ab-best/ab-worst now populated
function renderAdblue() {
  const tbody=document.getElementById('adblue-table-body'); if(!tbody) return;
  tbody.innerHTML=db.adblue.map((a,i)=>{
    const used=a.curKm-a.prevKm;
    return `<tr>
      <td>${a.date}</td><td>${a.vehicle}</td>
      <td class="mono">${(a.curKm||0).toLocaleString()}</td>
      <td class="mono">${(a.prevKm||0).toLocaleString()}</td>
      <td class="mono text-accent">${used>0?used.toLocaleString()+' km':'—'}</td>
      <td class="mono">${used>0?(a.curKm+used).toLocaleString()+' km':'—'}</td>
      <td>₹${(a.amount||0).toLocaleString()}</td>
      <td><div class="action-row">
        <div class="icon-btn" onclick="editAdblue(${i})" title="Edit">✎</div>
        <div class="icon-btn" onclick="confirmDelete('Delete Adblue record?',()=>deleteAdblue(${i}))">✕</div>
      </div></td></tr>`;
  }).join('')||'<tr><td colspan="8" style="text-align:center;padding:14px;color:var(--text3)">No records — click + Refill to add one</td></tr>';

  // Stats panel
  const effMap={};
  db.adblue.forEach(a=>{
    const used=a.curKm-a.prevKm;
    if(used>0){if(!effMap[a.vehicle])effMap[a.vehicle]=[];effMap[a.vehicle].push(used);}
  });
  const avgs=Object.entries(effMap).map(([v,arr])=>({v,avg:Math.round(arr.reduce((s,x)=>s+x,0)/arr.length)}));
  const allAvg=avgs.length?Math.round(avgs.reduce((s,x)=>s+x.avg,0)/avgs.length):0;
  const best=avgs.length?avgs.reduce((a,b)=>a.avg>b.avg?a:b):null;
  const worst=avgs.length?avgs.reduce((a,b)=>a.avg<b.avg?a:b):null;

  const ea=document.getElementById('ab-avg');   if(ea) ea.textContent=allAvg?allAvg.toLocaleString()+' km':'—';
  const eb=document.getElementById('ab-best');  if(eb) eb.textContent=best?`${best.avg.toLocaleString()} km (${best.v})`:'—';
  const ew=document.getElementById('ab-worst'); if(ew) ew.textContent=worst?`${worst.avg.toLocaleString()} km (${worst.v})`:'—';
  const et=document.getElementById('ab-total'); if(et) et.textContent='₹'+db.adblue.reduce((s,a)=>s+(a.amount||0),0).toLocaleString();
}

function renderOtherExp() {
  const tbody=document.getElementById('other-table-body'); if(!tbody) return;
  tbody.innerHTML=db.otherExp.map((e,i)=>
    `<tr><td>${e.date}</td><td>${e.vehicle}</td><td>${e.trip||'—'}</td>
     <td><span class="chip">${e.cat}</span></td><td>${e.desc}</td><td>₹${(e.amount||0).toLocaleString()}</td>
     <td><div class="action-row">
       <div class="icon-btn" onclick="editOtherExp(${i})" title="Edit">✎</div>
       <div class="icon-btn" onclick="confirmDelete('Delete expense?',()=>deleteOtherExpense(${i}))">✕</div>
     </div></td></tr>`
  ).join('')||'<tr><td colspan="7" style="text-align:center;padding:14px;color:var(--text3)">No records</td></tr>';
}

/* ── RENDER BILLING ───────────────────────────────────────── */
function renderBilling() {
  const tbody=document.getElementById('billing-table-body'); if(!tbody) return;
  const sf = document.getElementById('billing-status-filter')?.value || '';
  const bills = db.bills.filter(b => !sf || b.status === sf);
  tbody.innerHTML=bills.map((b)=>{
    const i = db.bills.indexOf(b);
    const tdsAmt=Math.round((b.freight*b.tds)/100);
    const net=netBillAmount(b);
    return `<tr>
      <td><span class="mono text-accent">${b.num}</span></td>
      <td>${b.date}</td><td>${b.transporter}</td>
      <td style="font-size:11px">${(b.trips||[]).join(', ')||'—'}</td>
      <td>₹${b.freight.toLocaleString()}</td>
      <td class="text-red">₹${b.deduct.toLocaleString()}</td>
      <td class="text-red">₹${tdsAmt.toLocaleString()}</td>
      <td class="text-green">₹${net.toLocaleString()}</td>
      <td>${statusBadge(b.status)}</td>
      <td><div class="action-row">
        ${b.status==='Pending'?`<div class="icon-btn" onclick="markBillPaid(${i})" title="Mark Paid">✓</div>`:''}
        <div class="icon-btn" onclick="editBill(${i})" title="Edit">✎</div>
        <div class="icon-btn" onclick="confirmDelete('Delete invoice ${b.num}?',()=>deleteBill(${i}))">✕</div>
      </div></td></tr>`;
  }).join('')||'<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--text3)">No invoices found</td></tr>';

  // Live summary totals
  const totalBilled  =db.bills.reduce((s,b)=>s+b.freight,0);
  const totalReceived=db.bills.filter(b=>b.status==='Paid').reduce((s,b)=>s+netBillAmount(b),0);
  const totalPending =db.bills.filter(b=>b.status==='Pending').reduce((s,b)=>s+netBillAmount(b),0);
  const el=id=>document.getElementById(id);
  if(el('bill-total-billed'))   el('bill-total-billed').textContent  =money(totalBilled);
  if(el('bill-total-received')) el('bill-total-received').textContent=money(totalReceived);
  if(el('bill-total-pending'))  el('bill-total-pending').textContent =money(totalPending);
  if(el('bill-count-pending'))  el('bill-count-pending').textContent =db.bills.filter(b=>b.status==='Pending').length+' unpaid';
  updateLiveBadges();
}

/* ── RENDER MAINTENANCE ───────────────────────────────────── */
function renderMaintenance() {
  const tbody=document.getElementById('maint-table-body'); if(!tbody) return;
  tbody.innerHTML=db.maintenance.map((m,i)=>`<tr>
    <td>${m.date}</td><td>${m.vehicle}</td><td><span class="chip">${m.type}</span></td>
    <td class="mono">${m.curKm.toLocaleString()}</td>
    <td>₹${m.parts.toLocaleString()}</td><td>₹${m.labour.toLocaleString()}</td>
    <td>₹${(m.parts+m.labour).toLocaleString()}</td>
    <td class="text-amber mono">${m.nextKm.toLocaleString()}</td>
    <td><div class="action-row">
      <div class="icon-btn" onclick="editMaintenance(${i})" title="Edit">✎</div>
      <div class="icon-btn" onclick="confirmDelete('Delete service record?',()=>deleteMaintenance(${i}))">✕</div>
    </div></td></tr>`
  ).join('')||'<tr><td colspan="9" style="text-align:center;padding:14px;color:var(--text3)">No records</td></tr>';
  const latest={};
  db.maintenance.forEach(m=>{if(!latest[m.vehicle]||m.curKm>latest[m.vehicle].curKm) latest[m.vehicle]=m;});
  const due=document.getElementById('maint-due-list');
  if(due) due.innerHTML=Object.values(latest).map(m=>{
    const rem=m.nextKm-m.curKm;
    const cls=rem<2000?'text-red':rem<5000?'text-amber':'text-green';
    return `<div class="pl-row"><span>${m.vehicle}</span><span class="${cls} mono">${m.nextKm.toLocaleString()} km (${rem.toLocaleString()} rem)</span></div>`;
  }).join('')||'<div class="pl-row"><span class="text-muted">No data</span></div>';
  const cs=document.getElementById('maint-cost-summary');
  if(cs){const p=db.maintenance.reduce((s,m)=>s+m.parts,0),l=db.maintenance.reduce((s,m)=>s+m.labour,0);
    cs.innerHTML=`<div class="pl-row"><span class="text-muted">Parts</span><span class="mono">₹${p.toLocaleString()}</span></div>
    <div class="pl-row"><span class="text-muted">Labour</span><span class="mono">₹${l.toLocaleString()}</span></div>
    <div class="pl-row" style="font-weight:500"><span>Total</span><span class="mono text-accent">₹${(p+l).toLocaleString()}</span></div>`;}
}

/* ── RENDER VEHICLES ──────────────────────────────────────── */
function renderVehicles() {
  const tbody=document.getElementById('vehicles-table-body'); if(!tbody) return;
  tbody.innerHTML=db.vehicles.map((v,i)=>`<tr>
    <td><b>${v.reg}</b></td><td>${v.type}</td><td>${v.make} ${v.model}</td>
    <td>${v.year}</td><td><span class="chip">${v.own}</span></td>
    <td>${expiryBadge(v.ins)}</td><td>${expiryBadge(v.permit)}</td>
    <td>${expiryBadge(v.fc)}</td><td>${expiryBadge(v.puc)}</td>
    <td>${statusBadge(v.status)}</td>
    <td><div class="action-row">
      <div class="icon-btn" onclick="editVehicle(${i})" title="Edit">✎</div>
      <div class="icon-btn" onclick="confirmDelete('Delete vehicle ${v.reg}?',()=>deleteVehicle(${i}))">✕</div>
    </div></td></tr>`
  ).join('')||'<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--text3)">No vehicles added</td></tr>';
}

/* ── RENDER DRIVERS ───────────────────────────────────────── */
function renderDrivers() {
  const tbody=document.getElementById('drivers-table-body'); if(!tbody) return;
  tbody.innerHTML=db.drivers.map((d,i)=>{
    const ledger = getDriverLedger(d.name);
    const myT    = db.trips.filter(t=>t.driver===d.name);
    const km     = myT.reduce((s,t)=>s+(t.km||0),0);

    // Salary rate display
    const salLabel = d.salaryType==='per-trip'
      ? `₹${(d.perTripRate||0).toLocaleString()}/trip`
      : d.salaryType==='per-km'
      ? `₹${(d.perKmRate||0).toFixed(2)}/km`
      : `₹${(d.salary||0).toLocaleString()}/trip`;

    // pendingPay = still to be paid (after deducting advances AND already-marked-paid amounts)
    const pending = ledger.pendingPay;

    return `<tr>
      <td><b>${d.name}</b></td>
      <td>${d.mobile||'—'}</td>
      <td class="mono" style="font-size:11px">${d.lic||'—'}</td>
      <td>${expiryBadge(d.licExp)}</td>
      <td>${myT.filter(t=>t.status==='Completed').length} / ${myT.length}</td>
      <td class="mono">${km.toLocaleString()} km</td>
      <td><span class="chip">${salLabel}</span></td>
      <td class="text-green mono">₹${ledger.earned.toLocaleString()}</td>
      <td class="text-red mono">₹${ledger.totalAdvances.toLocaleString()}</td>
      <td class="${pending>0?'text-accent':pending<0?'text-red':'text-green'} mono">
        ${pending>0?`₹${pending.toLocaleString()} due`:pending<0?`₹${Math.abs(pending).toLocaleString()} excess`:'Settled'}
      </td>
      <td>${statusBadge(d.status)}</td>
      <td><div class="action-row">
        <button class="btn btn-ghost btn-sm" onclick="openDriverSalary('${d.name.replace(/'/g,"\\'")}')">₹ Salary</button>
        <div class="icon-btn" onclick="editDriver(${i})" title="Edit">✎</div>
        <div class="icon-btn" onclick="confirmDelete('Delete driver ${d.name}?',()=>deleteDriver(${i}))">✕</div>
      </div></td>
    </tr>`;
  }).join('')||'<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--text3)">No drivers added yet — click + Add Driver</td></tr>';
}

/* ── RENDER TRANSPORTERS ──────────────────────────────────── */
function renderTransporters() {
  const tbody=document.getElementById('transporters-table-body'); if(!tbody) return;
  tbody.innerHTML=db.transporters.map((t,i)=>{
    const myT=db.trips.filter(tr=>tr.transporter===t.name);
    const billed=myT.reduce((s,tr)=>s+tr.freight,0);
    const recv=db.bills.filter(b=>b.transporter===t.name&&b.status==='Paid').reduce((s,b)=>s+(b.freight-b.deduct-(b.freight*b.tds/100)+b.other),0);
    const bal=billed-recv;
    return `<tr>
      <td><b>${t.name}</b></td><td>${t.contact}</td><td>${t.mobile}</td>
      <td class="mono" style="font-size:11px">${t.gstin||'—'}</td>
      <td>${myT.length}</td><td>₹${billed.toLocaleString()}</td>
      <td>₹${Math.round(recv).toLocaleString()}</td>
      <td class="${bal>0?'text-red':'text-green'}">₹${Math.abs(bal).toLocaleString()}</td>
      <td><div class="action-row">
        <div class="icon-btn" onclick="editTransporter(${i})" title="Edit">✎</div>
        <div class="icon-btn" onclick="confirmDelete('Delete transporter?',()=>deleteTransporter(${i}))">✕</div>
      </div></td></tr>`;
  }).join('')||'<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text3)">No transporters</td></tr>';
}

/* ── RENDER LOANS ─────────────────────────────────────────── */
function renderLoans() {
  const tbody=document.getElementById('loans-table-body'); if(!tbody) return;
  tbody.innerHTML=db.loans.map((l,i)=>{
    const bal=Math.max(0,l.principal-l.emi*l.paid);
    const now=new Date();
    const due=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(l.dueDay).padStart(2,'0')}`;
    const days=Math.round((new Date(due)-now)/86400000);
    const cls=days<=5?'text-red':days<=15?'text-amber':'text-green';
    return `<tr>
      <td>${l.vehicle}</td><td>${l.fin}</td>
      <td>₹${l.principal.toLocaleString()}</td><td>₹${l.emi.toLocaleString()}/mo</td>
      <td>${l.tenure} mo</td><td>${l.paid} of ${l.tenure}</td>
      <td class="mono">₹${bal.toLocaleString()}</td>
      <td class="${cls} mono">${due}</td><td>${statusBadge(l.status)}</td>
      <td><div class="action-row">
        <div class="icon-btn" onclick="editLoan(${i})" title="Edit">✎</div>
        <div class="icon-btn" onclick="confirmDelete('Delete loan?',()=>deleteLoan(${i}))">✕</div>
      </div></td></tr>`;
  }).join('')||'<tr><td colspan="10" style="text-align:center;padding:14px;color:var(--text3)">No vehicle loans added</td></tr>';

  const es=document.getElementById('emi-summary-body');
  if(es){const total=db.loans.filter(l=>l.status==='Active').reduce((s,l)=>s+l.emi,0);
    es.innerHTML=db.loans.filter(l=>l.status==='Active').map(l=>
      `<div class="pl-row"><span>${l.vehicle}</span><span class="mono">₹${l.emi.toLocaleString()}/mo</span></div>`
    ).join('') + (db.loans.length
      ? `<div class="pl-row" style="font-weight:500;border-top:1px solid var(--border);margin-top:4px;padding-top:8px"><span>Total EMI</span><span class="mono text-red">₹${total.toLocaleString()}</span></div>`
      : '<div style="color:var(--text3);font-size:12px">No active loans</div>');}

  /* Private loans table */
  const pb=document.getElementById('private-loans-body');
  if(pb) pb.innerHTML=db.privateLoans.map((p,i)=>{const bal=p.amount-p.paid;
    return `<tr>
      <td><b>${p.lender}</b></td>
      <td>₹${p.amount.toLocaleString()}</td>
      <td>${p.rate}%</td>
      <td>${p.date||'—'}</td>
      <td>₹${(p.paid||0).toLocaleString()}</td>
      <td class="${bal>0?'text-amber':'text-green'}">₹${bal.toLocaleString()}</td>
      <td>${statusBadge(p.status)}</td>
      <td><div class="action-row">
        <div class="icon-btn" onclick="editPrivateLoan(${i})" title="Edit">✎</div>
        <div class="icon-btn" onclick="confirmDelete('Delete private loan from ${p.lender}?',()=>deletePrivateLoan(${i}))">✕</div>
      </div></td></tr>`;
  }).join('')||'<tr><td colspan="8" style="text-align:center;padding:14px;color:var(--text3)">No private loans — click + Add to record one</td></tr>';

  /* Repayments table */
  const rb=document.getElementById('repayments-body');
  if(rb) rb.innerHTML=db.repayments.map((r,i)=>`<tr>
    <td>${r.date}</td>
    <td><span class="badge badge-blue">${r.type}</span></td>
    <td>${r.loan||'—'}</td>
    <td class="text-green">₹${(r.amount||0).toLocaleString()}</td>
    <td class="mono text-muted">${r.ref||'—'}</td>
    <td><div class="action-row">
      <div class="icon-btn" onclick="confirmDelete('Delete repayment?',()=>deleteRepayment(${i}))">✕</div>
    </div></td></tr>`
  ).join('')||'<tr><td colspan="6" style="text-align:center;padding:14px;color:var(--text3)">No repayments recorded — click + Record Payment</td></tr>';
}

/* ── RENDER SUMMARY ───────────────────────────────────────── */
function renderPnL() {
  buildPnLMonthOptions();
  const month = document.getElementById('pnl-month')?.value || '';
  const inMonth = rec => !month || (rec.date || '').startsWith(month);
  const trips = db.trips.filter(inMonth);
  const rev  = trips.reduce((s,t)=>s+(t.freight||0),0);
  const fuel = db.diesel.filter(inMonth).reduce((s,d)=>s+(d.amount||0),0);
  const toll = db.fastag.filter(inMonth).reduce((s,f)=>s+(f.amount||0),0);
  const adbl = db.adblue.filter(inMonth).reduce((s,a)=>s+(a.amount||0),0);
  const mnt  = db.maintenance.filter(inMonth).reduce((s,m)=>s+(m.parts||0)+(m.labour||0),0);
  // Salary = sum of completed trip salary, using current driver rate when old trips have no locked salary.
  const sal  = trips.filter(t=>t.status==='Completed').reduce((s,t)=>s+_lockedSalary(t),0);
  const emi  = db.loans.filter(l=>l.status==='Active').reduce((s,l)=>s+(l.emi||0),0);
  const oth  = db.otherExp.filter(inMonth).reduce((s,e)=>s+(e.amount||0),0);
  const exp=fuel+toll+adbl+mnt+sal+emi+oth;
  const profit=rev-exp;
  const margin=rev>0?((profit/rev)*100).toFixed(1):0;
  const inc=document.getElementById('pnl-income');
  if(inc) inc.innerHTML=`<div class="pl-row"><span>Freight Revenue</span><span class="pl-income mono">+ ₹${rev.toLocaleString()}</span></div>
    <div class="pl-row" style="font-weight:500"><span>Total Income</span><span class="pl-income mono">+ ₹${rev.toLocaleString()}</span></div>`;
  const exEl=document.getElementById('pnl-expenses');
  if(exEl) exEl.innerHTML=`
    <div class="pl-row"><span>Diesel</span><span class="pl-expense mono">- ₹${fuel.toLocaleString()}</span></div>
    <div class="pl-row"><span>Fastag / Tolls</span><span class="pl-expense mono">- ₹${toll.toLocaleString()}</span></div>
    <div class="pl-row"><span>Adblue</span><span class="pl-expense mono">- ₹${adbl.toLocaleString()}</span></div>
    <div class="pl-row"><span>Maintenance</span><span class="pl-expense mono">- ₹${mnt.toLocaleString()}</span></div>
    <div class="pl-row"><span>Driver Salaries</span><span class="pl-expense mono">- ₹${sal.toLocaleString()}</span></div>
    <div class="pl-row"><span>EMI</span><span class="pl-expense mono">- ₹${emi.toLocaleString()}</span></div>
    <div class="pl-row"><span>Other</span><span class="pl-expense mono">- ₹${oth.toLocaleString()}</span></div>
    <div class="pl-row" style="font-weight:500"><span>Total Expenses</span><span class="pl-expense mono">- ₹${exp.toLocaleString()}</span></div>`;
  const res=document.getElementById('pnl-result');
  if(res){const color=profit>=0?'var(--green)':'var(--red)';
    res.innerHTML=`<div style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;letter-spacing:1px;margin-bottom:8px">NET ${profit>=0?'PROFIT':'LOSS'}</div>
    <div style="font-size:36px;font-weight:500;color:${color};font-family:'IBM Plex Mono',monospace">₹${Math.abs(profit).toLocaleString()}</div>
    <div style="font-size:12px;color:var(--text3);margin-top:4px">Margin: ${margin}%</div>`;}
  renderTripSummary(); renderVehicleSummary(); renderDriverSummary(); renderTransporterSummary();
}

function renderTripSummary() {
  const tbody=document.getElementById('trip-sum-body'); if(!tbody) return;
  tbody.innerHTML=db.trips.map(t=>{
    const fuel   = Math.round(tripFuelCost(t));
    const maint  = Math.round(tripMaintCost(t));
    const toll   = db.fastag.filter(f=>f.trip===t.num).reduce((s,f)=>s+(f.amount||0),0);
    const misc   = db.otherExp.filter(e=>e.trip===t.num).reduce((s,e)=>s+(e.amount||0),0);
    const dSal   = Math.round(_driverSalForTrip(t));
    const profit = t.freight - fuel - maint - toll - misc - dSal;
    const margin = t.freight > 0 ? Math.round((profit / t.freight) * 100) : 0;
    return `<tr>
      <td><span class="mono text-accent">${t.num}</span></td>
      <td>${t.vehicle}</td><td>${t.from}→${t.to}</td>
      <td class="mono">${(t.km||0).toLocaleString()}</td>
      <td>₹${t.freight.toLocaleString()}</td>
      <td class="text-red">₹${fuel.toLocaleString()}</td>
      <td class="text-red">₹${toll.toLocaleString()}</td>
      <td class="text-red">₹${misc.toLocaleString()}</td>
      <td class="text-amber mono">₹${dSal.toLocaleString()}</td>
      <td class="${profit>=0?'text-green':'text-red'}">₹${profit.toLocaleString()}</td>
      <td><span class="badge ${margin>=15?'badge-green':margin>=0?'badge-amber':'badge-red'}">${margin}%</span></td>
    </tr>`;
  }).join('')||'<tr><td colspan="11" style="text-align:center;padding:14px;color:var(--text3)">No trips yet</td></tr>';
}
function renderVehicleSummary() {
  const tbody=document.getElementById('vehicle-sum-body'); if(!tbody) return;
  tbody.innerHTML=db.vehicles.map(v=>{
    const vT=db.trips.filter(t=>t.vehicle===v.reg);
    const km=vT.reduce((s,t)=>s+t.km,0),rev=vT.reduce((s,t)=>s+t.freight,0);
    const fuel=vT.reduce((s,t)=>s+tripFuelCost(t),0);
    const maint=vT.reduce((s,t)=>s+tripMaintCost(t),0);
    const toll=db.fastag.filter(f=>f.vehicle===v.reg).reduce((s,f)=>s+(f.amount||0),0);
    const misc=db.otherExp.filter(e=>e.vehicle===v.reg).reduce((s,e)=>s+(e.amount||0),0);
    const sal=vT.reduce((s,t)=>s+_driverSalForTrip(t),0);
    const profit=rev-fuel-maint-toll-misc-sal,margin=rev>0?Math.round((profit/rev)*100):0;
    return `<tr><td><b>${v.reg}</b></td><td>${vT.length}</td><td class="mono">${km.toLocaleString()}</td>
      <td>₹${Math.round(rev).toLocaleString()}</td><td class="text-red">₹${Math.round(fuel).toLocaleString()}</td>
      <td class="text-amber">₹${Math.round(maint).toLocaleString()}</td>
      <td class="${profit>=0?'text-green':'text-red'}">₹${Math.round(profit).toLocaleString()}</td>
      <td><span class="badge ${margin>=15?'badge-green':margin>=0?'badge-amber':'badge-red'}">${margin}%</span></td></tr>`;
  }).join('');
}
function renderDriverSummary() {
  const tbody=document.getElementById('driver-sum-body'); if(!tbody) return;
  tbody.innerHTML=db.drivers.map(d=>{
    const ledger  = getDriverLedger(d.name);
    const myT     = db.trips.filter(t=>t.driver===d.name);
    const km      = myT.reduce((s,t)=>s+(t.km||0),0);
    const pending = ledger.pendingPay;
    return `<tr>
      <td><b>${d.name}</b></td>
      <td>${myT.filter(t=>t.status==='Completed').length} / ${myT.length}</td>
      <td class="mono">${km.toLocaleString()} km</td>
      <td class="text-amber mono">${_driverSummarySalaryLabel(d, myT)}</td>
      <td class="text-green mono">₹${ledger.earned.toLocaleString()}</td>
      <td class="text-red mono">₹${ledger.totalAdvances.toLocaleString()}</td>
      <td class="${pending>0?'text-accent':pending<0?'text-red':'text-green'} mono">
        ${pending>0?`₹${pending.toLocaleString()} due`:pending<0?`₹${Math.abs(pending).toLocaleString()} excess`:'Settled'}
      </td>
    </tr>`;
  }).join('')||'<tr><td colspan="7" style="text-align:center;padding:14px;color:var(--text3)">No drivers added</td></tr>';
}
function renderTransporterSummary() {
  const tbody=document.getElementById('transporter-sum-body'); if(!tbody) return;
  tbody.innerHTML=db.transporters.map(t=>{
    const tT=db.trips.filter(tr=>tr.transporter===t.name);
    const billed=tT.reduce((s,tr)=>s+tr.freight,0);
    const recv=db.bills.filter(b=>b.transporter===t.name&&b.status==='Paid').reduce((s,b)=>s+(b.freight-b.deduct-(b.freight*b.tds/100)+b.other),0);
    const pending=billed-recv;
    return `<tr><td><b>${t.name}</b></td><td>${tT.length}</td>
      <td>₹${billed.toLocaleString()}</td><td>₹${Math.round(recv).toLocaleString()}</td>
      <td class="${pending>0?'text-amber':'text-green'}">₹${Math.round(pending).toLocaleString()}</td></tr>`;
  }).join('');
}
/* ── REPORT HELPERS ───────────────────────────────────────── */
function _buildMonthOptions() {
  const sel = document.getElementById('rep-month-sel');
  if (!sel) return;
  // Collect all unique year-month combos from trips, default to current month
  const now = new Date();
  const months = new Set();
  db.trips.forEach(t => { if (t.date) months.add(t.date.slice(0,7)); });
  // Always include current month
  const cur = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  months.add(cur);
  const sorted = [...months].sort().reverse();
  const prev = sel.value;
  sel.innerHTML = sorted.map(m => {
    const [y,mo] = m.split('-');
    const label = new Date(y,mo-1,1).toLocaleString('en-IN',{month:'long',year:'numeric'});
    return `<option value="${m}"${m===prev?' selected':''}>${label}</option>`;
  }).join('');
  if (!sel.value && sorted.length) sel.value = sorted[0];
}

function _buildRepFilters() {
  const vs = document.getElementById('rep-vehicle-sel');
  if (vs) vs.innerHTML = '<option value="">All Vehicles</option>' + db.vehicles.map(v=>`<option value="${v.reg}">${v.reg}</option>`).join('');
  const ds = document.getElementById('rep-driver-sel');
  if (ds) ds.innerHTML = '<option value="">All Drivers</option>' + db.drivers.map(d=>`<option value="${d.name}">${d.name}</option>`).join('');
}

function _driverSalForTrip(t) {
  return t.status === 'Completed' ? _lockedSalary(t) : (parseFloat(t.tripSalary) || 0);
}

/* ── MONTHLY REPORT ───────────────────────────────────────── */
function renderMonthlyReport() {
  _buildMonthOptions();
  _buildRepFilters();
  const sel  = document.getElementById('rep-month-sel');
  const vSel = document.getElementById('rep-vehicle-sel');
  const dSel = document.getElementById('rep-driver-sel');
  const month = sel?.value || '';
  const vf    = vSel?.value || '';
  const df    = dSel?.value || '';

  const trips = db.trips.filter(t => {
    if (month && !t.date.startsWith(month)) return false;
    if (vf && t.vehicle !== vf) return false;
    if (df && t.driver  !== df) return false;
    return true;
  });

  let totalKm=0, totalRev=0, totalProfit=0;
  const tbody = document.getElementById('monthly-rep-body');
  if (tbody) {
    tbody.innerHTML = trips.map(t => {
      const fuel  = Math.round(tripFuelCost(t));
      const maint = Math.round(tripMaintCost(t));
      const sal   = Math.round(_driverSalForTrip(t));
      const exp   = fuel + maint + sal;
      const profit= t.freight - exp;
      totalKm     += t.km;
      totalRev    += t.freight;
      totalProfit += profit;
      return `<tr>
        <td><span class="mono text-accent">${t.num}</span></td>
        <td>${t.date}</td><td>${t.vehicle}</td><td>${t.driver}</td>
        <td>${t.from}→${t.to}</td>
        <td class="mono">${(t.km||0).toLocaleString()}</td>
        <td>₹${t.freight.toLocaleString()}</td>
        <td class="text-red">₹${fuel.toLocaleString()}</td>
        <td class="text-amber">₹${maint.toLocaleString()}</td>
        <td class="mono">₹${sal.toLocaleString()}</td>
        <td class="text-red">₹${exp.toLocaleString()}</td>
        <td class="${profit>=0?'text-green':'text-red'}">₹${profit.toLocaleString()}</td>
        <td>${statusBadge(t.status)}</td></tr>`;
    }).join('') || '<tr><td colspan="13" style="text-align:center;padding:20px;color:var(--text3)">No trips for this period</td></tr>';
  }

  const el = id => document.getElementById(id);
  if (el('rep-total-trips'))  el('rep-total-trips').textContent  = trips.length;
  if (el('rep-total-km'))     el('rep-total-km').textContent     = totalKm.toLocaleString() + ' km';
  if (el('rep-total-rev'))    el('rep-total-rev').textContent    = '₹' + totalRev.toLocaleString();
  const profEl = el('rep-total-profit');
  if (profEl) { profEl.textContent = '₹' + totalProfit.toLocaleString(); profEl.className = 'stat-value ' + (totalProfit >= 0 ? 'text-green' : 'text-red'); }
}

/* ── PENDING BILLS REPORT ─────────────────────────────────── */
function renderPendingReport() {
  const pending = db.bills.filter(b => b.status === 'Pending');
  const now = new Date(); now.setHours(0,0,0,0);
  const totalAmt = pending.reduce((s,b) => s + netBillAmount(b), 0);
  const el = id => document.getElementById(id);

  if (el('rep-pend-amt'))   el('rep-pend-amt').textContent   = '₹' + totalAmt.toLocaleString();
  if (el('rep-pend-count')) el('rep-pend-count').textContent = pending.length + ' invoice' + (pending.length!==1?'s':'');

  const ages = pending.map(b => Math.round((now - new Date(b.date))/86400000));
  const oldest = ages.length ? Math.max(...ages) : 0;
  if (el('rep-pend-oldest')) el('rep-pend-oldest').textContent = oldest ? oldest + ' days' : '—';

  const tbody = document.getElementById('pending-rep-body');
  if (!tbody) return;
  tbody.innerHTML = pending.length ? pending.map((b,i) => {
    const net  = netBillAmount(b);
    const days = Math.round((now - new Date(b.date)) / 86400000);
    const badgeCls = days > 30 ? 'badge-red' : days > 15 ? 'badge-amber' : 'badge-blue';
    const realIdx  = db.bills.indexOf(b);
    return `<tr>
      <td><span class="mono text-accent">${b.num}</span></td>
      <td>${b.date}</td>
      <td>${b.transporter}</td>
      <td style="font-size:11px">${(b.trips||[]).join(', ')||'—'}</td>
      <td class="text-green">₹${net.toLocaleString()}</td>
      <td><span class="badge ${badgeCls}">${days} day${days!==1?'s':''}</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="markBillPaid(${realIdx});renderPendingReport()">✓ Mark Paid</button></td>
    </tr>`;
  }).join('') : '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3)">No pending bills — all invoices paid ✓</td></tr>';
}

/* ── BALANCE SHEET REPORT ─────────────────────────────────── */
function renderBalanceSheet() {
  // Assets
  const receivables = db.bills.filter(b=>b.status==='Pending').reduce((s,b)=>s+netBillAmount(b),0);
  const loanBalance = db.loans.filter(l=>l.status==='Active').reduce((s,l)=>s+Math.max(0,l.principal-l.emi*l.paid),0);
  const privLoanBal = db.privateLoans.reduce((s,p)=>s+(p.amount-(p.paid||0)),0);
  // Payables = other expenses unpaid (approximate as otherExp total)
  const payables = db.otherExp.reduce((s,e)=>s+(e.amount||0),0);
  const totalLiabilities = loanBalance + privLoanBal + payables;
  // Assets: receivables, diesel cost as operational asset, no fleet value (user to enter)
  const totalAssets = receivables; // conservative: only confirmed receivables

  const assetsEl = document.getElementById('balance-assets');
  if (assetsEl) assetsEl.innerHTML = `
    <div class="pl-row"><span>Receivables (pending bills)</span><span class="mono">₹${receivables.toLocaleString()}</span></div>
    <div class="pl-row" style="font-weight:500"><span>Total Tracked Assets</span><span class="mono text-green">₹${totalAssets.toLocaleString()}</span></div>
    <div style="font-size:11px;color:var(--text3);margin-top:8px;line-height:1.5">Note: Fleet book value and cash balances are not tracked — add them to your accounting system.</div>`;

  const liabEl = document.getElementById('balance-liabilities');
  if (liabEl) liabEl.innerHTML = `
    <div class="pl-row"><span>Vehicle Loan Balances</span><span class="mono text-red">₹${loanBalance.toLocaleString()}</span></div>
    <div class="pl-row"><span>Private Loan Balances</span><span class="mono text-red">₹${privLoanBal.toLocaleString()}</span></div>
    <div class="pl-row"><span>Other Expenses (payable)</span><span class="mono text-red">₹${payables.toLocaleString()}</span></div>
    <div class="pl-row" style="font-weight:500"><span>Total Liabilities</span><span class="mono text-red">₹${totalLiabilities.toLocaleString()}</span></div>`;

  const net = totalAssets - totalLiabilities;
  const nwEl = document.getElementById('balance-networth');
  if (nwEl) nwEl.innerHTML = `
    <div style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;letter-spacing:1px;margin-bottom:8px">NET POSITION (Tracked Only)</div>
    <div style="font-size:36px;font-weight:500;color:${net>=0?'var(--green)':'var(--red)'};font-family:'IBM Plex Mono',monospace">₹${Math.abs(net).toLocaleString()}</div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">${net>=0?'Surplus (receivables exceed liabilities)':'Deficit (liabilities exceed tracked receivables)'}</div>`;
}

/* ── EMI REPORT ───────────────────────────────────────────── */
function renderEmiReport() {
  const now = new Date();
  // Default date range to current month if empty
  const fromEl = document.getElementById('emi-from');
  const toEl   = document.getElementById('emi-to');
  if (!fromEl.value) fromEl.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  if (!toEl.value)   toEl.value   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${new Date(now.getFullYear(),now.getMonth()+1,0).getDate()}`;

  const active = db.loans.filter(l => l.status === 'Active');
  const totalEmi   = active.reduce((s,l) => s + l.emi, 0);
  const repaidInRange = db.repayments.filter(r => r.date >= fromEl.value && r.date <= toEl.value && r.type === 'Vehicle Loan').reduce((s,r)=>s+(r.amount||0),0);

  const el = id => document.getElementById(id);
  if (el('emi-rep-total')) el('emi-rep-total').textContent = '₹' + totalEmi.toLocaleString() + '/mo';
  if (el('emi-rep-loans')) el('emi-rep-loans').textContent = active.length;
  if (el('emi-rep-paid'))  el('emi-rep-paid').textContent  = '₹' + repaidInRange.toLocaleString();

  const tbody = document.getElementById('emi-rep-body');
  if (!tbody) return;
  tbody.innerHTML = active.length ? active.map(l => {
    const bal = Math.max(0, l.principal - l.emi * l.paid);
    const rem = l.tenure - l.paid;
    return `<tr>
      <td><b>${l.vehicle}</b></td>
      <td>${l.fin}</td>
      <td class="mono">₹${l.principal.toLocaleString()}</td>
      <td class="mono text-accent">₹${l.emi.toLocaleString()}/mo</td>
      <td class="mono">${l.paid} / ${l.tenure}</td>
      <td class="${rem<=6?'text-amber':'text-green'} mono">${rem} left</td>
      <td class="mono text-red">₹${bal.toLocaleString()}</td>
      <td>${statusBadge(l.status)}</td></tr>`;
  }).join('') : '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text3)">No active vehicle loans</td></tr>';
}

/* ── REPORT PAGE INIT ─────────────────────────────────────── */
function initReportsPage() {
  _buildMonthOptions();
  _buildRepFilters();
  renderMonthlyReport();
}

/* ── TAB HELPERS ──────────────────────────────────────────── */
function setExpenseTab(el,tab){
  document.querySelectorAll('#page-expenses .tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');
  ['diesel','fastag','adblue','other'].forEach(t=>{const e=document.getElementById('exp-'+t);if(e)e.classList.toggle('hidden',t!==tab);});
  if(tab==='diesel')renderDiesel();
  else if(tab==='fastag')renderFastag();
  else if(tab==='adblue')renderAdblue();
  else if(tab==='other')renderOtherExp();
}
function setLoanTab(el,tab){
  document.querySelectorAll('#page-loans .tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');
  ['vehicle-loans','private-loans','repayments'].forEach(t=>{const e=document.getElementById('loan-'+t);if(e)e.classList.toggle('hidden',t!==tab);});
  renderLoans();
}
function setSumTab(el,tab){
  document.querySelectorAll('#page-summary .tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');
  ['pnl','trip-sum','vehicle-sum','driver-sum','transporter-sum'].forEach(t=>{const e=document.getElementById('sum-'+t);if(e)e.classList.toggle('hidden',t!==tab);});
  if(tab==='pnl')renderPnL();
  else if(tab==='trip-sum')renderTripSummary();
  else if(tab==='vehicle-sum')renderVehicleSummary();
  else if(tab==='driver-sum')renderDriverSummary();
  else if(tab==='transporter-sum')renderTransporterSummary();
}
function setRepTab(el,tab){
  document.querySelectorAll('#page-reports .tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');
  ['monthly','pending','balance','emi-rep'].forEach(t=>{const e=document.getElementById('rep-'+t);if(e)e.classList.toggle('hidden',t!==tab);});
  if(tab==='monthly')      renderMonthlyReport();
  else if(tab==='pending') renderPendingReport();
  else if(tab==='balance') renderBalanceSheet();
  else if(tab==='emi-rep') renderEmiReport();
}

/* ── CLEAR / RESET DATA ───────────────────────────────────── */
function clearAllData() {
  confirmDelete('Erase ALL data and start completely fresh?', ()=>{
    localStorage.removeItem('fleetops_db');
    db = getEmptyDB();
    saveDB();
    populateSelects();
    refreshAfterDataChange();
    showPage('dashboard');
  });
}

function resetDemoData() {
  confirmDelete('Reset to demo data? This will overwrite current data.', ()=>{
    localStorage.removeItem('fleetops_db');
    db = loadDB();           // loadDB() returns fresh demo data when localStorage is empty
    saveDB();
    populateSelects();
    refreshAfterDataChange();
    showPage('dashboard');
  });
}
