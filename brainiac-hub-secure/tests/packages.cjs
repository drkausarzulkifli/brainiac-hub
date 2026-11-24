const assert=require('node:assert/strict');
global.malaysiaToday=()=>'2026-11-24';
global.data={studentProfiles:[],sessions:[],datedBookings:[]};
require('../public/student-packages.js');
const SP=global.StudentPackages;

// 1. Student A: EIP 2 days/week (8 EIP + 1 OT + 1 Speech per month, monthly renewal)
const studentA={
 id:'student-a',
 name:'Student A',
 programs:['eip','ot','speech'],
 packages:[SP.createPackageFromTemplate('eip_2d',{startMonth:'2026-11'})],
 sessionLedger:[]
};
global.data.studentProfiles.push(studentA);

let bal=SP.getStudentBalanceSummary(studentA,'2026-11');
assert.equal(bal.eip.remaining,8);
assert.equal(bal.ot.remaining,1);
assert.equal(bal.speech.remaining,1);

// Mark EIP Hadir -> deducts 1
let res=SP.syncStudentSessionAttendance('student-a',{sourceKey:'eip:2026-11-24:pagi:Cikgu',programme:'eip',date:'2026-11-24',attendance:'Hadir'});
assert.equal(res.action,'deducted');
bal=SP.getStudentBalanceSummary(studentA,'2026-11');
assert.equal(bal.eip.remaining,7);

// Re-save same session as Hadir -> idempotent (no double deduction)
res=SP.syncStudentSessionAttendance('student-a',{sourceKey:'eip:2026-11-24:pagi:Cikgu',programme:'eip',date:'2026-11-24',attendance:'Hadir'});
assert.equal(res.action,'already_deducted');
assert.equal(SP.getStudentBalanceSummary(studentA,'2026-11').eip.remaining,7);

// Mark OT & Speech Hadir -> both drop to 0/1 in 2026-11
SP.syncStudentSessionAttendance('student-a',{sourceKey:'ot:2026-11-24:09:00',programme:'ot',date:'2026-11-24',attendance:'Hadir'});
SP.syncStudentSessionAttendance('student-a',{sourceKey:'speech:2026-11-24:10:00',programme:'speech',date:'2026-11-24',attendance:'Hadir'});
bal=SP.getStudentBalanceSummary(studentA,'2026-11');
assert.equal(bal.ot.remaining,0);
assert.equal(bal.speech.remaining,0);

// Reverse EIP to Tidak hadir -> restores +1 (back to 8/8 in 2026-11)
res=SP.syncStudentSessionAttendance('student-a',{sourceKey:'eip:2026-11-24:pagi:Cikgu',programme:'eip',date:'2026-11-24',attendance:'Tidak hadir'});
assert.equal(res.action,'reversed');
assert.equal(SP.getStudentBalanceSummary(studentA,'2026-11').eip.remaining,8);

// Attend 2 EIP in 2026-11 -> 6 remaining in 2026-11
SP.syncStudentSessionAttendance('student-a',{sourceKey:'eip:2026-11-25:pagi:Cikgu',programme:'eip',date:'2026-11-25',attendance:'Hadir'});
SP.syncStudentSessionAttendance('student-a',{sourceKey:'eip:2026-11-26:pagi:Cikgu',programme:'eip',date:'2026-11-26',attendance:'Hadir'});
assert.equal(SP.getStudentBalanceSummary(studentA,'2026-11').eip.remaining,6);

// Next month (2026-12) -> 6 carried over + 8 new = 14 remaining (out of 16 accrued), OT=1, Speech=1
bal=SP.getStudentBalanceSummary(studentA,'2026-12');
assert.equal(bal.eip.remaining,14);
assert.equal(bal.eip.total,16);
assert.equal(bal.ot.remaining,1);
assert.equal(bal.speech.remaining,1);

// Stop package in 2026-12 -> no new accrual in 2027-01, but 14 EIP + 1 OT + 1 Speech carryover remains usable until complete!
studentA.packages[0].status='stopped';
studentA.packages[0].stoppedMonth='2026-12';
assert.equal(SP.getStudentBalanceSummary(studentA,'2027-01').eip.total,16);
assert.equal(SP.getStudentBalanceSummary(studentA,'2027-01').eip.remaining,14);
assert.equal(SP.getStudentBalanceSummary(studentA,'2027-01').ot.remaining,1);

// Deduct 1 carried-over EIP in 2027-01 -> 13 remaining
SP.syncStudentSessionAttendance('student-a',{sourceKey:'eip:2027-01-05:pagi:Cikgu',programme:'eip',date:'2027-01-05',attendance:'Hadir'});
assert.equal(SP.getStudentBalanceSummary(studentA,'2027-01').eip.remaining,13);

// 2. Student B: Custom 5 OT sessions (one-off) + Combo 3 OT & 2 Speech + EIP 3d
const studentB={
 id:'student-b',
 name:'Student B',
 programs:['ot'],
 packages:[SP.createPackageFromTemplate('custom',{label:'5 Sesi OT',billingCycle:'one_off',quotas:{eip:0,ot:5,speech:0}})],
 sessionLedger:[]
};
global.data.studentProfiles.push(studentB);
SP.syncStudentSessionAttendance('student-b',{sourceKey:'ot:2026-11-24:11:00',programme:'ot',date:'2026-11-24',attendance:'Hadir'});
SP.syncStudentSessionAttendance('student-b',{sourceKey:'ot:2026-11-26:11:00',programme:'ot',date:'2026-11-26',attendance:'Hadir'});
// One-off package carries remaining balance into 2026-12
assert.equal(SP.getStudentBalanceSummary(studentB,'2026-12').ot.remaining,3);
assert.equal(SP.getStudentBalanceSummary(studentB,'2026-12').ot.total,5);

// 3. Catalog check: EIP 3d, Ala Carte OT/Speech, Combination OT/Speech
const eip3=SP.createPackageFromTemplate('eip_3d');
assert.deepEqual(eip3.quotas,{eip:12,ot:1,speech:1});
assert.equal(eip3.billingCycle,'monthly');

const alaOt=SP.createPackageFromTemplate('alacarte_ot');
assert.deepEqual(alaOt.quotas,{eip:0,ot:1,speech:0});

const alaSp=SP.createPackageFromTemplate('alacarte_speech');
assert.deepEqual(alaSp.quotas,{eip:0,ot:0,speech:1});

const combo=SP.createPackageFromTemplate('combo_ot_speech');
assert.deepEqual(combo.quotas,{eip:0,ot:3,speech:2});

console.log('PASS packages: monthly renewal, stop month, one-off carryover, idempotent Hadir deduction, Tidak hadir reversal, and all catalog packages.');
