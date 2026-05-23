/* ============================================================
   FleetOps TMS — Supabase Integration Patch
   HOW TO USE:
     1. Run fleetops_supabase_schema.sql in Supabase → SQL Editor
     2. Copy your Project URL + anon key from:
        Supabase Dashboard → Settings → API
     3. Add the Supabase JS CDN script to index.html (see below)
     4. Replace the top of app.js with this block
   ============================================================ */

/* ── STEP 1 ─ Add this <script> tag to index.html BEFORE app.js ──

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

─────────────────────────────────────────────────────────────── */

/* ── STEP 2 ─ Replace these two lines in app.js ── */
const SUPABASE_URL = 'https://luwegdltqkftpyrsvdaz.supabase.co'; // ← paste your URL
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1d2VnZGx0cWtmdHB5cnN2ZGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzcwODIsImV4cCI6MjA5MTMxMzA4Mn0.NiEf8ybXS5OSzkgW-TnDW2pXB12j2w4Sysjz4JEKRHE';                // ← paste your anon key

/* ── STEP 3 ─ Paste this block right after the two constants ── */

// Initialise Supabase client (available globally via CDN)
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── loadDB: replace localStorage with Supabase ────────────── */
async function loadDB() {
  try {
    const [
      { data: trips },
      { data: vehicles },
      { data: drivers },
      { data: transporters },
      { data: bills },
      { data: maintenance },
      { data: loans },
      { data: privateLoans },
      { data: repayments },
      { data: diesel },
      { data: fastag },
      { data: adblue },
      { data: otherExp },
      { data: driverAdvances },
      { data: tripCtr },
      { data: billCtr },
    ] = await Promise.all([
      _sb.from('trips').select('*').order('date', { ascending: false }),
      _sb.from('vehicles').select('*').order('reg'),
      _sb.from('drivers').select('*').order('name'),
      _sb.from('transporters').select('*').order('name'),
      _sb.from('bills').select('*').order('date', { ascending: false }),
      _sb.from('maintenance').select('*').order('date', { ascending: false }),
      _sb.from('loans').select('*'),
      _sb.from('private_loans').select('*').order('date', { ascending: false }),
      _sb.from('repayments').select('*').order('date', { ascending: false }),
      _sb.from('diesel').select('*').order('date', { ascending: false }),
      _sb.from('fastag').select('*').order('date', { ascending: false }),
      _sb.from('adblue').select('*').order('date', { ascending: false }),
      _sb.from('other_exp').select('*').order('date', { ascending: false }),
      _sb.from('driver_advances').select('*').order('date', { ascending: false }),
      _sb.from('trip_counter').select('next_num').single(),
      _sb.from('bill_counter').select('next_num').single(),
    ]);

    // Map snake_case DB columns → camelCase used by the app
    return {
      trips:           (trips || []).map(mapTrip),
      vehicles:        vehicles || [],
      drivers:         (drivers || []).map(mapDriver),
      transporters:    transporters || [],
      bills:           (bills || []).map(mapBill),
      maintenance:     (maintenance || []).map(mapMaint),
      loans:           (loans || []).map(mapLoan),
      privateLoans:    (privateLoans || []).map(mapPrivateLoan),
      repayments:      (repayments || []).map(mapRepayment),
      diesel:          diesel || [],
      fastag:          fastag || [],
      adblue:          (adblue || []).map(mapAdblue),
      otherExp:        (otherExp || []).map(mapOtherExp),
      driverAdvances:  (driverAdvances || []).map(mapAdvance),
      tripCounter:     tripCtr?.next_num  || 1,
      billCounter:     billCtr?.next_num  || 1,
    };
  } catch (err) {
    console.error('loadDB error — falling back to localStorage', err);
    // Graceful fallback keeps the app usable if Supabase is down
    const saved = localStorage.getItem('fleetops_db');
    return saved ? JSON.parse(saved) : getEmptyDB();
  }
}

