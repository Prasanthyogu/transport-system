/* ============================================================
   FleetOps TMS — app.js  v3.0  (Supabase Edition)
   All data is stored in Supabase. localStorage is only used
   for the UI theme preference (dark/light).
   ============================================================
   SETUP:
     1. Run supabase_schema.sql in your Supabase SQL editor
     2. Fill in SUPABASE_URL and SUPABASE_KEY below
     3. Open index.html in a browser
   ============================================================ */

const SUPABASE_URL = 'https://luwegdltqkftpyrsvdaz.supabase.co';   // e.g. https://xyzabc.supabase.co
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1d2VnZGx0cWtmdHB5cnN2ZGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzcwODIsImV4cCI6MjA5MTMxMzA4Mn0.NiEf8ybXS5OSzkgW-TnDW2pXB12j2w4Sysjz4JEKRHE'; // your anon/public key

/* ── Supabase Client ──────────────────────────────────────── */
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── THEME ────────────────────────────────────────────────── */
function initTheme() { applyTheme(localStorage.getItem('fleetops_theme') || 'dark'); }
function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('fleetops_theme', mode);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = mode === 'dark' ? '☀ Light' : '🌙 Dark';
}
function toggleTheme() {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}
initTheme();

/* ── IN-MEMORY CACHE ──────────────────────────────────────── */
// This mirrors Supabase data locally for fast rendering.
// Every write goes to Supabase first, then updates this cache.
let db = {
  trips:[], vehicles:[], drivers:[], transporters:[],
  bills:[], maintenance:[], loans:[], privateLoans:[],
  repayments:[], diesel:[], fastag:[], adblue:[], otherExp:[],
  payments:[], advances:[],
  tripCounter:1, billCounter:1,
};

/* ── LOADING UI ───────────────────────────────────────────── */
function showLoading(on, msg) {
  const el = document.getElementById('loading-overlay');
  if (!el) return;
  el.classList.toggle('hidden', !on);
  if (msg) { const t = document.getElementById('loading-text'); if(t) t.textContent = msg; }
}

/* ── CONFIG CHECK ─────────────────────────────────────────── */
function checkConfig() {
  const missing = !SUPABASE_URL || SUPABASE_URL.includes('YOUR_') ||
                  !SUPABASE_KEY || SUPABASE_KEY.includes('YOUR_');
  const banner = document.getElementById('config-banner');
  if (banner) banner.classList.toggle('hidden', !missing);
  return !missing;
}

/* ── DATA MAPPERS (DB ↔ JS) ───────────────────────────────── */
// Trips: 'from'/'to' are SQL reserved words → stored as origin/destination

const tripToDb = t => ({
  id: t.id, num: t.num, date: t.date, vehicle: t.vehicle,
  driver: t.driver, transporter: t.transporter,
  origin: t.from, destination: t.to,
  start_km: t.startKm, end_km: t.endKm, km: t.km,
  freight: t.freight, mileage: t.mileage, dprice: t.dprice,
  maint_km: t.maintKm, status: t.status, notes: t.notes,
  trip_salary: t.tripSalary,
  driver_salary_paid: t.driverSalaryPaid || false,
});
const dbToTrip = r => ({
  id: r.id, num: r.num, date: r.date, vehicle: r.vehicle,
  driver: r.driver, transporter: r.transporter,
  from: r.origin, to: r.destination,
  startKm: +r.start_km, endKm: +r.end_km, km: +r.km,
  freight: +r.freight, mileage: +r.mileage, dprice: +r.dprice,
  maintKm: +r.maint_km, status: r.status, notes: r.notes || '',
  tripSalary: +(r.trip_salary||0),
  driverSalaryPaid: r.driver_salary_paid || false,
});

const vehicleToDb = v => ({
  id: v.id, reg: v.reg, type: v.type, make: v.make, model: v.model,
  year: v.year, own: v.own, chassis: v.chassis, engine: v.engine,
  ins: v.ins, permit: v.permit, fc: v.fc, puc: v.puc, status: v.status,
});
const dbToVehicle = r => ({ ...r });

const driverToDb = d => ({
  id: d.id, name: d.name, mobile: d.mobile, lic: d.lic,
  lic_exp: d.licExp, aadhar: d.aadhar, salary: d.salary,
  salary_type: d.salaryType || 'fixed',
  per_trip_rate: d.perTripRate || 0,
  per_km_rate: d.perKmRate || 0,
  address: d.address, ec_name: d.ecName, ec_mobile: d.ecMobile, status: d.status,
});
const dbToDriver = r => ({
  id: r.id, name: r.name, mobile: r.mobile, lic: r.lic,
  licExp: r.lic_exp, aadhar: r.aadhar, salary: +r.salary,
  salaryType: r.salary_type || 'fixed',
  perTripRate: +(r.per_trip_rate || 0),
  perKmRate: +(r.per_km_rate || 0),
  address: r.address, ecName: r.ec_name, ecMobile: r.ec_mobile, status: r.status,
});

const advanceToDb = a => ({
  id: a.id, date: a.date, driver: a.driver,
  trip: a.trip || '', amount: a.amount, note: a.note || '',
});
const dbToAdvance = r => ({
  id: r.id, date: r.date, driver: r.driver,
  trip: r.trip || '', amount: +r.amount, note: r.note || '',
});

const transporterToDb = t => ({
  id: t.id, name: t.name, contact: t.contact, mobile: t.mobile,
  gstin: t.gstin, pan: t.pan, terms: t.terms, address: t.address,
});
const dbToTransporter = r => ({ ...r, terms: +r.terms });

const billToDb = b => ({
  id: b.id, num: b.num, date: b.date, transporter: b.transporter,
  trips: b.trips, freight: b.freight, deduct: b.deduct,
  other: b.other, status: b.status,
});
const dbToBill = r => ({
  ...r,
  trips: Array.isArray(r.trips) ? r.trips : [],
  freight: +r.freight, deduct: +r.deduct, tds: 0, other: +r.other,
});

const maintToDb = m => ({
  id: m.id, date: m.date, vehicle: m.vehicle, type: m.type,
  workshop: m.workshop, cur_km: m.curKm, next_km: m.nextKm,
  parts: m.parts, labour: m.labour, notes: m.notes,
});
const dbToMaint = r => ({
  id: r.id, date: r.date, vehicle: r.vehicle, type: r.type,
  workshop: r.workshop, curKm: +r.cur_km, nextKm: +r.next_km,
  parts: +r.parts, labour: +r.labour, notes: r.notes || '',
});

const loanToDb = l => ({
  id: l.id, vehicle: l.vehicle, fin: l.fin, principal: l.principal,
  rate: l.rate, tenure: l.tenure, emi: l.emi, start_date: l.start,
  due_day: l.dueDay, paid: l.paid, acc: l.acc, status: l.status,
});
const dbToLoan = r => ({
  id: r.id, vehicle: r.vehicle, fin: r.fin, principal: +r.principal,
  rate: +r.rate, tenure: +r.tenure, emi: +r.emi, start: r.start_date,
  dueDay: +r.due_day, paid: +r.paid, acc: r.acc, status: r.status,
});

const privateLoanToDb = p => ({
  id: p.id, lender: p.lender, amount: p.amount, rate: p.rate,
  date: p.date, paid: p.paid || 0, status: p.status, notes: p.notes,
});
const dbToPrivateLoan = r => ({
  ...r, amount: +r.amount, rate: +r.rate, paid: +r.paid,
});

const repaymentToDb = r => ({
  id: r.id, date: r.date, type: r.type, loan: r.loan,
  amount: r.amount, ref: r.ref,
});
const dbToRepayment = r => ({ ...r, amount: +r.amount });

const dieselToDb = d => ({
  id: d.id, date: d.date, vehicle: d.vehicle, trip: d.trip,
  litres: d.litres, rate: d.rate, amount: d.amount, location: d.location,
});
const dbToDiesel = r => ({
  ...r, litres: +r.litres, rate: +r.rate, amount: +r.amount,
});

const fastagToDb = f => ({
  id: f.id, date: f.date, vehicle: f.vehicle, trip: f.trip,
  plaza: f.plaza, amount: f.amount,
});
const dbToFastag = r => ({ ...r, amount: +r.amount });

const adblueToDb = a => ({
  id: a.id, date: a.date, vehicle: a.vehicle,
  cur_km: a.curKm, prev_km: a.prevKm, qty: a.qty, rate: a.rate, amount: a.amount,
});
const dbToAdblue = r => ({
  id: r.id, date: r.date, vehicle: r.vehicle,
  curKm: +r.cur_km, prevKm: +r.prev_km, qty: +r.qty, rate: +r.rate, amount: +r.amount,
});

const otherExpToDb = e => ({
  id: e.id, date: e.date, vehicle: e.vehicle, trip: e.trip,
  cat: e.cat, description: e.desc, amount: e.amount,
});
const dbToOtherExp = r => ({
  id: r.id, date: r.date, vehicle: r.vehicle, trip: r.trip,
  cat: r.cat, desc: r.description, amount: +r.amount,
});

/* ── LOW-LEVEL DB HELPERS ─────────────────────────────────── */
async function dbUpsert(table, row) {
  const { error } = await sb.from(table).upsert(row);
  if (error) { console.error(`[${table}] upsert error`, error); alert('Save failed: ' + error.message); return false; }
  return true;
}

async function dbDelete(table, id) {
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) { console.error(`[${table}] delete error`, error); alert('Delete failed: ' + error.message); return false; }
  return true;
}

async function getCounter(key) {
  const { data } = await sb.from('settings').select('value').eq('key', key).single();
  return data ? parseInt(data.value) : 1;
}
async function setCounter(key, value) {
  await sb.from('settings').upsert({ key, value: String(value) });
}

/* ── LOAD ALL DATA FROM SUPABASE ──────────────────────────── */
async function loadDB() {
  showLoading(true, 'Loading data from Supabase…');
  try {
    const [
      tripsRes, vehiclesRes, driversRes, transportersRes, billsRes,
      maintRes, loansRes, privateLoansRes, repaymentsRes,
      dieselRes, fastagRes, adblueRes, otherExpRes,
      paymentsRes, advancesRes,
      tcRes, bcRes,
    ] = await Promise.all([
      sb.from('trips').select('*').order('id', { ascending: false }),
      sb.from('vehicles').select('*').order('id'),
      sb.from('drivers').select('*').order('id'),
      sb.from('transporters').select('*').order('id'),
      sb.from('bills').select('*').order('id', { ascending: false }),
      sb.from('maintenance').select('*').order('id', { ascending: false }),
      sb.from('loans').select('*').order('id'),
      sb.from('private_loans').select('*').order('id', { ascending: false }),
      sb.from('repayments').select('*').order('id', { ascending: false }),
      sb.from('diesel_expenses').select('*').order('id', { ascending: false }),
      sb.from('fastag_expenses').select('*').order('id', { ascending: false }),
      sb.from('adblue_expenses').select('*').order('id', { ascending: false }),
      sb.from('other_expenses').select('*').order('id', { ascending: false }),
      sb.from('bill_payments').select('*').order('id', { ascending: false }),
      sb.from('driver_advances').select('*').order('id', { ascending: false }),
      sb.from('settings').select('value').eq('key','trip_counter').single(),
      sb.from('settings').select('value').eq('key','bill_counter').single(),
    ]);

    db.trips        = (tripsRes.data        || []).map(dbToTrip);
    db.vehicles     = (vehiclesRes.data     || []).map(dbToVehicle);
    db.drivers      = (driversRes.data      || []).map(dbToDriver);
    db.transporters = (transportersRes.data || []).map(dbToTransporter);
    db.bills        = (billsRes.data        || []).map(dbToBill);
    db.maintenance  = (maintRes.data        || []).map(dbToMaint);
    db.loans        = (loansRes.data        || []).map(dbToLoan);
    db.privateLoans = (privateLoansRes.data || []).map(dbToPrivateLoan);
    db.repayments   = (repaymentsRes.data   || []).map(dbToRepayment);
    db.diesel       = (dieselRes.data       || []).map(dbToDiesel);
    db.fastag       = (fastagRes.data       || []).map(dbToFastag);
    db.adblue       = (adblueRes.data       || []).map(dbToAdblue);
    db.otherExp     = (otherExpRes.data     || []).map(dbToOtherExp);
    db.payments     = (paymentsRes.data     || []).map(r => ({...r, amount: +r.amount}));
    db.advances     = (advancesRes.data     || []).map(dbToAdvance);
    db.tripCounter  = tcRes.data  ? parseInt(tcRes.data.value)  : 1;
    db.billCounter  = bcRes.data  ? parseInt(bcRes.data.value)  : 1;
    // Clamp counters to actual max so they never collide with existing rows
    if (db.trips.length > 0) {
      const maxTrip = Math.max(...db.trips.map(t => { const m = String(t.num).match(/T-(\d+)/); return m ? parseInt(m[1]) : 0; }));
      if (maxTrip >= db.tripCounter) db.tripCounter = maxTrip + 1;
    }
    if (db.bills.length > 0) {
      const maxBill = Math.max(...db.bills.map(b => { const m = String(b.num).match(/INV-(\d+)/); return m ? parseInt(m[1]) : 0; }));
      if (maxBill >= db.billCounter) db.billCounter = maxBill + 1;
    }

    // Update sidebar status
    const status = document.getElementById('sb-status');
    if (status) { status.textContent = '● Live'; status.style.color = 'var(--green)'; }
  } catch (err) {
    console.error('loadDB error', err);
    const status = document.getElementById('sb-status');
    if (status) { status.textContent = '● Error'; status.style.color = 'var(--red)'; }
    alert('Could not load data from Supabase. Check your URL and API key.');
  }
  showLoading(false);
}

/* ── AUTH ─────────────────────────────────────────────────── */
async function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  if (u === 'admin' && p === 'password') {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    await initApp();
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
}
document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
function doLogout() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
}

/* ── INIT ─────────────────────────────────────────────────── */
async function initApp() {
  const btn = document.getElementById('theme-toggle');
  const mode = document.documentElement.getAttribute('data-theme') || 'dark';
  if (btn) btn.textContent = mode === 'dark' ? '☀ Light' : '🌙 Dark';

  if (!checkConfig()) {
    // Still allow the app to render with empty data
  }

  await loadDB();
  populateSelects();
  renderDashboard();
}