/* ── saveDB: upsert changed records into Supabase ──────────── */
//
// The existing app calls saveDB() after every mutation.
// This replacement upserts the full db object.
// For large fleets consider fine-grained saves per section.
//
async function saveDB() {
  // Keep localStorage as a backup / offline cache
  localStorage.setItem('fleetops_db', JSON.stringify(db));

  try {
    await Promise.all([
      _sb.from('trips').upsert(db.trips.map(unMapTrip),           { onConflict: 'id' }),
      _sb.from('vehicles').upsert(db.vehicles,                    { onConflict: 'id' }),
      _sb.from('drivers').upsert(db.drivers.map(unMapDriver),     { onConflict: 'id' }),
      _sb.from('transporters').upsert(db.transporters,            { onConflict: 'id' }),
      _sb.from('bills').upsert(db.bills.map(unMapBill),           { onConflict: 'id' }),
      _sb.from('maintenance').upsert(db.maintenance.map(unMapMaint), { onConflict: 'id' }),
      _sb.from('loans').upsert(db.loans.map(unMapLoan),           { onConflict: 'id' }),
      _sb.from('private_loans').upsert(db.privateLoans.map(unMapPrivateLoan), { onConflict: 'id' }),
      _sb.from('repayments').upsert(db.repayments.map(unMapRepayment), { onConflict: 'id' }),
      _sb.from('diesel').upsert(db.diesel,                        { onConflict: 'id' }),
      _sb.from('fastag').upsert(db.fastag,                        { onConflict: 'id' }),
      _sb.from('adblue').upsert(db.adblue.map(unMapAdblue),       { onConflict: 'id' }),
      _sb.from('other_exp').upsert(db.otherExp.map(unMapOtherExp),{ onConflict: 'id' }),
      _sb.from('driver_advances').upsert(db.driverAdvances.map(unMapAdvance), { onConflict: 'id' }),
    ]);
  } catch (err) {
    console.error('saveDB error — data saved locally only', err);
  }
}

/* ── Column name mappers (DB snake_case ↔ app camelCase) ────── */

function mapTrip(r) {
  return {
    id: r.id, num: r.num, date: r.date,
    vehicle: r.vehicle, driver: r.driver, transporter: r.transporter,
    from: r.from_location, to: r.to_location,
    startKm: +r.start_km, endKm: +r.end_km, km: +r.km,
    freight: +r.freight, mileage: +r.mileage,
    dprice: +r.dprice, maintKm: +r.maint_km,
    status: r.status, notes: r.notes,
    tripSalary: +r.trip_salary,
    driverSalaryPaid: r.driver_salary_paid,
  };
}
function unMapTrip(t) {
  return {
    id: t.id, num: t.num, date: t.date,
    vehicle: t.vehicle, driver: t.driver, transporter: t.transporter,
    from_location: t.from, to_location: t.to,
    start_km: t.startKm, end_km: t.endKm, km: t.km,
    freight: t.freight, mileage: t.mileage,
    dprice: t.dprice, maint_km: t.maintKm,
    status: t.status, notes: t.notes,
    trip_salary: t.tripSalary || 0,
    driver_salary_paid: t.driverSalaryPaid || false,
  };
}

function mapDriver(r) {
  return {
    id: r.id, name: r.name, mobile: r.mobile,
    lic: r.lic, licExp: r.lic_exp, aadhar: r.aadhar,
    salary: +r.salary, salaryType: r.salary_type,
    perTripRate: +r.per_trip_rate, perKmRate: +r.per_km_rate,
    address: r.address, ecName: r.ec_name, ecMobile: r.ec_mobile,
    status: r.status,
  };
}
function unMapDriver(d) {
  return {
    id: d.id, name: d.name, mobile: d.mobile,
    lic: d.lic, lic_exp: d.licExp, aadhar: d.aadhar,
    salary: d.salary, salary_type: d.salaryType,
    per_trip_rate: d.perTripRate, per_km_rate: d.perKmRate,
    address: d.address, ec_name: d.ecName, ec_mobile: d.ecMobile,
    status: d.status,
  };
}

function mapMaint(r) {
  return {
    id: r.id, date: r.date, vehicle: r.vehicle,
    type: r.type, workshop: r.workshop,
    curKm: +r.cur_km, nextKm: +r.next_km,
    parts: +r.parts, labour: +r.labour, notes: r.notes,
  };
}
function unMapMaint(m) {
  return {
    id: m.id, date: m.date, vehicle: m.vehicle,
    type: m.type, workshop: m.workshop,
    cur_km: m.curKm, next_km: m.nextKm,
    parts: m.parts, labour: m.labour, notes: m.notes,
  };
}

function mapLoan(r) {
  return {
    id: r.id, vehicle: r.vehicle, fin: r.fin,
    principal: +r.principal, rate: +r.rate,
    tenure: r.tenure, emi: +r.emi,
    start: r.start_date, dueDay: r.due_day,
    paid: r.paid, acc: r.acc, status: r.status,
  };
}
function unMapLoan(l) {
  return {
    id: l.id, vehicle: l.vehicle, fin: l.fin,
    principal: l.principal, rate: l.rate,
    tenure: l.tenure, emi: l.emi,
    start_date: l.start, due_day: l.dueDay,
    paid: l.paid, acc: l.acc, status: l.status,
  };
}

function mapPrivateLoan(r) {
  return {
    id: r.id, lender: r.lender, amount: +r.amount,
    rate: +r.rate, date: r.date,
    paid: +r.paid, status: r.status, notes: r.notes,
  };
}
function unMapPrivateLoan(p) {
  return {
    id: p.id, lender: p.lender, amount: p.amount,
    rate: p.rate, date: p.date,
    paid: p.paid, status: p.status, notes: p.notes,
  };
}

function mapRepayment(r) {
  return { id: r.id, date: r.date, type: r.type, loan: r.loan, amount: +r.amount, ref: r.ref };
}
function unMapRepayment(r) {
  return { id: r.id, date: r.date, type: r.type, loan: r.loan, amount: r.amount, ref: r.ref };
}

function mapBill(r) {
  return {
    id: r.id, num: r.num, date: r.date,
    transporter: r.transporter, trips: r.trips || [],
    freight: +r.freight, deduct: +r.deduct,
    tds: +r.tds, other: +r.other, status: r.status,
  };
}
function unMapBill(b) {
  return {
    id: b.id, num: b.num, date: b.date,
    transporter: b.transporter, trips: b.trips || [],
    freight: b.freight, deduct: b.deduct,
    tds: b.tds, other: b.other, status: b.status,
  };
}

function mapAdblue(r) {
  return {
    id: r.id, date: r.date, vehicle: r.vehicle,
    curKm: +r.cur_km, prevKm: +r.prev_km,
    qty: +r.qty, rate: +r.rate, amount: +r.amount,
  };
}
function unMapAdblue(a) {
  return {
    id: a.id, date: a.date, vehicle: a.vehicle,
    cur_km: a.curKm, prev_km: a.prevKm,
    qty: a.qty, rate: a.rate, amount: a.amount,
  };
}

function mapOtherExp(r) {
  return {
    id: r.id, date: r.date, vehicle: r.vehicle,
    trip: r.trip, cat: r.cat, desc: r.description, amount: +r.amount,
  };
}
function unMapOtherExp(e) {
  return {
    id: e.id, date: e.date, vehicle: e.vehicle,
    trip: e.trip, cat: e.cat, description: e.desc, amount: e.amount,
  };
}

function mapAdvance(r) {
  return { id: r.id, date: r.date, driver: r.driver, trip: r.trip, amount: +r.amount, note: r.note };
}
function unMapAdvance(a) {
  return { id: a.id, date: a.date, driver: a.driver, trip: a.trip, amount: a.amount, note: a.note };
}

/* ── STEP 4 ─ Make initApp async and await loadDB ──────────── */
//
// Find the initApp() function in app.js and change its first line:
//
//   BEFORE:  function initApp() { ... }
//   AFTER:   async function initApp() { db = await loadDB(); ... }
//
// Also change the doLogin() call from:
//   initApp();
// to:
//   initApp();   ← no change needed; async initApp returns a Promise
//
// Optionally show a loading spinner while data loads:
//   document.getElementById('content').innerHTML = '<p style="padding:40px;color:var(--text3)">Loading data…</p>';
//

/* ── STEP 5 ─ Delete records on Supabase when app deletes them ─
//
// After any db.TABLE.splice(idx,1) call, add a Supabase delete.
// Example — deleteTrip():
//
//   function deleteTrip(idx) {
//     const id = db.trips[idx].id;
//     db.trips.splice(idx, 1);
//     saveDB();
//     _sb.from('trips').delete().eq('id', id);   // ← add this line
//     populateSelects(); refreshAfterDataChange(renderTrips);
//   }
//
// Apply the same pattern to deleteVehicle, deleteDriver,
// deleteTransporter, deleteMaintenance, deleteLoan,
// deletePrivateLoan, deleteRepayment, deleteDiesel,
// deleteFastag, deleteAdblue, and any other delete functions.
*/