function populateSelects() {
  const vehOpts  = db.vehicles.map(v => `<option value="${v.reg}">${v.reg}</option>`).join('');
  const drvOpts  = db.drivers.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
  const trpOpts  = db.transporters.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
  const tripOpts = ['<option value="">— None —</option>',
    ...db.trips.map(t => `<option value="${t.num}">${t.num} — ${t.from}→${t.to}</option>`)].join('');

  ['t-vehicle','ed-vehicle','ef-vehicle','ab-vehicle','eo-vehicle','m-vehicle','l-vehicle']
    .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = vehOpts; });
  const td = document.getElementById('t-driver');      if (td) td.innerHTML = drvOpts;
  const tt = document.getElementById('t-transporter'); if (tt) tt.innerHTML = trpOpts;
  const bt = document.getElementById('b-transporter'); if (bt) bt.innerHTML = '<option value="">— Select Transporter —</option>' + trpOpts;
  const ad = document.getElementById('adv-driver');    if (ad) ad.innerHTML = drvOpts;
  ['ed-trip','ef-trip','eo-trip'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = tripOpts; });

  const vf = document.getElementById('trip-vehicle-filter');
  if (vf) vf.innerHTML = '<option value="">All Vehicles</option>' +
    db.vehicles.map(v => `<option value="${v.reg}">${v.reg}</option>`).join('');
}

/* ── NAVIGATION ───────────────────────────────────────────── */
const PAGE_TITLES  = {dashboard:'Dashboard',trips:'Trips',expenses:'Expenses',billing:'Billing',maintenance:'Maintenance',vehicles:'Vehicles',drivers:'Drivers',transporters:'Transporters',loans:'Loans',payments:'Payments',summary:'Summary',reports:'Reports'};
const TOP_BTN_LBLS = {dashboard:'+ New Trip',trips:'+ New Trip',expenses:'+ Add Expense',billing:'+ New Invoice',maintenance:'+ Add Service',vehicles:'+ Add Vehicle',drivers:'+ Add Driver',transporters:'+ Add Transporter',loans:'+ Add Loan',payments:'+ Record Payment',summary:'Export',reports:'Print / PDF'};

function showPage(page) {
  document.querySelectorAll('[id^="page-"]').forEach(el => el.classList.add('hidden'));
  document.getElementById('page-' + page).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', !!(el.getAttribute('onclick') && el.getAttribute('onclick').includes("'" + page + "'")));
  });
  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
  document.getElementById('topbar-action').textContent = TOP_BTN_LBLS[page] || '+ New';
  // Close mobile sidebar when navigating
  if (window.innerWidth <= 680) {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('mobile-overlay');
    if (sb) sb.classList.remove('mobile-open');
    if (ov) ov.classList.remove('active');
  }
  ({
    dashboard: renderDashboard, trips: renderTrips, billing: renderBilling,
    vehicles: renderVehicles, drivers: renderDrivers, transporters: renderTransporters,
    maintenance: renderMaintenance, loans: renderLoans,
    expenses: () => { renderDiesel(); renderFastag(); renderAdblue(); renderOtherExp(); renderDriverSalaries(); },
    payments: renderPayments, summary: renderPnL, reports: renderMonthlyReport,
  })[page]?.();
}

function handleTopAction() {
  const page = document.getElementById('page-title').textContent.toLowerCase();
  if (page.includes('trip'))        openNewTrip();
  else if (page.includes('expense')) openNewExpenseDiesel();
  else if (page.includes('billing')) openNewBilling();
  else if (page.includes('maint'))   openNewMaintenance();
  else if (page.includes('vehicle')) openNewVehicle();
  else if (page.includes('driver'))  openNewDriver();
  else if (page.includes('trans'))   openNewTransporter();
  else if (page.includes('loan'))    openNewLoan();
  else if (page.includes('payment')) document.getElementById('pay-bill-select')?.focus();
  else if (page.includes('report'))  window.print();
  else openNewTrip();
}

/* ── CSV EXPORT ENGINE (unchanged) ───────────────────────── */
function toggleExportMenu(e) {
  e.stopPropagation();
  document.getElementById('export-menu').classList.toggle('hidden');
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
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
const CSV_DEFS = {
  'trips': { label:'Trips', headers:['Trip#','Date','Vehicle','Driver','Transporter','From','To','Start KM','End KM','Total KM','Freight (Rs)','Mileage (kmpl)','Diesel Price (Rs/L)','Maint/km (Rs)','Fuel Cost (Rs)','Maint Cost (Rs)','Profit (Rs)','Status','Notes'],
    rows: () => db.trips.map(t => { const fuel=t.km>0?Math.round((t.km/t.mileage)*t.dprice):0; const maint=Math.round(t.km*t.maintKm); return [t.num,t.date,t.vehicle,t.driver,t.transporter,t.from,t.to,t.startKm,t.endKm,t.km,t.freight,t.mileage,t.dprice,t.maintKm,fuel,maint,t.freight-fuel-maint,t.status,t.notes]; }) },
  'expenses-diesel': { label:'Diesel_Expenses', headers:['Date','Vehicle','Trip#','Litres','Rate (Rs/L)','Amount (Rs)','Location'], rows: () => db.diesel.map(d=>[d.date,d.vehicle,d.trip,d.litres,d.rate,d.amount,d.location]) },
  'expenses-fastag': { label:'Fastag_Expenses', headers:['Date','Vehicle','Trip#','Toll Plaza','Amount (Rs)'], rows: () => db.fastag.map(f=>[f.date,f.vehicle,f.trip,f.plaza,f.amount]) },
  'expenses-adblue': { label:'Adblue_Records', headers:['Date','Vehicle','Current KM','Prev Fill KM','KM per 20L','Next Fill Est. KM','Qty (L)','Rate (Rs/L)','Amount (Rs)'], rows: () => db.adblue.map(a=>[a.date,a.vehicle,a.curKm,a.prevKm,a.curKm-a.prevKm,a.curKm+(a.curKm-a.prevKm),a.qty,a.rate,a.amount]) },
  'expenses-other': { label:'Other_Expenses', headers:['Date','Vehicle','Trip#','Category','Description','Amount (Rs)'], rows: () => db.otherExp.map(e=>[e.date,e.vehicle,e.trip,e.cat,e.desc,e.amount]) },
  'billing': { label:'Billing_Invoices', headers:['Bill#','Date','Transporter','Trips','Freight (Rs)','Deduction (Rs)','Other Charges (Rs)','Net Payable (Rs)','Status'], rows: () => db.bills.map(b => [b.num,b.date,b.transporter,(b.trips||[]).join('|'),b.freight,b.deduct,b.other,b.freight-b.deduct+b.other,b.status]) },
  'maintenance': { label:'Maintenance', headers:['Date','Vehicle','Service Type','Workshop','Current KM','Next Service KM','Parts Cost (Rs)','Labour Cost (Rs)','Total Cost (Rs)','Notes'], rows: () => db.maintenance.map(m=>[m.date,m.vehicle,m.type,m.workshop,m.curKm,m.nextKm,m.parts,m.labour,m.parts+m.labour,m.notes]) },
  'vehicles': { label:'Vehicles', headers:['Reg. No','Type','Make','Model','Year','Ownership','Chassis No','Engine No','Insurance Expiry','Permit Expiry','FC Expiry','PUC Expiry','Status'], rows: () => db.vehicles.map(v=>[v.reg,v.type,v.make,v.model,v.year,v.own,v.chassis,v.engine,v.ins,v.permit,v.fc,v.puc,v.status]) },
  'drivers': { label:'Drivers', headers:['Name','Mobile','Aadhar','License No','License Expiry','Monthly Salary (Rs)','Address','Emergency Contact','Emergency Mobile','Status'], rows: () => db.drivers.map(d=>[d.name,d.mobile,d.aadhar,d.lic,d.licExp,d.salary,d.address,d.ecName,d.ecMobile,d.status]) },
  'transporters': { label:'Transporters', headers:['Name','Contact Person','Mobile','GSTIN','PAN','Payment Terms (Days)','Address'], rows: () => db.transporters.map(t=>[t.name,t.contact,t.mobile,t.gstin,t.pan,t.terms,t.address]) },
  'loans': { label:'Vehicle_Loans', headers:['Vehicle','Financier','Account No','Principal (Rs)','Interest Rate %','Tenure (Months)','EMI (Rs)','Start Date','EMI Due Day','EMIs Paid','Balance (Rs)','Status'], rows: () => db.loans.map(l=>[l.vehicle,l.fin,l.acc,l.principal,l.rate,l.tenure,l.emi,l.start,l.dueDay,l.paid,calcLoanBal(l),l.status]) },
  'private-loans': { label:'Private_Loans', headers:['Lender','Amount (Rs)','Interest Rate %','Date','Amount Paid (Rs)','Balance (Rs)','Status','Notes'], rows: () => db.privateLoans.map(p=>[p.lender,p.amount,p.rate,p.date,p.paid||0,p.amount-(p.paid||0),p.status,p.notes]) },
  'repayments': { label:'Repayments', headers:['Date','Loan Type','Loan / Lender','Amount Paid (Rs)','Reference No'], rows: () => db.repayments.map(r=>[r.date,r.type,r.loan,r.amount,r.ref]) },
};
function exportCSV(section) {
  document.getElementById('export-menu').classList.add('hidden');
  const ts = new Date().toISOString().slice(0, 10);
  if (section === 'all') { Object.keys(CSV_DEFS).forEach((key, i) => setTimeout(() => _exportSingle(key, ts), i * 300)); return; }
  _exportSingle(section, ts);
}
function _exportSingle(key, ts) {
  const def = CSV_DEFS[key]; if (!def) return;
  const rows = def.rows();
  if (!rows.length) { alert(`No data to export for "${def.label.replace(/_/g,' ')}"`); return; }
  _download(`FleetOps_${def.label}_${ts}.csv`, [_csvRow(def.headers), ...rows.map(_csvRow)].join('\r\n'));
}

/* ── MODAL HELPERS ────────────────────────────────────────── */
function _show(id) { document.getElementById('modal-' + id).classList.remove('hidden'); }
function closeModal(id) {
  document.getElementById('modal-' + id).classList.add('hidden');
  const map = {trip:'edit-trip-index',vehicle:'edit-vehicle-index',driver:'edit-driver-index',
    transporter:'edit-transporter-index',maintenance:'edit-maint-index',loan:'edit-loan-index',
    billing:'edit-bill-index','expense-diesel':'edit-diesel-index',
    'expense-fastag':'edit-fastag-index','expense-adblue':'edit-adblue-index',
    'expense-other':'edit-other-index','driver-advance':'edit-adv-id'};
  if (map[id]) { const el = document.getElementById(map[id]); if (el) el.value = '-1'; }
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => closeModal(m.id.replace('modal-', '')));
});
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id.replace('modal-', '')); });
});

/* Delete confirmation — callback can be async */
function confirmDelete(msg, cb) {
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-ok-btn').onclick = async () => { await cb(); closeModal('confirm'); };
  _show('confirm');
}

const today = () => new Date().toISOString().split('T')[0];

/* ── TRIPS ────────────────────────────────────────────────── */
function openNewTrip() {
  document.getElementById('edit-trip-index').value = '-1';
  document.getElementById('trip-modal-title').textContent = 'New Trip';
  document.getElementById('t-num').value = 'T-' + String(db.tripCounter).padStart(4, '0');
  document.getElementById('t-date').value = today();
  ['t-freight','t-from','t-to','t-start-km','t-end-km','t-notes','t-trip-salary'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('t-mileage').value = '4.2';
  document.getElementById('t-dprice').value = '94.50';
  document.getElementById('t-maint-km').value = '1.8';
  calcTrip(); _show('trip');
}
function onDriverChange() {
  const name = document.getElementById('t-driver').value;
  const drv = db.drivers.find(d => d.name === name);
  const sal = document.getElementById('t-trip-salary');
  if (sal && drv) {
    if (drv.salaryType === 'per-trip') sal.value = drv.perTripRate || 0;
    else if (drv.salaryType === 'per-km') sal.value = 0; // auto-calculated in calcTrip
    else sal.value = drv.salary || 0;
  }
  calcTrip();
}
function editTrip(idx) {
  const t = db.trips[idx];
  document.getElementById('edit-trip-index').value = idx;
  document.getElementById('trip-modal-title').textContent = 'Edit Trip';
  document.getElementById('t-num').value = t.num; document.getElementById('t-date').value = t.date;
  document.getElementById('t-vehicle').value = t.vehicle; document.getElementById('t-driver').value = t.driver;
  document.getElementById('t-transporter').value = t.transporter;
  document.getElementById('t-from').value = t.from; document.getElementById('t-to').value = t.to;
  document.getElementById('t-start-km').value = t.startKm; document.getElementById('t-end-km').value = t.endKm;
  document.getElementById('t-freight').value = t.freight; document.getElementById('t-mileage').value = t.mileage;
  document.getElementById('t-dprice').value = t.dprice; document.getElementById('t-maint-km').value = t.maintKm;
  document.getElementById('t-status').value = t.status; document.getElementById('t-notes').value = t.notes;
  document.getElementById('t-trip-salary').value = t.tripSalary || '';
  calcTrip(); _show('trip');
}
async function saveTrip() {
  const idx = parseInt(document.getElementById('edit-trip-index').value);
  const sk = parseFloat(document.getElementById('t-start-km').value) || 0;
  const ek = parseFloat(document.getElementById('t-end-km').value) || 0;
  const driverName = document.getElementById('t-driver').value;
  const drvObj = db.drivers.find(d => d.name === driverName);
  const trip = {
    id:          idx >= 0 ? db.trips[idx].id : Date.now(),
    num:         document.getElementById('t-num').value,
    date:        document.getElementById('t-date').value,
    vehicle:     document.getElementById('t-vehicle').value,
    driver:      driverName,
    transporter: document.getElementById('t-transporter').value,
    from:        document.getElementById('t-from').value,
    to:          document.getElementById('t-to').value,
    startKm: sk, endKm: ek, km: Math.max(0, ek - sk),
    freight:     parseFloat(document.getElementById('t-freight').value) || 0,
    mileage:     parseFloat(document.getElementById('t-mileage').value) || 4.2,
    dprice:      parseFloat(document.getElementById('t-dprice').value) || 94.5,
    maintKm:     parseFloat(document.getElementById('t-maint-km').value) || 1.8,
    status:      document.getElementById('t-status').value,
    notes:       document.getElementById('t-notes').value,
    tripSalary:  parseFloat(document.getElementById('t-trip-salary').value) || 0,
  };
  const ok = await dbUpsert('trips', tripToDb(trip));
  if (!ok) return;
  if (idx >= 0) db.trips[idx] = trip;
  else { db.trips.unshift(trip); db.tripCounter++; await setCounter('trip_counter', db.tripCounter); }
  populateSelects(); closeModal('trip'); renderTrips();
}
async function deleteTrip(idx) {
  const ok = await dbDelete('trips', db.trips[idx].id);
  if (!ok) return;
  db.trips.splice(idx, 1);
  populateSelects(); renderTrips();
}

/* ── VEHICLES ─────────────────────────────────────────────── */
function openNewVehicle() {
  document.getElementById('edit-vehicle-index').value = -1;
  document.getElementById('vehicle-modal-title').textContent = 'Add Vehicle';
  ['v-reg','v-make','v-model','v-chassis','v-engine','v-ins','v-permit','v-fc','v-puc'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('v-year').value = new Date().getFullYear();
  _show('vehicle');
}
function editVehicle(idx) {
  const v = db.vehicles[idx];
  document.getElementById('edit-vehicle-index').value = idx;
  document.getElementById('vehicle-modal-title').textContent = 'Edit Vehicle';
  document.getElementById('v-reg').value = v.reg; document.getElementById('v-type').value = v.type;
  document.getElementById('v-make').value = v.make; document.getElementById('v-model').value = v.model;
  document.getElementById('v-year').value = v.year; document.getElementById('v-own').value = v.own;
  document.getElementById('v-chassis').value = v.chassis; document.getElementById('v-engine').value = v.engine;
  document.getElementById('v-ins').value = v.ins; document.getElementById('v-permit').value = v.permit;
  document.getElementById('v-fc').value = v.fc; document.getElementById('v-puc').value = v.puc;
  _show('vehicle');
}
async function saveVehicle() {
  const idx = parseInt(document.getElementById('edit-vehicle-index').value);
  const veh = {
    id: idx >= 0 ? db.vehicles[idx].id : Date.now(),
    reg: document.getElementById('v-reg').value, type: document.getElementById('v-type').value,
    make: document.getElementById('v-make').value, model: document.getElementById('v-model').value,
    year: parseInt(document.getElementById('v-year').value) || 0,
    own: document.getElementById('v-own').value,
    chassis: document.getElementById('v-chassis').value, engine: document.getElementById('v-engine').value,
    ins: document.getElementById('v-ins').value, permit: document.getElementById('v-permit').value,
    fc: document.getElementById('v-fc').value, puc: document.getElementById('v-puc').value,
    status: idx >= 0 ? db.vehicles[idx].status : 'Active',
  };
  const ok = await dbUpsert('vehicles', vehicleToDb(veh));
  if (!ok) return;
  if (idx >= 0) db.vehicles[idx] = veh; else db.vehicles.push(veh);
  populateSelects(); closeModal('vehicle'); renderVehicles();
}
async function deleteVehicle(idx) {
  const ok = await dbDelete('vehicles', db.vehicles[idx].id);
  if (!ok) return;
  db.vehicles.splice(idx, 1);
  populateSelects(); renderVehicles();
}

/* ── DRIVERS ──────────────────────────────────────────────── */
function toggleSalaryFields() {
  const type = document.getElementById('dr-salary-type').value;
  document.getElementById('dr-salary-row').classList.toggle('hidden', type !== 'fixed');
  document.getElementById('dr-per-trip-row').classList.toggle('hidden', type !== 'per-trip');
  document.getElementById('dr-per-km-row').classList.toggle('hidden', type !== 'per-km');
}
function openNewDriver() {
  document.getElementById('edit-driver-index').value = -1;
  document.getElementById('driver-modal-title').textContent = 'Add Driver';
  ['dr-name','dr-mobile','dr-lic','dr-lic-exp','dr-aadhar','dr-address','dr-ec-name','dr-ec-mobile'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('dr-salary').value = '';
  document.getElementById('dr-per-trip-rate').value = '';
  document.getElementById('dr-per-km-rate').value = '';
  document.getElementById('dr-salary-type').value = 'fixed';
  toggleSalaryFields();
  _show('driver');
}
function editDriver(idx) {
  const d = db.drivers[idx];
  document.getElementById('edit-driver-index').value = idx;
  document.getElementById('driver-modal-title').textContent = 'Edit Driver';
  document.getElementById('dr-name').value = d.name; document.getElementById('dr-mobile').value = d.mobile;
  document.getElementById('dr-lic').value = d.lic; document.getElementById('dr-lic-exp').value = d.licExp;
  document.getElementById('dr-aadhar').value = d.aadhar;
  document.getElementById('dr-address').value = d.address; document.getElementById('dr-ec-name').value = d.ecName;
  document.getElementById('dr-ec-mobile').value = d.ecMobile;
  document.getElementById('dr-salary-type').value = d.salaryType || 'fixed';
  document.getElementById('dr-salary').value = d.salary || '';
  document.getElementById('dr-per-trip-rate').value = d.perTripRate || '';
  document.getElementById('dr-per-km-rate').value = d.perKmRate || '';
  toggleSalaryFields();
  _show('driver');
}
async function saveDriver() {
  const idx = parseInt(document.getElementById('edit-driver-index').value);
  const salaryType = document.getElementById('dr-salary-type').value;
  const drv = {
    id: idx >= 0 ? db.drivers[idx].id : Date.now(),
    name: document.getElementById('dr-name').value, mobile: document.getElementById('dr-mobile').value,
    lic: document.getElementById('dr-lic').value, licExp: document.getElementById('dr-lic-exp').value,
    aadhar: document.getElementById('dr-aadhar').value,
    salaryType,
    salary: parseFloat(document.getElementById('dr-salary').value) || 0,
    perTripRate: parseFloat(document.getElementById('dr-per-trip-rate').value) || 0,
    perKmRate: parseFloat(document.getElementById('dr-per-km-rate').value) || 0,
    address: document.getElementById('dr-address').value,
    ecName: document.getElementById('dr-ec-name').value, ecMobile: document.getElementById('dr-ec-mobile').value,
    status: idx >= 0 ? db.drivers[idx].status : 'Active',
  };
  const ok = await dbUpsert('drivers', driverToDb(drv));
  if (!ok) return;
  if (idx >= 0) db.drivers[idx] = drv; else db.drivers.push(drv);
  populateSelects(); closeModal('driver'); renderDrivers();
}
async function deleteDriver(idx) {
  const ok = await dbDelete('drivers', db.drivers[idx].id);
  if (!ok) return;
  db.drivers.splice(idx, 1);
  populateSelects(); renderDrivers();
}

/* ── TRANSPORTERS ─────────────────────────────────────────── */
function openNewTransporter() {
  document.getElementById('edit-transporter-index').value = -1;
  document.getElementById('transporter-modal-title').textContent = 'Add Transporter';
  ['tr-name','tr-contact','tr-mobile','tr-gstin','tr-pan','tr-address'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('tr-terms').value = '30';
  _show('transporter');
}
function editTransporter(idx) {
  const t = db.transporters[idx];
  document.getElementById('edit-transporter-index').value = idx;
  document.getElementById('transporter-modal-title').textContent = 'Edit Transporter';
  document.getElementById('tr-name').value = t.name; document.getElementById('tr-contact').value = t.contact;
  document.getElementById('tr-mobile').value = t.mobile; document.getElementById('tr-gstin').value = t.gstin;
  document.getElementById('tr-pan').value = t.pan; document.getElementById('tr-terms').value = t.terms;
  document.getElementById('tr-address').value = t.address;
  _show('transporter');
}
async function saveTransporter() {
  const idx = parseInt(document.getElementById('edit-transporter-index').value);
  const trp = {
    id: idx >= 0 ? db.transporters[idx].id : Date.now(),
    name: document.getElementById('tr-name').value, contact: document.getElementById('tr-contact').value,
    mobile: document.getElementById('tr-mobile').value, gstin: document.getElementById('tr-gstin').value,
    pan: document.getElementById('tr-pan').value,
    terms: parseInt(document.getElementById('tr-terms').value) || 30,
    address: document.getElementById('tr-address').value,
  };
  const ok = await dbUpsert('transporters', transporterToDb(trp));
  if (!ok) return;
  if (idx >= 0) db.transporters[idx] = trp; else db.transporters.push(trp);
  populateSelects(); closeModal('transporter'); renderTransporters();
}
async function deleteTransporter(idx) {
  const ok = await dbDelete('transporters', db.transporters[idx].id);
  if (!ok) return;
  db.transporters.splice(idx, 1);
  populateSelects(); renderTransporters();
}

/* ── BILLING ──────────────────────────────────────────────── */
function _wireBillingTripSelect(currentBillIdx = -1, preselected = []) {
  const bTrips = document.getElementById('b-trips'); if (!bTrips) return;
  const bTransporter = document.getElementById('b-transporter');

  // trips already billed in OTHER invoices (not the one being edited)
  const alreadyBilled = new Set(
    db.bills.filter((_, i) => i !== currentBillIdx).flatMap(b => b.trips || [])
  );

  function refreshOptions() {
    const sel = bTransporter ? bTransporter.value : '';
    const available = db.trips.filter(t =>
      !alreadyBilled.has(t.num) && (!sel || t.transporter === sel)
    );
    bTrips.innerHTML = available.length
      ? available.map(t =>
          `<option value="${t.num}"${preselected.includes(t.num) ? ' selected' : ''}>${t.num} — ${t.from}→${t.to} — ₹${t.freight.toLocaleString()}</option>`
        ).join('')
      : `<option disabled value="">— No pending trips${sel ? ' for this transporter' : ''} —</option>`;
  }

  refreshOptions();

  if (bTransporter) bTransporter.onchange = () => { refreshOptions(); calcBill(); };

  bTrips.onchange = () => {
    const total = [...bTrips.selectedOptions].reduce((s, o) => {
      const trip = db.trips.find(t => t.num === o.value);
      return s + (trip ? trip.freight : 0);
    }, 0);
    const fEl = document.getElementById('b-freight');
    if (fEl) { fEl.value = total; calcBill(); }
  };
}
function openNewBilling() {
  document.getElementById('edit-bill-index').value = -1;
  document.getElementById('billing-modal-title').textContent = 'Create Invoice';
  document.getElementById('b-num').value = 'INV-' + String(db.billCounter).padStart(4, '0');
  document.getElementById('b-date').value = today();
  document.getElementById('b-freight').value = ''; document.getElementById('b-deduct').value = '0';
  document.getElementById('b-other').value = '0';
  const bTransporter = document.getElementById('b-transporter');
  if (bTransporter) bTransporter.value = '';
  _wireBillingTripSelect(-1, []);
  calcBill(); _show('billing');
}
function editBill(idx) {
  const b = db.bills[idx];
  document.getElementById('edit-bill-index').value = idx;
  document.getElementById('billing-modal-title').textContent = 'Edit Invoice';
  document.getElementById('b-num').value = b.num; document.getElementById('b-date').value = b.date;
  document.getElementById('b-transporter').value = b.transporter;
  document.getElementById('b-freight').value = b.freight; document.getElementById('b-deduct').value = b.deduct;
  document.getElementById('b-other').value = b.other;
  _wireBillingTripSelect(idx, b.trips || []);
  calcBill(); _show('billing');
}
async function saveBill() {
  const idx = parseInt(document.getElementById('edit-bill-index').value);
  const selTrips = [...document.getElementById('b-trips').selectedOptions].map(o => o.value);
  const bill = {
    id: idx >= 0 ? db.bills[idx].id : Date.now(),
    num: document.getElementById('b-num').value, date: document.getElementById('b-date').value,
    transporter: document.getElementById('b-transporter').value, trips: selTrips,
    freight: parseFloat(document.getElementById('b-freight').value) || 0,
    deduct: parseFloat(document.getElementById('b-deduct').value) || 0,
    tds: 0,
    other: parseFloat(document.getElementById('b-other').value) || 0,
    status: idx >= 0 ? db.bills[idx].status : 'Pending',
  };
  const ok = await dbUpsert('bills', billToDb(bill));
  if (!ok) return;
  if (idx >= 0) db.bills[idx] = bill; else { db.bills.unshift(bill); db.billCounter++; await setCounter('bill_counter', db.billCounter); }
  closeModal('billing'); renderBilling();
}
async function markBillPaid(idx) {
  db.bills[idx].status = 'Paid';
  await dbUpsert('bills', billToDb(db.bills[idx]));
  renderBilling();
}
async function deleteBill(idx) {
  const ok = await dbDelete('bills', db.bills[idx].id);
  if (!ok) return;
  db.bills.splice(idx, 1);
  renderBilling();
}

/* ── MAINTENANCE ──────────────────────────────────────────── */
function openNewMaintenance() {
  document.getElementById('edit-maint-index').value = -1;
  document.getElementById('maint-modal-title').textContent = 'Add Service Record';
  ['m-workshop','m-cur-km','m-next-km','m-notes'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('m-parts').value = '0'; document.getElementById('m-labour').value = '0';
  document.getElementById('m-date').value = today();
  _show('maintenance');
}
function editMaintenance(idx) {
  const m = db.maintenance[idx];
  document.getElementById('edit-maint-index').value = idx;
  document.getElementById('maint-modal-title').textContent = 'Edit Service Record';
  document.getElementById('m-date').value = m.date; document.getElementById('m-vehicle').value = m.vehicle;
  document.getElementById('m-type').value = m.type; document.getElementById('m-workshop').value = m.workshop;
  document.getElementById('m-cur-km').value = m.curKm; document.getElementById('m-next-km').value = m.nextKm;
  document.getElementById('m-parts').value = m.parts; document.getElementById('m-labour').value = m.labour;
  document.getElementById('m-notes').value = m.notes;
  _show('maintenance');
}
async function saveMaintenance() {
  const idx = parseInt(document.getElementById('edit-maint-index').value);
  const rec = {
    id: idx >= 0 ? db.maintenance[idx].id : Date.now(),
    date: document.getElementById('m-date').value, vehicle: document.getElementById('m-vehicle').value,
    type: document.getElementById('m-type').value, workshop: document.getElementById('m-workshop').value,
    curKm: parseFloat(document.getElementById('m-cur-km').value) || 0,
    nextKm: parseFloat(document.getElementById('m-next-km').value) || 0,
    parts: parseFloat(document.getElementById('m-parts').value) || 0,
    labour: parseFloat(document.getElementById('m-labour').value) || 0,
    notes: document.getElementById('m-notes').value,
  };
  const ok = await dbUpsert('maintenance', maintToDb(rec));
  if (!ok) return;
  if (idx >= 0) db.maintenance[idx] = rec; else db.maintenance.unshift(rec);
  closeModal('maintenance'); renderMaintenance();
}
async function deleteMaintenance(idx) {
  const ok = await dbDelete('maintenance', db.maintenance[idx].id);
  if (!ok) return;
  db.maintenance.splice(idx, 1);
  renderMaintenance();
}

/* ── LOANS ────────────────────────────────────────────────── */
function openNewLoan() {
  document.getElementById('edit-loan-index').value = -1;
  document.getElementById('loan-modal-title').textContent = 'Add Vehicle Loan';
  ['l-fin','l-principal','l-rate','l-tenure','l-emi','l-start','l-acc'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('l-due-day').value = '1'; document.getElementById('l-paid').value = '0';
  _show('loan');
}
function editLoan(idx) {
  const l = db.loans[idx];
  document.getElementById('edit-loan-index').value = idx;
  document.getElementById('loan-modal-title').textContent = 'Edit Vehicle Loan';
  document.getElementById('l-vehicle').value = l.vehicle; document.getElementById('l-fin').value = l.fin;
  document.getElementById('l-principal').value = l.principal; document.getElementById('l-rate').value = l.rate;
  document.getElementById('l-tenure').value = l.tenure; document.getElementById('l-emi').value = l.emi;
  document.getElementById('l-start').value = l.start; document.getElementById('l-due-day').value = l.dueDay;
  document.getElementById('l-paid').value = l.paid; document.getElementById('l-acc').value = l.acc;
  _show('loan');
}
async function saveLoan() {
  const idx = parseInt(document.getElementById('edit-loan-index').value);
  const loan = {
    id: idx >= 0 ? db.loans[idx].id : Date.now(),
    vehicle: document.getElementById('l-vehicle').value, fin: document.getElementById('l-fin').value,
    principal: parseFloat(document.getElementById('l-principal').value) || 0,
    rate: parseFloat(document.getElementById('l-rate').value) || 0,
    tenure: parseInt(document.getElementById('l-tenure').value) || 60,
    emi: parseFloat(document.getElementById('l-emi').value) || 0,
    start: document.getElementById('l-start').value,
    dueDay: parseInt(document.getElementById('l-due-day').value) || 1,
    paid: parseInt(document.getElementById('l-paid').value) || 0,
    acc: document.getElementById('l-acc').value,
    status: idx >= 0 ? db.loans[idx].status : 'Active',
  };
  const ok = await dbUpsert('loans', loanToDb(loan));
  if (!ok) return;
  if (idx >= 0) db.loans[idx] = loan; else db.loans.push(loan);
  closeModal('loan'); renderLoans();
}
async function deleteLoan(idx) {
  const ok = await dbDelete('loans', db.loans[idx].id);
  if (!ok) return;
  db.loans.splice(idx, 1);
  renderLoans();
}

/* ── PRIVATE LOANS ────────────────────────────────────────── */
function openNewPrivateLoan() {
  document.getElementById('edit-pl-index').value = -1;
  document.getElementById('pl-modal-title').textContent = 'Add Private Loan';
  document.getElementById('pl-lender').value = ''; document.getElementById('pl-amount').value = '';
  document.getElementById('pl-rate').value = '0'; document.getElementById('pl-notes').value = '';
  document.getElementById('pl-date').value = today();
  _show('private-loan');
}
function editPrivateLoan(idx) {
  const p = db.privateLoans[idx];
  document.getElementById('edit-pl-index').value = idx;
  document.getElementById('pl-modal-title').textContent = 'Edit Private Loan';
  document.getElementById('pl-lender').value = p.lender; document.getElementById('pl-amount').value = p.amount;
  document.getElementById('pl-rate').value = p.rate; document.getElementById('pl-date').value = p.date;
  document.getElementById('pl-notes').value = p.notes || '';
  _show('private-loan');
}
async function savePrivateLoan() {
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
  const ok = await dbUpsert('private_loans', privateLoanToDb(rec));
  if (!ok) return;
  if (idx >= 0) db.privateLoans[idx] = rec; else db.privateLoans.unshift(rec);
  closeModal('private-loan'); renderLoans();
}
async function deletePrivateLoan(idx) {
  const ok = await dbDelete('private_loans', db.privateLoans[idx].id);
  if (!ok) return;
  db.privateLoans.splice(idx, 1);
  renderLoans();
}

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
function openNewRepayment() {
  document.getElementById('edit-rp-index').value = -1;
  document.getElementById('rp-modal-title').textContent = 'Record Repayment';
  document.getElementById('rp-date').value = today();
  document.getElementById('rp-type').value = 'Vehicle Loan';
  document.getElementById('rp-amount').value = ''; document.getElementById('rp-ref').value = '';
  updateRepaymentLoans(); _show('repayment');
}
async function saveRepayment() {
  const idx = parseInt(document.getElementById('edit-rp-index').value);
  const rec = {
    id:     idx >= 0 ? db.repayments[idx].id : Date.now(),
    date:   document.getElementById('rp-date').value,
    type:   document.getElementById('rp-type').value,
    loan:   document.getElementById('rp-loan').value,
    amount: parseFloat(document.getElementById('rp-amount').value) || 0,
    ref:    document.getElementById('rp-ref').value,
  };
  if (!rec.loan)   { alert('Please select a loan'); return; }
  if (!rec.amount) { alert('Please enter the amount paid'); return; }
  const ok = await dbUpsert('repayments', repaymentToDb(rec));
  if (!ok) return;
  if (idx >= 0) db.repayments[idx] = rec; else db.repayments.unshift(rec);
  closeModal('repayment'); renderLoans();
}
async function deleteRepayment(idx) {
  const ok = await dbDelete('repayments', db.repayments[idx].id);
  if (!ok) return;
  db.repayments.splice(idx, 1);
  renderLoans();
}

/* ── EXPENSES: DIESEL ─────────────────────────────────────── */
function openNewExpenseDiesel() {
  document.getElementById('edit-diesel-index').value = -1;
  ['ed-litres','ed-amount','ed-location'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('ed-date').value = today(); document.getElementById('ed-rate').value = '94.50';
  _show('expense-diesel');
}
function editDiesel(idx) {
  const d = db.diesel[idx];
  document.getElementById('edit-diesel-index').value = idx;
  document.getElementById('ed-date').value = d.date; document.getElementById('ed-vehicle').value = d.vehicle;
  document.getElementById('ed-trip').value = d.trip; document.getElementById('ed-litres').value = d.litres;
  document.getElementById('ed-rate').value = d.rate; document.getElementById('ed-amount').value = d.amount;
  document.getElementById('ed-location').value = d.location;
  _show('expense-diesel');
}
async function saveDiesel() {
  const idx = parseInt(document.getElementById('edit-diesel-index').value);
  const rec = {
    id: idx >= 0 ? db.diesel[idx].id : Date.now(),
    date: document.getElementById('ed-date').value, vehicle: document.getElementById('ed-vehicle').value,
    trip: document.getElementById('ed-trip').value,
    litres: parseFloat(document.getElementById('ed-litres').value) || 0,
    rate:   parseFloat(document.getElementById('ed-rate').value) || 0,
    amount: parseFloat(document.getElementById('ed-amount').value) || 0,
    location: document.getElementById('ed-location').value,
  };
  const ok = await dbUpsert('diesel_expenses', dieselToDb(rec));
  if (!ok) return;
  if (idx >= 0) db.diesel[idx] = rec; else db.diesel.unshift(rec);
  closeModal('expense-diesel'); renderDiesel();
}
async function deleteDiesel(idx) {
  const ok = await dbDelete('diesel_expenses', db.diesel[idx].id);
  if (!ok) return;
  db.diesel.splice(idx, 1); renderDiesel();
}

/* ── EXPENSES: FASTAG ─────────────────────────────────────── */
function openNewExpenseFastag() {
  document.getElementById('edit-fastag-index').value = -1;
  document.getElementById('ef-plaza').value = ''; document.getElementById('ef-amount').value = '';
  document.getElementById('ef-date').value = today();
  _show('expense-fastag');
}
function editFastag(idx) {
  const f = db.fastag[idx];
  document.getElementById('edit-fastag-index').value = idx;
  document.getElementById('ef-date').value = f.date; document.getElementById('ef-vehicle').value = f.vehicle;
  document.getElementById('ef-trip').value = f.trip; document.getElementById('ef-plaza').value = f.plaza;
  document.getElementById('ef-amount').value = f.amount;
  _show('expense-fastag');
}
async function saveFastag() {
  const idx = parseInt(document.getElementById('edit-fastag-index').value);
  const rec = {
    id: idx >= 0 ? db.fastag[idx].id : Date.now(),
    date: document.getElementById('ef-date').value, vehicle: document.getElementById('ef-vehicle').value,
    trip: document.getElementById('ef-trip').value, plaza: document.getElementById('ef-plaza').value,
    amount: parseFloat(document.getElementById('ef-amount').value) || 0,
  };
  const ok = await dbUpsert('fastag_expenses', fastagToDb(rec));
  if (!ok) return;
  if (idx >= 0) db.fastag[idx] = rec; else db.fastag.unshift(rec);
  closeModal('expense-fastag'); renderFastag();
}
async function deleteFastag(idx) {
  const ok = await dbDelete('fastag_expenses', db.fastag[idx].id);
  if (!ok) return;
  db.fastag.splice(idx, 1); renderFastag();
}

/* ── EXPENSES: ADBLUE ─────────────────────────────────────── */
function openNewAdblue() {
  document.getElementById('edit-adblue-index').value = -1;
  document.getElementById('ab-cur-km').value = ''; document.getElementById('ab-prev-km').value = '';
  document.getElementById('ab-date').value = today();
  document.getElementById('ab-qty').value = '20'; document.getElementById('ab-rate').value = '48';
  calcAdblue(); _show('expense-adblue');
}
function editAdblue(idx) {
  const a = db.adblue[idx];
  document.getElementById('edit-adblue-index').value = idx;
  document.getElementById('ab-date').value = a.date; document.getElementById('ab-vehicle').value = a.vehicle;
  document.getElementById('ab-cur-km').value = a.curKm; document.getElementById('ab-prev-km').value = a.prevKm;
  document.getElementById('ab-qty').value = a.qty; document.getElementById('ab-rate').value = a.rate;
  calcAdblue(); _show('expense-adblue');
}
async function saveAdblue() {
  const idx = parseInt(document.getElementById('edit-adblue-index').value);
  const cur = parseFloat(document.getElementById('ab-cur-km').value) || 0;
  const prev = parseFloat(document.getElementById('ab-prev-km').value) || 0;
  const qty = parseFloat(document.getElementById('ab-qty').value) || 20;
  const rate = parseFloat(document.getElementById('ab-rate').value) || 48;
  const rec = {
    id: idx >= 0 ? db.adblue[idx].id : Date.now(),
    date: document.getElementById('ab-date').value, vehicle: document.getElementById('ab-vehicle').value,
    curKm: cur, prevKm: prev, qty, rate, amount: qty * rate,
  };
  const ok = await dbUpsert('adblue_expenses', adblueToDb(rec));
  if (!ok) return;
  if (idx >= 0) db.adblue[idx] = rec; else db.adblue.unshift(rec);
  closeModal('expense-adblue'); renderAdblue();
}
async function deleteAdblue(idx) {
  const ok = await dbDelete('adblue_expenses', db.adblue[idx].id);
  if (!ok) return;
  db.adblue.splice(idx, 1); renderAdblue();
}

/* ── EXPENSES: OTHER ──────────────────────────────────────── */
function openNewOtherExpense() {
  document.getElementById('edit-other-index').value = -1;
  document.getElementById('eo-amount').value = ''; document.getElementById('eo-desc').value = '';
  document.getElementById('eo-date').value = today();
  _show('expense-other');
}
function editOtherExp(idx) {
  const e = db.otherExp[idx];
  document.getElementById('edit-other-index').value = idx;
  document.getElementById('eo-date').value = e.date; document.getElementById('eo-vehicle').value = e.vehicle;
  document.getElementById('eo-trip').value = e.trip; document.getElementById('eo-cat').value = e.cat;
  document.getElementById('eo-desc').value = e.desc; document.getElementById('eo-amount').value = e.amount;
  _show('expense-other');
}
async function saveOtherExpense() {
  const idx = parseInt(document.getElementById('edit-other-index').value);
  const rec = {
    id: idx >= 0 ? db.otherExp[idx].id : Date.now(),
    date: document.getElementById('eo-date').value, vehicle: document.getElementById('eo-vehicle').value,
    trip: document.getElementById('eo-trip').value, cat: document.getElementById('eo-cat').value,
    desc: document.getElementById('eo-desc').value,
    amount: parseFloat(document.getElementById('eo-amount').value) || 0,
  };
  const ok = await dbUpsert('other_expenses', otherExpToDb(rec));
  if (!ok) return;
  if (idx >= 0) db.otherExp[idx] = rec; else db.otherExp.unshift(rec);
  closeModal('expense-other'); renderOtherExp();
}
async function deleteOtherExp(idx) {
  const ok = await dbDelete('other_expenses', db.otherExp[idx].id);
  if (!ok) return;
  db.otherExp.splice(idx, 1); renderOtherExp();
}

/* ── CALCULATIONS ─────────────────────────────────────────── */
function calcTrip() {
  const sk=parseFloat(document.getElementById('t-start-km').value)||0;
  const ek=parseFloat(document.getElementById('t-end-km').value)||0;
  const ml=parseFloat(document.getElementById('t-mileage').value)||4.2;
  const dp=parseFloat(document.getElementById('t-dprice').value)||94.5;
  const mk=parseFloat(document.getElementById('t-maint-km').value)||1.8;
  const fr=parseFloat(document.getElementById('t-freight').value)||0;
  const km=Math.max(0,ek-sk);
  const fuel=km>0?(km/ml)*dp:0;
  const maint=km*mk;
  // Auto-calculate per-km driver salary
  const drvName=document.getElementById('t-driver')?.value;
  const drvObj=drvName?db.drivers.find(d=>d.name===drvName):null;
  if(drvObj&&drvObj.salaryType==='per-km'&&km>0){
    const salEl=document.getElementById('t-trip-salary');
    if(salEl) salEl.value=Math.round(km*(drvObj.perKmRate||0));
  }
  const drvSal=parseFloat(document.getElementById('t-trip-salary')?.value)||0;
  const profit=fr-fuel-maint-drvSal;
  document.getElementById('c-km').textContent=km.toLocaleString()+' km';
  document.getElementById('c-fuel').textContent='₹'+Math.round(fuel).toLocaleString();
  document.getElementById('c-maint').textContent='₹'+Math.round(maint).toLocaleString();
  document.getElementById('c-salary').textContent='₹'+Math.round(drvSal).toLocaleString();
  document.getElementById('c-cost').textContent='₹'+Math.round(fuel+maint+drvSal).toLocaleString();
  const pe=document.getElementById('c-profit');
  pe.textContent='₹'+Math.round(profit).toLocaleString();
  pe.style.color=profit>=0?'var(--green)':'var(--red)';
}
function calcBill() {
  const fr=parseFloat(document.getElementById('b-freight').value)||0;
  const ded=parseFloat(document.getElementById('b-deduct').value)||0;
  const other=parseFloat(document.getElementById('b-other').value)||0;
  document.getElementById('b-c-gross').textContent='₹'+Math.round(fr).toLocaleString();
  document.getElementById('b-c-ded').textContent='- ₹'+Math.round(ded).toLocaleString();
  document.getElementById('b-c-other').textContent='+ ₹'+Math.round(other).toLocaleString();
  document.getElementById('b-c-net').textContent='₹'+Math.round(fr-ded+other).toLocaleString();
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

/* ── HELPERS ──────────────────────────────────────────────── */
function expiryBadge(d) {
  if (!d) return '<span class="text-muted">—</span>';
  const now=new Date(); now.setHours(0,0,0,0);
  const exp=new Date(d);
  const days=Math.round((exp-now)/86400000);
  const fmt=exp.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  if (days<0)  return `<span class="expiry-expired">${fmt} ⚠</span>`;
  if (days<30) return `<span class="expiry-warn">${fmt} ⚠</span>`;
  return `<span class="expiry-ok">${fmt}</span>`;
}
function statusBadge(s) {
  const m={Running:'badge-green',Active:'badge-green',Paid:'badge-green',Loading:'badge-amber',
    Pending:'badge-amber','On Leave':'badge-amber',Service:'badge-amber',Overdue:'badge-red',
    Cancelled:'badge-red',Completed:'badge-blue',Inactive:'badge-blue'};
  return `<span class="badge ${m[s]||'badge-blue'}">${(s||'').toUpperCase()}</span>`;
}

/* Proper reducing-balance loan outstanding calculation */
function calcLoanBal(l) {
  if (!l.rate || l.rate === 0) {
    return Math.max(0, Math.round(l.principal - (l.principal / (l.tenure || 1)) * l.paid));
  }
  const r = l.rate / 12 / 100;
  const k = l.paid;
  const bal = l.principal * Math.pow(1 + r, k) - l.emi * (Math.pow(1 + r, k) - 1) / r;
  return Math.max(0, Math.round(bal));
}

/* Month-filter helpers for Summary & Reports pages */
function getSumMonth() { const el = document.getElementById('sum-month'); return el ? el.value : ''; }
function getRepMonth() { const el = document.getElementById('rep-month'); return el ? el.value : ''; }

/* Mobile sidebar toggle */
function toggleSidebar() {
  const app = document.querySelector('.app');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');
  if (window.innerWidth <= 680) {
    const open = sidebar.classList.toggle('mobile-open');
    if (overlay) overlay.classList.toggle('active', open);
  } else {
    app.classList.toggle('sidebar-collapsed');
  }
}

/* ── RENDER DASHBOARD ─────────────────────────────────────── */
function renderDashboard() {
  const active=db.trips.filter(t=>t.status==='Running'||t.status==='Loading').length;
  const revenue=db.trips.reduce((s,t)=>s+t.freight,0);
  const pendingBills=db.bills.filter(b=>b.status==='Pending');
  const pendingAmt=pendingBills.reduce((s,b)=>s+(b.freight-b.deduct+b.other),0);
  const el=id=>document.getElementById(id);
  if(el('d-active-trips')) el('d-active-trips').textContent=active;
  if(el('d-revenue'))      el('d-revenue').textContent='₹'+(revenue/100000).toFixed(1)+'L';
  if(el('d-pending'))      el('d-pending').textContent='₹'+(pendingAmt/100000).toFixed(1)+'L';
  if(el('d-pending-sub'))  el('d-pending-sub').textContent=pendingBills.length+' invoices';
  const activeV=db.vehicles.filter(v=>v.status==='Active').length;
  if(el('d-util')) el('d-util').textContent=db.vehicles.length>0?Math.round((activeV/db.vehicles.length)*100)+'%':'—';
  if(el('d-util-sub')) el('d-util-sub').textContent=`${activeV} of ${db.vehicles.length} vehicles`;
  if(el('qs-vehicles')) el('qs-vehicles').textContent=db.vehicles.length;
  if(el('qs-drivers'))  el('qs-drivers').textContent=db.drivers.filter(d=>d.status==='Active').length;
  if(el('qs-trips'))    el('qs-trips').textContent=db.trips.length;
  if(el('qs-diesel'))   el('qs-diesel').textContent='₹'+db.diesel.reduce((s,d)=>s+d.amount,0).toLocaleString();
  if(el('qs-fastag'))   el('qs-fastag').textContent='₹'+db.fastag.reduce((s,f)=>s+f.amount,0).toLocaleString();
  if(el('qs-maint'))    el('qs-maint').textContent='₹'+db.maintenance.reduce((s,m)=>s+m.parts+m.labour,0).toLocaleString();
  const dash=el('dash-trips-body');
  if(dash) dash.innerHTML=db.trips.slice(0,5).map(t=>
    `<tr><td><span class="mono text-accent">${t.num}</span></td><td>${t.vehicle}</td>
     <td>${(t.from||'').slice(0,3).toUpperCase()}→${(t.to||'').slice(0,3).toUpperCase()}</td>
     <td>${statusBadge(t.status)}</td></tr>`
  ).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:12px">No trips yet</td></tr>';
}

/* ── RENDER TRIPS ─────────────────────────────────────────── */
function renderTrips() {
  const sf=document.getElementById('trip-status-filter')?.value||'';
  const vf=document.getElementById('trip-vehicle-filter')?.value||'';
  const qf=(document.getElementById('trip-search')?.value||'').toLowerCase();
  const filtered=db.trips.filter(t=>{
    if(sf&&t.status!==sf) return false;
    if(vf&&t.vehicle!==vf) return false;
    if(qf&&![t.num,t.from,t.to,t.vehicle].some(x=>(x||'').toLowerCase().includes(qf))) return false;
    return true;
  });
  const cc=document.getElementById('trip-count'); if(cc) cc.textContent=filtered.length+' trip(s)';
  const tbody=document.getElementById('trips-table-body'); if(!tbody) return;
  tbody.innerHTML=filtered.map(t=>{
    const i=db.trips.indexOf(t);
    const fuel=t.km>0?Math.round((t.km/t.mileage)*t.dprice):0;
    const maint=Math.round(t.km*t.maintKm);
    const profit=t.freight-fuel-maint;
    return `<tr>
      <td><span class="mono text-accent">${t.num}</span></td>
      <td>${t.date}</td><td>${t.vehicle}</td><td>${t.driver}</td>
      <td>${t.from}</td><td>${t.to}</td>
      <td class="mono">${t.km.toLocaleString()}</td>
      <td>₹${t.freight.toLocaleString()}</td>
      <td class="text-red">₹${fuel.toLocaleString()}</td>
      <td class="text-amber">₹${maint.toLocaleString()}</td>
      <td class="${profit>=0?'text-green':'text-red'}">₹${profit.toLocaleString()}</td>
      <td>${statusBadge(t.status)}</td>
      <td><div class="action-row">
        <div class="icon-btn" onclick="editTrip(${i})" title="Edit">✎</div>
        <div class="icon-btn" onclick="confirmDelete('Delete trip ${t.num}?',()=>deleteTrip(${i}))" title="Delete">✕</div>
      </div></td></tr>`;
  }).join('')||'<tr><td colspan="13" style="text-align:center;padding:20px;color:var(--text3)">No trips found</td></tr>';
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
function renderAdblue() {
  const tbody=document.getElementById('adblue-table-body'); if(!tbody) return;
  tbody.innerHTML=db.adblue.map((a,i)=>{
    const used=a.curKm-a.prevKm;
    return `<tr>
      <td>${a.date}</td><td>${a.vehicle}</td>
      <td class="mono">${a.curKm.toLocaleString()}</td>
      <td class="mono">${a.prevKm.toLocaleString()}</td>
      <td class="mono text-accent">${used>0?used.toLocaleString()+' km':'—'}</td>
      <td class="mono">${used>0?(a.curKm+used).toLocaleString()+' km':'—'}</td>
      <td>₹${(a.amount||0).toLocaleString()}</td>
      <td><div class="action-row">
        <div class="icon-btn" onclick="editAdblue(${i})" title="Edit">✎</div>
        <div class="icon-btn" onclick="confirmDelete('Delete Adblue record?',()=>deleteAdblue(${i}))">✕</div>
      </div></td></tr>`;
  }).join('')||'<tr><td colspan="8" style="text-align:center;padding:14px;color:var(--text3)">No records</td></tr>';
  const avgs=db.adblue.map(a=>a.curKm-a.prevKm).filter(v=>v>0);
  const avg=avgs.length?Math.round(avgs.reduce((s,v)=>s+v,0)/avgs.length):0;
  const ea=document.getElementById('ab-avg'); if(ea) ea.textContent=avg?avg.toLocaleString()+' km':'—';
  const et=document.getElementById('ab-total'); if(et) et.textContent='₹'+db.adblue.reduce((s,a)=>s+(a.amount||0),0).toLocaleString();
}
function renderOtherExp() {
  const tbody=document.getElementById('other-table-body'); if(!tbody) return;
  tbody.innerHTML=db.otherExp.map((e,i)=>
    `<tr><td>${e.date}</td><td>${e.vehicle}</td><td>${e.trip||'—'}</td>
     <td><span class="chip">${e.cat}</span></td><td>${e.desc}</td><td>₹${(e.amount||0).toLocaleString()}</td>
     <td><div class="action-row">
       <div class="icon-btn" onclick="editOtherExp(${i})" title="Edit">✎</div>
       <div class="icon-btn" onclick="confirmDelete('Delete expense?',()=>deleteOtherExp(${i}))">✕</div>
     </div></td></tr>`
  ).join('')||'<tr><td colspan="7" style="text-align:center;padding:14px;color:var(--text3)">No records</td></tr>';
}

/* ── PAYMENTS PAGE ────────────────────────────────────────── */

function _billNet(b) {
  return b.freight - b.deduct + b.other;
}

function _billPaidAmt(b) {
  return db.payments.filter(p => p.bill_id == b.id).reduce((s, p) => s + p.amount, 0);
}

function populatePayBillSelect() {
  const sel = document.getElementById('pay-bill-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select Invoice —</option>' +
    db.bills.map(b => {
      const net = _billNet(b);
      const paid = _billPaidAmt(b);
      const bal = net - paid;
      return `<option value="${b.id}">[${b.num}] ${b.transporter} — ₹${bal.toLocaleString()} due</option>`;
    }).join('');
}

function onPayBillSelect() {
  const billId = document.getElementById('pay-bill-select').value;
  if (!billId) return;
  const b = db.bills.find(b => b.id == billId);
  if (!b) return;
  const bal = _billNet(b) - _billPaidAmt(b);
  document.getElementById('pay-amount').value = bal > 0 ? bal : '';
}

async function savePayment() {
  const billId = document.getElementById('pay-bill-select').value;
  const amount = parseFloat(document.getElementById('pay-amount').value) || 0;
  const date   = document.getElementById('pay-date').value;
  const mode   = document.getElementById('pay-mode').value;
  const ref    = document.getElementById('pay-ref').value.trim();
  const notes  = document.getElementById('pay-notes').value.trim();

  if (!billId) { alert('Please select an invoice.'); return; }
  if (!amount || amount <= 0) { alert('Please enter a valid amount.'); return; }
  if (!date) { alert('Please enter a date.'); return; }

  const b = db.bills.find(b => b.id == billId);
  const rec = {
    id: Date.now(),
    bill_id: parseInt(billId),
    bill_num: b ? b.num : '',
    transporter: b ? b.transporter : '',
    amount, date, mode, ref, notes,
  };

  const { error } = await sb.from('bill_payments').insert({
    id: rec.id, bill_id: rec.bill_id, bill_num: rec.bill_num,
    transporter: rec.transporter, amount: rec.amount,
    date: rec.date, mode: rec.mode, ref: rec.ref, notes: rec.notes,
  });

  if (error) {
    // Graceful fallback — store locally if Supabase table doesn't exist yet
    console.warn('bill_payments table not found — storing locally only', error);
  }

  db.payments.unshift(rec);

  // Auto-update bill status
  if (b) {
    const totalPaid = _billPaidAmt(b);
    const net = _billNet(b);
    if (totalPaid >= net) {
      b.status = 'Paid';
      await dbUpsert('bills', billToDb(b));
    } else if (totalPaid > 0) {
      b.status = 'Partial';
      await dbUpsert('bills', billToDb(b));
    }
  }

  // Reset form
  ['pay-amount','pay-ref','pay-notes'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('pay-bill-select').value = '';

  renderPayments();
  renderBilling();
}

async function deletePayment(idx) {
  const p = db.payments[idx];
  const { error } = await sb.from('bill_payments').delete().eq('id', p.id);
  if (!error) {
    db.payments.splice(idx, 1);
    // Recompute bill status
    const b = db.bills.find(b => b.id == p.bill_id);
    if (b) {
      const totalPaid = _billPaidAmt(b);
      const net = _billNet(b);
      b.status = totalPaid >= net ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Pending';
      await dbUpsert('bills', billToDb(b));
    }
    renderPayments(); renderBilling();
  }
}

function renderPayments() {
  // Populate invoice dropdown
  populatePayBillSelect();

  // Populate transporter filter
  const tFilter = document.getElementById('pay-filter-transporter');
  if (tFilter) {
    const cur = tFilter.value;
    const transporters = [...new Set(db.bills.map(b => b.transporter))].sort();
    tFilter.innerHTML = '<option value="">All Transporters</option>' +
      transporters.map(t => `<option value="${t}"${cur===t?' selected':''}>${t}</option>`).join('');
  }

  // Stats
  const totalInv   = db.bills.reduce((s, b) => s + _billNet(b), 0);
  const totalRecv  = db.payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = totalInv - totalRecv;
  const el = id => document.getElementById(id);
  if (el('pay-total-inv'))  el('pay-total-inv').textContent  = '₹' + (totalInv/100000).toFixed(1) + 'L';
  if (el('pay-total-recv')) el('pay-total-recv').textContent = '₹' + (totalRecv/100000).toFixed(1) + 'L';
  if (el('pay-outstanding')) el('pay-outstanding').textContent = '₹' + (outstanding/100000).toFixed(1) + 'L';
  if (el('pay-tx-count')) el('pay-tx-count').textContent = db.payments.length;

  // Filters
  const searchQ    = (document.getElementById('pay-search')?.value || '').toLowerCase();
  const filterT    = document.getElementById('pay-filter-transporter')?.value || '';
  const filterS    = document.getElementById('pay-filter-status')?.value || '';

  // Build combined timeline from bills + payments
  // For each bill build its payment entries; also show pending bills with no payments
  const timelineItems = [];

  // Group payments by bill
  const billPayMap = {};
  db.payments.forEach((p, idx) => {
    if (!billPayMap[p.bill_id]) billPayMap[p.bill_id] = [];
    billPayMap[p.bill_id].push({...p, _idx: idx});
  });

  db.bills.forEach(b => {
    const net = _billNet(b);
    const paidAmt = _billPaidAmt(b);
    const bal = net - paidAmt;

    if (filterT && b.transporter !== filterT) return;
    if (filterS && b.status !== filterS) return;
    if (searchQ && !b.num.toLowerCase().includes(searchQ) && !b.transporter.toLowerCase().includes(searchQ)) return;

    timelineItems.push({ type: 'bill', bill: b, net, paidAmt, bal, payments: billPayMap[b.id] || [] });
  });

  // Sort by bill date descending
  timelineItems.sort((a, b) => (b.bill.date || '').localeCompare(a.bill.date || ''));

  if (el('pay-tx-count-label')) el('pay-tx-count-label').textContent = timelineItems.length ? `(${timelineItems.length})` : '';

  const timeline = document.getElementById('pay-timeline');
  if (!timeline) return;

  if (!timelineItems.length) {
    timeline.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);font-size:13px">No transactions match the filter.</div>`;
    return;
  }

  timeline.innerHTML = timelineItems.map(item => {
    const b = item.bill;
    const pct = item.net > 0 ? Math.min(100, Math.round((item.paidAmt / item.net) * 100)) : 0;
    const statusColor = b.status === 'Paid' ? 'var(--green)' : b.status === 'Partial' ? 'var(--amber)' : 'var(--red)';

    const payRows = item.payments.length
      ? item.payments.map((p, i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:7px 12px;background:var(--bg2);border-radius:6px;margin-top:6px">
            <div style="width:3px;height:32px;background:var(--green);border-radius:2px;flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:500;color:var(--green)">₹${p.amount.toLocaleString()} received</div>
              <div style="font-size:11px;color:var(--text3);margin-top:1px">${p.date} · ${p.mode}${p.ref ? ' · ' + p.ref : ''}${p.notes ? ' · ' + p.notes : ''}</div>
            </div>
            <div class="icon-btn" onclick="confirmDelete('Delete this payment entry?',()=>deletePayment(${p._idx}))" title="Delete payment" style="font-size:11px">✕</div>
          </div>`).join('')
      : `<div style="font-size:11px;color:var(--text3);padding:6px 0 2px">No payments recorded yet.</div>`;

    return `
      <div style="border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px;background:var(--bg)">
        <!-- Bill header -->
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span class="mono text-accent" style="font-size:13px;font-weight:600">${b.num}</span>
          <span style="font-size:12px;color:var(--text2)">${b.transporter}</span>
          <span style="font-size:11px;color:var(--text3)">${b.date}</span>
          <span style="margin-left:auto;font-size:11px;padding:2px 8px;border-radius:10px;background:${statusColor}22;color:${statusColor};font-weight:600">${b.status}</span>
        </div>
        <!-- Progress bar -->
        <div style="margin:10px 0 4px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:4px">
            <span>₹${item.paidAmt.toLocaleString()} received of ₹${item.net.toLocaleString()}</span>
            <span style="color:${statusColor}">${pct}%${item.bal > 0 ? ' · ₹' + item.bal.toLocaleString() + ' due' : ''}</span>
          </div>
          <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${statusColor};border-radius:3px;transition:width .3s"></div>
          </div>
        </div>
        <!-- Payment entries -->
        ${payRows}
      </div>`;
  }).join('');

  // By-transporter panel
  const byT = document.getElementById('pay-by-transporter');
  if (byT) {
    const tMap = {};
    db.bills.forEach(b => {
      if (!tMap[b.transporter]) tMap[b.transporter] = { inv:0, recv:0 };
      tMap[b.transporter].inv += _billNet(b);
      tMap[b.transporter].recv += _billPaidAmt(b);
    });
    byT.innerHTML = Object.entries(tMap).sort((a,b) => b[1].inv - a[1].inv).map(([name, v]) => {
      const bal = v.inv - v.recv;
      return `<div class="pl-row" style="margin-bottom:10px">
        <span style="font-size:12px;color:var(--text2)">${name}</span>
        <div style="text-align:right">
          <div style="font-size:12px;font-weight:600;color:${bal > 0 ? 'var(--red)' : 'var(--green)'}">₹${Math.abs(bal).toLocaleString()}</div>
          <div style="font-size:10px;color:var(--text3)">${bal > 0 ? 'due' : 'settled'}</div>
        </div>
      </div>`;
    }).join('') || '<div style="color:var(--text3);font-size:12px">No billing data.</div>';
  }

  // Set default date for payment form
  const payDate = document.getElementById('pay-date');
  if (payDate && !payDate.value) payDate.value = today();
}

/* ── RENDER BILLING ───────────────────────────────────────── */
function renderBilling() {
  const tbody=document.getElementById('billing-table-body'); if(!tbody) return;
  tbody.innerHTML=db.bills.map((b,i)=>{
    const net=b.freight-b.deduct+b.other;
    return `<tr>
      <td><span class="mono text-accent">${b.num}</span></td>
      <td>${b.date}</td><td>${b.transporter}</td>
      <td style="font-size:11px">${(b.trips||[]).join(', ')||'—'}</td>
      <td>₹${b.freight.toLocaleString()}</td>
      <td class="text-red">₹${b.deduct.toLocaleString()}</td>
      <td class="text-green">₹${net.toLocaleString()}</td>
      <td>${statusBadge(b.status)}</td>
      <td><div class="action-row">
        <div class="icon-btn" onclick="editBill(${i})" title="Edit">✎</div>
        <div class="icon-btn" onclick="markBillPaid(${i})" title="Mark Paid">✓</div>
        <div class="icon-btn" onclick="confirmDelete('Delete invoice ${b.num}?',()=>deleteBill(${i}))">✕</div>
      </div></td></tr>`;
  }).join('')||'<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text3)">No invoices yet</td></tr>';
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
    const myT=db.trips.filter(t=>t.driver===d.name);
    const completedT=myT.filter(t=>t.status==='Completed');
    const km=myT.reduce((s,t)=>s+t.km,0);
    const earned=completedT.reduce((s,t)=>s+(t.tripSalary||0),0);
    const advances=db.advances.filter(a=>(a.driver||'').trim()===(d.name||'').trim()).reduce((s,a)=>s+a.amount,0);
    const paidOut=completedT.filter(t=>t.driverSalaryPaid).reduce((s,t)=>s+(t.tripSalary||0),0);
    const balance=earned-advances-paidOut;   // net still payable to driver
    let salaryRate='—';
    if(d.salaryType==='per-trip') salaryRate=`₹${(d.perTripRate||0).toLocaleString()}/trip`;
    else if(d.salaryType==='per-km') salaryRate=`₹${d.perKmRate||0}/km`;
    else salaryRate=`₹${(d.salary||0).toLocaleString()}/mo`;
    const balanceDisplay = balance === 0
      ? `<span class="badge badge-green" style="font-size:11px">SETTLED</span>`
      : `₹${Math.abs(balance).toLocaleString()}${balance < 0 ? ' <small style="font-size:10px">(excess)</small>' : ''}`;
    return `<tr>
      <td><b>${d.name}</b></td><td>${d.mobile}</td><td class="mono">${d.lic}</td>
      <td>${expiryBadge(d.licExp)}</td>
      <td>${completedT.length} / ${myT.length}</td>
      <td class="mono">${km.toLocaleString()}</td>
      <td class="mono" style="font-size:11px">${salaryRate}</td>
      <td class="mono">₹${earned.toLocaleString()}</td>
      <td class="mono text-red">₹${advances.toLocaleString()}</td>
      <td class="mono ${balance>0?'text-red':balance<0?'text-amber':'text-green'}">${balanceDisplay}</td>
      <td>${statusBadge(d.status)}</td>
      <td><div class="action-row">
        <button class="btn btn-ghost btn-sm" onclick="openSalaryDetail('${d.name.replace(/'/g,"\\'")}')">₹ Salary</button>
        <div class="icon-btn" onclick="editDriver(${i})" title="Edit">✎</div>
        <div class="icon-btn" onclick="confirmDelete('Delete driver ${d.name}?',()=>deleteDriver(${i}))">✕</div>
      </div></td></tr>`;
  }).join('')||'<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--text3)">No drivers added</td></tr>';
}

/* ── DRIVER SALARY LEDGER ─────────────────────────────────── */
function openSalaryDetail(driverName) {
  document.getElementById('salary-driver-name').textContent = driverName;
  renderSalaryModal(driverName);
  _show('driver-salary');
}

function renderSalaryModal(driverName) {
  const drv = db.drivers.find(d => d.name === driverName);
  if (!drv) return;
  const drvTrips = db.trips.filter(t => t.driver === driverName && t.status === 'Completed');
  const drvAdvances = db.advances.filter(a => a.driver === driverName);
  const totalEarned = drvTrips.reduce((s, t) => s + (t.tripSalary || 0), 0);
  const totalAdvances = drvAdvances.reduce((s, a) => s + a.amount, 0);
  const paidOut = drvTrips.filter(t => t.driverSalaryPaid).reduce((s, t) => s + (t.tripSalary || 0), 0);
  const balance = totalEarned - totalAdvances;
  const netPayable = balance - paidOut;

  let salaryTypeLabel = 'Fixed Monthly';
  let salaryRateText = `₹${(drv.salary||0).toLocaleString()} / month`;
  if (drv.salaryType === 'per-trip') { salaryTypeLabel = 'Per Trip Rate'; salaryRateText = `₹${(drv.perTripRate||0).toLocaleString()} / trip`; }
  else if (drv.salaryType === 'per-km') { salaryTypeLabel = 'Per KM Rate'; salaryRateText = `₹${drv.perKmRate||0} / km`; }

  const summaryEl = document.getElementById('salary-summary-html');
  if (summaryEl) summaryEl.innerHTML = `
    <div class="stat-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:12px">
      <div class="stat-card">
        <div class="stat-label">SALARY TYPE</div>
        <div class="stat-value" style="font-size:16px">${salaryTypeLabel}</div>
        <div class="stat-sub" style="color:var(--text3)">${salaryRateText}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">TOTAL EARNED</div>
        <div class="stat-value text-green" style="font-size:22px">₹${totalEarned.toLocaleString()}</div>
        <div class="stat-sub" style="color:var(--text3)">${drvTrips.length} completed trip(s)</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">TOTAL ADVANCES</div>
        <div class="stat-value text-red" style="font-size:22px">₹${totalAdvances.toLocaleString()}</div>
        <div class="stat-sub" style="color:var(--text3)">${drvAdvances.length} advance record(s)</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">ALREADY PAID OUT</div>
        <div class="stat-value" style="font-size:22px">₹${paidOut.toLocaleString()}</div>
        <div class="stat-sub" style="color:var(--text3)">Marked as paid</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">NET STILL PAYABLE</div>
        <div class="stat-value ${netPayable > 0 ? 'text-red' : 'text-green'}" style="font-size:22px">₹${netPayable.toLocaleString()}</div>
        <div class="stat-sub" style="color:var(--text3)">To pay driver</div>
      </div>
    </div>
    <div style="background:var(--bg2);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--text2);margin-bottom:4px">
      <b>How balance works:</b> Earned (₹${totalEarned.toLocaleString()}) – All Advances (₹${totalAdvances.toLocaleString()}) = Balance (₹${balance.toLocaleString()}) | Paid Out so far: ₹${paidOut.toLocaleString()} | <b>Still to pay: ₹${netPayable.toLocaleString()}</b>
    </div>`;

  const tbody = document.getElementById('salary-trips-body');
  if (tbody) tbody.innerHTML = drvTrips.map(t => {
    const tripAdv = drvAdvances.filter(a => a.trip === t.num).reduce((s, a) => s + a.amount, 0);
    const netDue = (t.tripSalary || 0) - tripAdv;
    const tripIdx = db.trips.indexOf(t);
    const driverNameEsc = driverName.replace(/'/g, "\\'");
    return `<tr>
      <td><span class="mono text-accent">${t.num}</span></td>
      <td>${t.date}</td><td>${t.from}→${t.to}</td>
      <td class="mono">${t.km.toLocaleString()} km</td>
      <td class="mono">₹${(t.tripSalary||0).toLocaleString()}</td>
      <td class="mono text-red">₹${tripAdv.toLocaleString()}</td>
      <td class="mono ${netDue > 0 ? 'text-amber' : ''}">₹${netDue.toLocaleString()}</td>
      <td>${t.driverSalaryPaid ? '<span class="badge badge-green">PAID</span>' : '<span class="badge badge-amber">PENDING</span>'}</td>
      <td><div class="action-row">
        ${t.driverSalaryPaid
          ? `<button class="btn btn-ghost btn-sm" onclick="undoTripSalaryPaid(${tripIdx},'${driverNameEsc}')">↩ Undo</button>`
          : `<button class="btn btn-primary btn-sm" onclick="markTripSalaryPaid(${tripIdx},'${driverNameEsc}')">Mark Paid</button>`}
        <button class="btn btn-ghost btn-sm" onclick="openNewAdvance('${driverNameEsc}','${t.num}')">+ Adv</button>
      </div></td></tr>`;
  }).join('') || '<tr><td colspan="9" style="text-align:center;padding:14px;color:var(--text3)">No completed trips</td></tr>';

  const advBody = document.getElementById('salary-advances-body');
  if (advBody) advBody.innerHTML = drvAdvances.map(a => {
    const driverNameEsc = driverName.replace(/'/g, "\\'");
    return `<tr>
      <td>${a.date}</td>
      <td class="mono text-accent">${a.trip || '—'}</td>
      <td class="text-red mono">₹${a.amount.toLocaleString()}</td>
      <td>${a.note || '—'}</td>
      <td><div class="action-row">
        <div class="icon-btn" onclick="deleteAdvanceFromModal(${a.id},'${driverNameEsc}')">✕</div>
      </div></td></tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;padding:14px;color:var(--text3)">No advances recorded</td></tr>';
}

function openNewAdvance(driverName, tripNum) {
  document.getElementById('edit-adv-id').value = '-1';
  document.getElementById('adv-modal-title').textContent = 'Record Driver Advance';
  document.getElementById('adv-date').value = today();
  document.getElementById('adv-amount').value = '';
  document.getElementById('adv-note').value = '';
  const driverSel = document.getElementById('adv-driver');
  if (driverSel) {
    driverSel.innerHTML = db.drivers.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    if (driverName) driverSel.value = driverName;
  }
  const tripSel = document.getElementById('adv-trip');
  if (tripSel) {
    tripSel.innerHTML = '<option value="">— None —</option>' +
      db.trips.map(t => `<option value="${t.num}">${t.num} — ${t.from}→${t.to}</option>`).join('');
    if (tripNum) tripSel.value = tripNum;
  }
  _show('driver-advance');
}

async function saveAdvance() {
  const adv = {
    id: Date.now(),
    date: document.getElementById('adv-date').value,
    driver: document.getElementById('adv-driver').value,
    trip: document.getElementById('adv-trip').value || '',
    amount: parseFloat(document.getElementById('adv-amount').value) || 0,
    note: document.getElementById('adv-note').value,
  };
  const ok = await dbUpsert('driver_advances', advanceToDb(adv));
  if (!ok) return;
  db.advances.unshift(adv);
  closeModal('driver-advance');
  const salaryModal = document.getElementById('modal-driver-salary');
  if (salaryModal && !salaryModal.classList.contains('hidden'))
    renderSalaryModal(document.getElementById('salary-driver-name').textContent);
  renderDrivers();
}

async function deleteAdvanceFromModal(advId, driverName) {
  const idx = db.advances.findIndex(a => a.id === advId);
  if (idx < 0) return;
  const ok = await dbDelete('driver_advances', advId);
  if (!ok) return;
  db.advances.splice(idx, 1);
  renderSalaryModal(driverName);
  renderDrivers();
}

async function markTripSalaryPaid(tripIdx, driverName) {
  const trip = db.trips[tripIdx]; if (!trip) return;
  trip.driverSalaryPaid = true;
  const ok = await dbUpsert('trips', tripToDb(trip));
  if (!ok) { trip.driverSalaryPaid = false; return; }
  renderSalaryModal(driverName); renderDrivers();
}

async function undoTripSalaryPaid(tripIdx, driverName) {
  const trip = db.trips[tripIdx]; if (!trip) return;
  trip.driverSalaryPaid = false;
  const ok = await dbUpsert('trips', tripToDb(trip));
  if (!ok) { trip.driverSalaryPaid = true; return; }
  renderSalaryModal(driverName); renderDrivers();
}

/* ── RENDER TRANSPORTERS ──────────────────────────────────── */
function renderTransporters() {
  const tbody=document.getElementById('transporters-table-body'); if(!tbody) return;
  tbody.innerHTML=db.transporters.map((t,i)=>{
    const myT=db.trips.filter(tr=>tr.transporter===t.name);
    const billed=myT.reduce((s,tr)=>s+tr.freight,0);
    const recv=db.bills.filter(b=>b.transporter===t.name&&b.status==='Paid').reduce((s,b)=>s+(b.freight-b.deduct+b.other),0);
    const bal=billed-recv;
    return `<tr>
      <td><b style="cursor:pointer;color:var(--accent);text-decoration:underline dotted" onclick="showTransporterDetail('${t.name.replace(/'/g,"\\'")}')">${t.name}</b></td><td>${t.contact}</td><td>${t.mobile}</td>
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
    const bal=calcLoanBal(l);
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
    ).join('')+(db.loans.length
      ?`<div class="pl-row" style="font-weight:500;border-top:1px solid var(--border);margin-top:4px;padding-top:8px"><span>Total EMI</span><span class="mono text-red">₹${total.toLocaleString()}</span></div>`
      :'<div style="color:var(--text3);font-size:12px">No active loans</div>');}
  const pb=document.getElementById('private-loans-body');
  if(pb) pb.innerHTML=db.privateLoans.map((p,i)=>{const bal=p.amount-p.paid;
    return `<tr>
      <td><b>${p.lender}</b></td>
      <td>₹${p.amount.toLocaleString()}</td><td>${p.rate}%</td><td>${p.date||'—'}</td>
      <td>₹${(p.paid||0).toLocaleString()}</td>
      <td class="${bal>0?'text-amber':'text-green'}">₹${bal.toLocaleString()}</td>
      <td>${statusBadge(p.status)}</td>
      <td><div class="action-row">
        <div class="icon-btn" onclick="editPrivateLoan(${i})" title="Edit">✎</div>
        <div class="icon-btn" onclick="confirmDelete('Delete private loan from ${p.lender}?',()=>deletePrivateLoan(${i}))">✕</div>
      </div></td></tr>`;
  }).join('')||'<tr><td colspan="8" style="text-align:center;padding:14px;color:var(--text3)">No private loans</td></tr>';
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
  ).join('')||'<tr><td colspan="6" style="text-align:center;padding:14px;color:var(--text3)">No repayments recorded</td></tr>';
}

/* ── RENDER SUMMARY ───────────────────────────────────────── */
function renderPnL() {
  const mf = getSumMonth();
  const inM = d => !mf || (d && String(d).startsWith(mf));
  const mfLabel = mf ? ` — ${new Date(mf+'-01').toLocaleString('default',{month:'long',year:'numeric'})}` : '';
  const trips = db.trips.filter(t => inM(t.date));
  const rev  = trips.reduce((s,t)=>s+t.freight,0);
  const fuel = db.diesel.filter(d=>inM(d.date)).reduce((s,d)=>s+(d.amount||0),0);
  const toll = db.fastag.filter(f=>inM(f.date)).reduce((s,f)=>s+(f.amount||0),0);
  const adbl = db.adblue.filter(a=>inM(a.date)).reduce((s,a)=>s+(a.amount||0),0);
  const mnt  = db.maintenance.filter(m=>inM(m.date)).reduce((s,m)=>s+m.parts+m.labour,0);
  const sal  = trips.filter(t=>t.status==='Completed').reduce((s,t)=>s+(t.tripSalary||0),0);
  const emi  = db.loans.filter(l=>l.status==='Active').reduce((s,l)=>s+l.emi,0);
  const oth  = db.otherExp.filter(e=>inM(e.date)).reduce((s,e)=>s+(e.amount||0),0);
  const exp  = fuel+toll+adbl+mnt+sal+emi+oth;
  const profit = rev-exp;
  const margin = rev>0?((profit/rev)*100).toFixed(1):0;
  const inc=document.getElementById('pnl-income');
  if(inc) inc.innerHTML=`<div class="pl-row"><span>Freight Revenue${mfLabel}</span><span class="pl-income mono">+ ₹${rev.toLocaleString()}</span></div>
    <div class="pl-row" style="font-weight:500"><span>Total Income</span><span class="pl-income mono">+ ₹${rev.toLocaleString()}</span></div>`;
  const exEl=document.getElementById('pnl-expenses');
  if(exEl) exEl.innerHTML=`
    <div class="pl-row"><span>Diesel</span><span class="pl-expense mono">- ₹${fuel.toLocaleString()}</span></div>
    <div class="pl-row"><span>Fastag / Tolls</span><span class="pl-expense mono">- ₹${toll.toLocaleString()}</span></div>
    <div class="pl-row"><span>Adblue</span><span class="pl-expense mono">- ₹${adbl.toLocaleString()}</span></div>
    <div class="pl-row"><span>Maintenance</span><span class="pl-expense mono">- ₹${mnt.toLocaleString()}</span></div>
    <div class="pl-row"><span>Driver Salaries</span><span class="pl-expense mono">- ₹${sal.toLocaleString()}</span></div>
    <div class="pl-row"><span>EMI ${mf?'(monthly rate)':''}</span><span class="pl-expense mono">- ₹${emi.toLocaleString()}</span></div>
    <div class="pl-row"><span>Other</span><span class="pl-expense mono">- ₹${oth.toLocaleString()}</span></div>
    <div class="pl-row" style="font-weight:500"><span>Total Expenses</span><span class="pl-expense mono">- ₹${exp.toLocaleString()}</span></div>`;
  const res=document.getElementById('pnl-result');
  if(res){const color=profit>=0?'var(--green)':'var(--red)';
    res.innerHTML=`<div style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;letter-spacing:1px;margin-bottom:8px">NET ${profit>=0?'PROFIT':'LOSS'}${mfLabel}</div>
    <div style="font-size:36px;font-weight:500;color:${color};font-family:'IBM Plex Mono',monospace">₹${Math.abs(profit).toLocaleString()}</div>
    <div style="font-size:12px;color:var(--text3);margin-top:4px">Margin: ${margin}%</div>`;}
  renderTripSummary(); renderVehicleSummary(); renderDriverSummary(); renderTransporterSummary();
}
function renderTripSummary() {
  const mf = getSumMonth();
  const trips = db.trips.filter(t => !mf || (t.date && t.date.startsWith(mf)));
  const tbody=document.getElementById('trip-sum-body'); if(!tbody) return;
  tbody.innerHTML=trips.map(t=>{
    const fuel=t.km>0?Math.round((t.km/t.mileage)*t.dprice):0;
    const maint=Math.round(t.km*t.maintKm);
    const toll=db.fastag.filter(f=>f.trip===t.num).reduce((s,f)=>s+(f.amount||0),0);
    const misc=db.otherExp.filter(e=>e.trip===t.num).reduce((s,e)=>s+(e.amount||0),0);
    const drvSal=t.tripSalary||0;
    const profit=t.freight-fuel-maint-toll-misc-drvSal;
    const margin=t.freight>0?Math.round((profit/t.freight)*100):0;
    return `<tr>
      <td><span class="mono text-accent">${t.num}</span></td><td>${t.vehicle}</td><td>${t.from}→${t.to}</td>
      <td class="mono">${t.km.toLocaleString()}</td><td>₹${t.freight.toLocaleString()}</td>
      <td class="text-red">₹${fuel.toLocaleString()}</td><td class="text-red">₹${toll.toLocaleString()}</td>
      <td class="text-red">₹${misc.toLocaleString()}</td>
      <td class="text-red">₹${drvSal.toLocaleString()}</td>
      <td class="${profit>=0?'text-green':'text-red'}">₹${profit.toLocaleString()}</td>
      <td><span class="badge ${margin>=15?'badge-green':margin>=0?'badge-amber':'badge-red'}">${margin}%</span></td></tr>`;
  }).join('')||'<tr><td colspan="10" style="text-align:center;padding:14px;color:var(--text3)">No data'+(mf?' for selected month':'')+'</td></tr>';
}
function renderVehicleSummary() {
  const mf = getSumMonth();
  const tbody=document.getElementById('vehicle-sum-body'); if(!tbody) return;
  tbody.innerHTML=db.vehicles.map(v=>{
    const vT=db.trips.filter(t=>t.vehicle===v.reg && (!mf||(t.date&&t.date.startsWith(mf))));
    const km=vT.reduce((s,t)=>s+t.km,0),rev=vT.reduce((s,t)=>s+t.freight,0);
    const fuel=vT.reduce((s,t)=>s+(t.km>0?(t.km/t.mileage)*t.dprice:0),0);
    const maint=vT.reduce((s,t)=>s+(t.km*t.maintKm),0);
    const profit=rev-fuel-maint,margin=rev>0?Math.round((profit/rev)*100):0;
    return `<tr><td><b>${v.reg}</b></td><td>${vT.length}</td><td class="mono">${km.toLocaleString()}</td>
      <td>₹${Math.round(rev).toLocaleString()}</td><td class="text-red">₹${Math.round(fuel).toLocaleString()}</td>
      <td class="text-amber">₹${Math.round(maint).toLocaleString()}</td>
      <td class="${profit>=0?'text-green':'text-red'}">₹${Math.round(profit).toLocaleString()}</td>
      <td><span class="badge ${margin>=15?'badge-green':margin>=0?'badge-amber':'badge-red'}">${margin}%</span></td></tr>`;
  }).join('');
}
function renderDriverSummary() {
  const mf = getSumMonth();
  const tbody=document.getElementById('driver-sum-body'); if(!tbody) return;
  tbody.innerHTML=db.drivers.map(d=>{
    const dT=db.trips.filter(t=>t.driver===d.name && (!mf||(t.date&&t.date.startsWith(mf))));
    const completedT=dT.filter(t=>t.status==='Completed');
    const km=dT.reduce((s,t)=>s+t.km,0);
    const earned=completedT.reduce((s,t)=>s+(t.tripSalary||0),0);
    const adv=db.advances.filter(a=>(a.driver||'').trim()===(d.name||'').trim()).reduce((s,a)=>s+a.amount,0);
    const paidOut=completedT.filter(t=>t.driverSalaryPaid).reduce((s,t)=>s+(t.tripSalary||0),0);
    const bal=earned-adv-paidOut;
    let rateLabel='₹'+(d.salary||0).toLocaleString()+'/mo';
    if(d.salaryType==='per-trip') rateLabel='₹'+(d.perTripRate||0).toLocaleString()+'/trip';
    else if(d.salaryType==='per-km') rateLabel='₹'+(d.perKmRate||0)+'/km';
    return `<tr><td><b>${d.name}</b></td><td>${dT.length}</td><td class="mono">${km.toLocaleString()}</td>
      <td>${rateLabel}</td><td>₹${earned.toLocaleString()}</td><td>₹${adv.toLocaleString()}</td><td>₹${paidOut.toLocaleString()}</td>
      <td class="${bal>=0?'text-green':'text-red'}">₹${Math.abs(bal).toLocaleString()} ${bal>=0?'cr':'db'}</td></tr>`;
  }).join('');
}
function renderDriverSalaries() {
  const tbody=document.getElementById('driver-sal-body'); if(!tbody) return;
  const rows=db.trips.filter(t=>(t.tripSalary||0)>0);
  tbody.innerHTML=rows.map(t=>`<tr>
    <td>${t.date}</td><td><span class="mono text-accent">${t.num}</span></td>
    <td><b>${t.driver}</b></td><td>${t.vehicle}</td>
    <td>${t.from}→${t.to}</td>
    <td class="text-red mono">₹${(t.tripSalary||0).toLocaleString()}</td>
    <td>${statusBadge(t.status)}</td></tr>`
  ).join('')||'<tr><td colspan="7" style="text-align:center;padding:14px;color:var(--text3)">No driver salary entries</td></tr>';
}
function renderTransporterSummary() {
  const mf = getSumMonth();
  const tbody=document.getElementById('transporter-sum-body'); if(!tbody) return;
  tbody.innerHTML=db.transporters.map(t=>{
    const tT=db.trips.filter(tr=>tr.transporter===t.name && (!mf||(tr.date&&tr.date.startsWith(mf))));
    const tBills=db.bills.filter(b=>b.transporter===t.name && (!mf||(b.date&&b.date.startsWith(mf))));
    const billed=tBills.reduce((s,b)=>s+(b.freight-b.deduct+b.other),0);
    const recv=tBills.reduce((s,b)=>s+_billPaidAmt(b),0);
    const pending=billed-recv;
    return `<tr>
      <td><b style="cursor:pointer;color:var(--accent);text-decoration:underline dotted" onclick="showTransporterDetail('${t.name.replace(/'/g,"\\'")}'">${t.name}</b></td>
      <td>${tT.length}</td>
      <td>₹${Math.round(billed).toLocaleString()}</td>
      <td>₹${Math.round(recv).toLocaleString()}</td>
      <td class="${pending>0?'text-amber':'text-green'}">₹${Math.round(pending).toLocaleString()}</td></tr>`;
  }).join('');
}

function showTransporterDetail(name) {
  document.getElementById('transporter-detail-title').textContent = name + ' — Details';

  const bills = db.bills.filter(b => b.transporter === name);
  const billsTbody = document.getElementById('transporter-detail-bills');
  billsTbody.innerHTML = bills.map(b => {
    const net = b.freight - b.deduct + b.other;
    const paid = _billPaidAmt(b);
    const bal = net - paid;
    const statusCls = b.status==='Paid'?'badge-green':b.status==='Partial'?'badge-blue':'badge-amber';
    return `<tr>
      <td><span class="mono text-accent">${b.num}</span></td>
      <td>${b.date}</td>
      <td style="font-size:11px">${(b.trips||[]).join(', ')||'—'}</td>
      <td>₹${b.freight.toLocaleString()}</td>
      <td class="text-red">₹${b.deduct.toLocaleString()}</td>
      <td class="text-green">₹${b.other.toLocaleString()}</td>
      <td class="mono"><b>₹${Math.round(net).toLocaleString()}</b></td>
      <td class="text-green">₹${Math.round(paid).toLocaleString()}</td>
      <td class="${bal>0?'text-amber':'text-green'}">₹${Math.round(bal).toLocaleString()}</td>
      <td><span class="badge ${statusCls}">${b.status}</span></td>
    </tr>`;
  }).join('') || '<tr><td colspan="10" style="text-align:center;padding:12px;color:var(--text3)">No bills</td></tr>';

  const tripNums = bills.flatMap(b => b.trips || []);
  const trips = db.trips.filter(tr => tr.transporter === name);
  const tripsTbody = document.getElementById('transporter-detail-trips');
  tripsTbody.innerHTML = trips.map(tr => {
    const inBill = tripNums.includes(tr.num);
    return `<tr>
      <td><span class="mono text-accent">${tr.num}</span></td>
      <td>${tr.date}</td>
      <td>${tr.from}→${tr.to}</td>
      <td>${tr.vehicle}</td>
      <td>₹${tr.freight.toLocaleString()}</td>
      <td>${inBill?'<span class="badge badge-green">Billed</span>':'<span class="badge badge-amber">Unbilled</span>'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:12px;color:var(--text3)">No trips</td></tr>';

  _show('transporter-detail');
}
function renderMonthlyReport() {
  const mf = getRepMonth();
  const trips = db.trips.filter(t => !mf || (t.date && t.date.startsWith(mf)));
  const tbody=document.getElementById('monthly-rep-body'); if(!tbody) return;
  tbody.innerHTML=trips.map(t=>{
    const fuel=t.km>0?Math.round((t.km/t.mileage)*t.dprice):0;
    const maint=Math.round(t.km*t.maintKm);
    const profit=t.freight-fuel-maint;
    return `<tr><td><span class="mono text-accent">${t.num}</span></td><td>${t.date}</td>
      <td>${t.vehicle}</td><td>${t.from}→${t.to}</td><td class="mono">${t.km.toLocaleString()}</td>
      <td>₹${t.freight.toLocaleString()}</td><td class="text-red">₹${(fuel+maint).toLocaleString()}</td>
      <td class="${profit>=0?'text-green':'text-red'}">₹${profit.toLocaleString()}</td></tr>`;
  }).join('')||`<tr><td colspan="8" style="text-align:center;padding:14px;color:var(--text3)">No data${mf?' for selected month':''}</td></tr>`;
}

/* ── TAB HELPERS ──────────────────────────────────────────── */
function setExpenseTab(el,tab){
  document.querySelectorAll('#page-expenses .tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');
  ['diesel','fastag','adblue','other','driver-sal'].forEach(t=>{const e=document.getElementById('exp-'+t);if(e)e.classList.toggle('hidden',t!==tab);});
  if(tab==='driver-sal') renderDriverSalaries();
}
function setLoanTab(el,tab){
  document.querySelectorAll('#page-loans .tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');
  ['vehicle-loans','private-loans','repayments'].forEach(t=>{const e=document.getElementById('loan-'+t);if(e)e.classList.toggle('hidden',t!==tab);});
}
function setSumTab(el,tab){
  document.querySelectorAll('#page-summary .tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');
  ['pnl','trip-sum','vehicle-sum','driver-sum','transporter-sum'].forEach(t=>{const e=document.getElementById('sum-'+t);if(e)e.classList.toggle('hidden',t!==tab);});
  if(tab==='pnl') renderPnL();
  else if(tab==='trip-sum') renderTripSummary();
  else if(tab==='vehicle-sum') renderVehicleSummary();
  else if(tab==='driver-sum') renderDriverSummary();
  else if(tab==='transporter-sum') renderTransporterSummary();
}
function setRepTab(el,tab){
  document.querySelectorAll('#page-reports .tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');
  ['monthly','pending','balance','emi-rep'].forEach(t=>{const e=document.getElementById('rep-'+t);if(e)e.classList.toggle('hidden',t!==tab);});
  if(tab==='monthly') renderMonthlyReport();
}

/* ── CLEAR / RESET DATA ───────────────────────────────────── */
async function clearAllData() {
  confirmDelete('Erase ALL data from Supabase and start completely fresh?', async () => {
    showLoading(true, 'Clearing all data…');
    const tables = ['trips','vehicles','drivers','transporters','bills','maintenance',
                    'loans','private_loans','repayments','diesel_expenses',
                    'fastag_expenses','adblue_expenses','other_expenses','bill_payments','driver_advances'];
    await Promise.all(tables.map(t => sb.from(t).delete().neq('id', -1)));
    await sb.from('settings').upsert([{key:'trip_counter',value:'1'},{key:'bill_counter',value:'1'}]);
    db = { trips:[],vehicles:[],drivers:[],transporters:[],bills:[],maintenance:[],
           loans:[],privateLoans:[],repayments:[],diesel:[],fastag:[],adblue:[],otherExp:[],
           payments:[],advances:[],
           tripCounter:1, billCounter:1 };
    showLoading(false);
    populateSelects(); showPage('dashboard');
  });
}

async function resetDemoData() {
  confirmDelete('Reset to demo data in Supabase? This will overwrite current data.', async () => {
    showLoading(true, 'Loading demo data…');
    // Clear all first
    const tables = ['trips','vehicles','drivers','transporters','bills','maintenance',
                    'loans','private_loans','repayments','diesel_expenses',
                    'fastag_expenses','adblue_expenses','other_expenses'];
    await Promise.all(tables.map(t => sb.from(t).delete().neq('id', -1)));

    // Insert demo data
    const demoTrips = [
      {id:1001,num:'T-0001',date:'2026-04-11',origin:'Chennai',destination:'Mumbai',vehicle:'TN01AB1234',driver:'Rajan Kumar',transporter:'Shree Transports',start_km:82000,end_km:84400,km:2400,freight:28000,mileage:4.2,dprice:94.5,maint_km:1.8,status:'Running',notes:''},
      {id:1002,num:'T-0002',date:'2026-04-10',origin:'Chennai',destination:'Delhi',vehicle:'TN02CD5678',driver:'Selvam P.',transporter:'Kumar Logistics',start_km:68000,end_km:70200,km:2200,freight:32000,mileage:4.2,dprice:92,maint_km:1.8,status:'Completed',notes:''},
    ];
    const demoVehicles = [
      {id:2001,reg:'TN01AB1234',type:'40 Ton',make:'Tata',model:'Prima 4028S',year:2022,own:'Own',chassis:'MAT123456789',engine:'E123456',ins:'2026-09-12',permit:'2026-12-31',fc:'2026-09-20',puc:'2026-08-15',status:'Active'},
      {id:2002,reg:'TN02CD5678',type:'32 Ton',make:'Ashok Leyland',model:'3518',year:2021,own:'Own',chassis:'MAT987654321',engine:'E654321',ins:'2026-09-30',permit:'2026-11-30',fc:'2026-07-15',puc:'2026-06-20',status:'Active'},
    ];
    const demoDrivers = [
      {id:3001,name:'Rajan Kumar',mobile:'9876543210',lic:'TN2012345678',lic_exp:'2028-12-31',aadhar:'1234 5678 9012',salary:16000,address:'Chennai',ec_name:'Rajan Wife',ec_mobile:'9876500001',status:'Active'},
      {id:3002,name:'Selvam P.',mobile:'9765432109',lic:'TN2034567890',lic_exp:'2027-08-31',aadhar:'2345 6789 0123',salary:14000,address:'Chennai',ec_name:'Selvam Wife',ec_mobile:'9765500002',status:'Active'},
    ];
    const demoTransporters = [
      {id:4001,name:'Shree Transports',contact:'Ramesh',mobile:'9887766554',gstin:'33AABCS1234K1Z5',pan:'AABCS1234K',terms:30,address:'Chennai'},
      {id:4002,name:'Kumar Logistics',contact:'Suresh Kumar',mobile:'9776655443',gstin:'33AABCK5678L2Z1',pan:'AABCK5678L',terms:30,address:'Coimbatore'},
    ];
    const demoMaint = [{id:5001,date:'2026-04-05',vehicle:'TN01AB1234',type:'Oil Change',workshop:'Tata Service Center',cur_km:84000,next_km:89000,parts:1800,labour:1400,notes:'Engine oil + filter change'}];
    const demoLoans = [{id:6001,vehicle:'TN01AB1234',fin:'HDFC Bank',principal:2800000,rate:9.5,tenure:60,emi:62000,start_date:'2024-10-15',due_day:15,paid:18,acc:'HDFC123456789',status:'Active'}];
    const demoDiesel = [{id:7001,date:'2026-04-10',vehicle:'TN01AB1234',trip:'T-0001',litres:120,rate:94.5,amount:11340,location:'Pune Highway Pump'}];
    const demoAdblue = [{id:8001,date:'2026-04-10',vehicle:'TN01AB1234',cur_km:84200,prev_km:82800,qty:20,rate:48,amount:960}];

    await Promise.all([
      sb.from('trips').insert(demoTrips),
      sb.from('vehicles').insert(demoVehicles),
      sb.from('drivers').insert(demoDrivers),
      sb.from('transporters').insert(demoTransporters),
      sb.from('maintenance').insert(demoMaint),
      sb.from('loans').insert(demoLoans),
      sb.from('diesel_expenses').insert(demoDiesel),
      sb.from('adblue_expenses').insert(demoAdblue),
      sb.from('settings').upsert([{key:'trip_counter',value:'3'},{key:'bill_counter',value:'1'}]),
    ]);

    await loadDB();
    populateSelects(); showPage('dashboard');
  });
}
