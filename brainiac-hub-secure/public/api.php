<?php
declare(strict_types=1);
require dirname(__DIR__).'/brainiac-private/bootstrap.php';
$action=$_GET['action']??'session';
$method=$_SERVER['REQUEST_METHOD'];
if($method==='GET' && $action==='session') {
    $u=user(false);reply(['csrf'=>$_SESSION['csrf'],'user'=>$u?publicUser($u):null]);
}
if($method==='POST') {csrf();$b=body();}
elseif($method!=='GET') fail(405,'Kaedah tidak dibenarkan.');
if($method==='POST' && $action==='setup') {
    limit('setup:'.($_SERVER['REMOTE_ADDR']??''),5);
    $secret=(string)($config['setup_token']??'');
    if(strlen($secret)<32||str_contains($secret,'REPLACE_')||!hash_equals($secret,(string)($b['token']??'')))fail(403,'Kod pemasangan tidak sah.');
    [$email,$name]=identity([...$b,'role'=>'admin']);$hash=password((string)($b['password']??''));
    $pdo->beginTransaction();query('SELECT id FROM hub_state WHERE id=1'.lockSuffix())->fetch();
    if((int)query('SELECT COUNT(*) FROM hub_users')->fetchColumn()>0){$pdo->rollBack();fail(409,'Pemasangan sudah selesai. Sila log masuk.');}
    $id=uid();query('INSERT INTO hub_users(id,email,name,role,password_hash,created_at) VALUES(?,?,?,?,?,?)',[$id,$email,$name,'admin',$hash,stamp()]);audit('setup',[],$id);$pdo->commit();reply(['ok'=>true]);
}
if($method==='POST' && $action==='login') {
    $email=strtolower(trim((string)($b['email']??'')));
    limit('ip:'.($_SERVER['REMOTE_ADDR']??''),30);limit('email:'.$email,8);
    $u=query('SELECT * FROM hub_users WHERE email=?',[$email])->fetch();
    $valid=password_verify((string)($b['password']??''),$u['password_hash']??'$2y$12$0xosv0RZ9bHPgeQArSpI4u6ZYK1yA6hRTvXBqBS1KR5Wgc.0eyVJm');
    if(!$u||!$valid||!(int)$u['active']){audit('login_failed');fail(401,'Emel atau kata laluan tidak tepat.');}
    session_regenerate_id(true);$_SESSION=['uid'=>$u['id'],'version'=>(int)$u['version'],'started'=>time(),'seen'=>time(),'csrf'=>bin2hex(random_bytes(32))];
    audit('login');reply(['user'=>publicUser($u),'csrf'=>$_SESSION['csrf']]);
}
$u=user();
if($method==='POST' && $action==='logout') {audit('logout');$_SESSION=[];session_destroy();setcookie(session_name(),'', ['expires'=>time()-3600,'path'=>'/','secure'=>!$local,'httponly'=>true,'samesite'=>'Strict']);reply(['ok'=>true]);}
if($method==='POST' && $action==='password') {
    limit('password:'.$u['id'],8);
    if(!password_verify((string)($b['current']??''),$u['password_hash']))fail(422,'Kata laluan semasa tidak tepat.');
    $hash=password((string)($b['password']??''));
    query('UPDATE hub_users SET password_hash=?,version=version+1,must_change=0 WHERE id=?',[$hash,$u['id']]);
    $_SESSION['version']=(int)$u['version']+1;session_regenerate_id(true);audit('password_changed');reply(['ok'=>true]);
}
if((int)$u['must_change'])fail(403,'Tukar kata laluan sementara dahulu.');
if($method==='GET' && $action==='state') {
    $s=query('SELECT * FROM hub_state WHERE id=1')->fetch();
    if(!$s) fail(503,'Skema pangkalan data belum tersedia.');
    reply(['revision'=>(int)$s['revision'],'data'=>json_decode($s['payload'],false,64,JSON_THROW_ON_ERROR)]);
}
if($method==='POST' && $action==='state') {
    $next=$b['data']??null;$rev=$b['revision']??null;$request=$b['requestId']??'';
    $access=['sessions'=>['admin','teacher','therapist'],'plans'=>['admin','teacher'],'enquiries'=>['admin'],'studentProfiles'=>['admin','teacher','therapist'],'staffProfiles'=>['admin'],'datedBookings'=>['admin','teacher','therapist'],'weeklyBookings'=>['admin'],'classNotes'=>['admin','teacher'],'assessments'=>['admin','therapist'],'therapyNotes'=>['admin','therapist'],'progressReports'=>['admin','teacher','therapist']];
    if(!is_array($next)||!is_int($rev)||!preg_match('/^[a-f0-9-]{32,36}$/D',$request)||array_diff(array_keys($next),array_keys($access))||array_diff(array_keys($access),array_keys($next)))fail(422,'Struktur rekod tidak sah.');
    foreach($next as $collection=>$rows){
        if(!is_array($rows)||!array_is_list($rows)||count($rows)>20000)fail(422,'Koleksi rekod tidak sah.');
        $ids=[];foreach($rows as $r){
            if(!is_array($r))fail(422,'Rekod tidak sah.');
            $key=$collection==='datedBookings'?'key':'id';
            if(!isset($r[$key])||(!is_string($r[$key])&&!is_int($r[$key]))||isset($ids[(string)$r[$key]]))fail(422,'ID rekod kosong atau berulang.');
            if(!preg_match($key==='key'?'/^[A-Za-z0-9_.:%!\x27()*-]{1,600}$/D':'/^[A-Za-z0-9_.:-]{1,100}$/D',(string)$r[$key]))fail(422,'Format ID rekod tidak sah.');
            $ids[(string)$r[$key]]=true;
        }
    }
    // Preserve JSON objects such as studentNotes:{}; associative decoding alone turns them into [].
    $rawState=json_decode(file_get_contents('php://input'),false,64,JSON_THROW_ON_ERROR)->data;
    $payload=json_encode($rawState,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);$digest=hash('sha256',$payload);
    $pdo->beginTransaction();$current=query('SELECT * FROM hub_state WHERE id=1'.lockSuffix())->fetch();
    $u=user();
    $receipt=query('SELECT * FROM hub_writes WHERE id=?',[$request])->fetch();
    if($receipt){$pdo->rollBack();if($receipt['actor']!==$u['id']||!hash_equals($receipt['digest'],$digest))fail(409,'ID permintaan telah digunakan.');reply(['ok'=>true,'revision'=>(int)$receipt['revision']]);}
    if((int)$current['revision']!==$rev){$pdo->rollBack();fail(409,'Data telah dikemas kini oleh pengguna lain. Simpan salinan catatan anda, kemudian muat semula halaman sebelum meneruskan.');}
    $before=json_decode($current['payload'],true,64,JSON_THROW_ON_ERROR);$changes=[];
    foreach($access as $key=>$roles){
        if($before[$key]===$next[$key])continue;
        if(!in_array($u['role'],$roles,true)){$pdo->rollBack();fail(403,'Peranan anda tidak boleh mengubah '.$key.'.');}
        // Legacy sessions can hold clinical notes: restrict changes to those fields by discipline.
        if($key==='sessions'&&$u['role']!=='admin'){
            $old=[];foreach($before[$key] as $r)$old[(string)$r['id']]=$r;
            if(count($before[$key])!==count($next[$key])){$pdo->rollBack();fail(403,'Gunakan kalendar untuk mengurus sesi.');}
            foreach($next[$key] as $r){$o=$old[(string)$r['id']]??null;$allowed=['attendance','status','replacement'];if(($o['programme']??'')==='EIP'?$u['role']==='teacher':$u['role']==='therapist')$allowed[]='note';$mask=array_flip($allowed);if(!$o||array_diff_key($r,$mask)!==array_diff_key($o,$mask)){$pdo->rollBack();fail(403,'Perubahan sesi ini tidak dibenarkan.');}}
        }
        $changes[]=$key;
    }
    query('UPDATE hub_state SET revision=revision+1,payload=? WHERE id=1',[$payload]);
    query('INSERT INTO hub_writes(id,actor,digest,revision,created_at) VALUES(?,?,?,?,?)',[$request,$u['id'],$digest,$rev+1,stamp()]);
    audit('records_saved',['collections'=>$changes,'revision'=>$rev+1]);$pdo->commit();reply(['ok'=>true,'revision'=>$rev+1]);
}
function requirePermanentStaff(array $user): void {
    if(($user['role']??'')==='therapist') {
        fail(403,'Modul HR & Penggajian khas untuk Guru dan Admin sahaja. Terapis sambilan tidak memerlukan modul ini.');
    }
}
// HR Settings (Public to permanent staff for center coordinates, admin for saving)
if($method==='GET' && $action==='hr_settings') {
    ensureHrTables();
    $s=query('SELECT * FROM hub_hr_settings WHERE id=1')->fetch();
    reply(['settings'=>$s?:[]]);
}
if($method==='POST' && $action==='hr_settings_save') {
    if($u['role']!=='admin')fail(403,'Akses Admin diperlukan.');
    ensureHrTables();
    $name=trim((string)($b['center_name']??'Beruntung Brainiac'));
    $ssm=trim((string)($b['center_ssm']??'202503030392 (003694359-M)'));
    $epf=trim((string)($b['epf_employer_no']??''));
    $socso=trim((string)($b['socso_employer_no']??''));
    $lat=(float)($b['latitude']??3.36965100);
    $lon=(float)($b['longitude']??101.57162700);
    $radius=max(10,(int)($b['geofence_radius_meters']??100));
    $shift=max(1.0,(float)($b['shift_hours']??8.50));
    $payDay=min(31,max(1,(int)($b['pay_day']??27)));
    query('UPDATE hub_hr_settings SET center_name=?,center_ssm=?,epf_employer_no=?,socso_employer_no=?,latitude=?,longitude=?,geofence_radius_meters=?,shift_hours=?,pay_day=?,updated_at=? WHERE id=1',
        [$name,$ssm,$epf,$socso,$lat,$lon,$radius,$shift,$payDay,stamp()]);
    audit('hr_settings_updated',['lat'=>$lat,'lon'=>$lon,'radius'=>$radius],$u['id']);
    reply(['ok'=>true,'message'=>'Tetapan HR & Geofencing berjaya dikemas kini.']);
}

// Attendance & Geofencing Endpoints
if($method==='GET' && $action==='clock_status') {
    requirePermanentStaff($u);
    ensureHrTables();
    $my=malaysiaNow();
    $settings=query('SELECT * FROM hub_hr_settings WHERE id=1')->fetch();
    $rec=query('SELECT * FROM hub_staff_attendance WHERE user_id=? AND work_date=? ORDER BY created_at DESC LIMIT 1',[$u['id'],$my['date']])->fetch();
    reply([
        'today'=>$my['date'],
        'currentTime'=>$my['time'],
        'settings'=>$settings,
        'record'=>$rec?:null,
        'status'=>!$rec?'not_clocked_in':(empty($rec['clock_out'])?'clocked_in':'clocked_out')
    ]);
}
if($method==='POST' && $action==='clock_in') {
    requirePermanentStaff($u);
    ensureHrTables();
    $my=malaysiaNow();
    $settings=query('SELECT * FROM hub_hr_settings WHERE id=1')->fetch();
    $existing=query('SELECT * FROM hub_staff_attendance WHERE user_id=? AND work_date=? AND clock_out IS NULL LIMIT 1',[$u['id'],$my['date']])->fetch();
    if($existing) fail(409,'Anda sudah Clock In hari ini pada '.substr($existing['clock_in'],11,5).'. Sila Clock Out apabila tamat syif.');
    
    $isMobile=!empty($b['is_mobile']);
    $lat=isset($b['latitude'])&&$b['latitude']!==''?(float)$b['latitude']:null;
    $lon=isset($b['longitude'])&&$b['longitude']!==''?(float)$b['longitude']:null;
    if(!$isMobile && $u['role']!=='admin') {
        fail(422,'Wajib menggunakan telefon pintar staf untuk Clock In dengan pengesahan GPS premis.');
    }
    if(($lat===null || $lon===null) && $u['role']!=='admin') {
        fail(422,'Lokasi GPS tidak dikesan. Sila hidupkan Location Services (GPS) pada telefon pintar anda.');
    }

    $dist=0;
    $allowedRadius=(int)($settings['geofence_radius_meters']??100);
    if($lat!==null && $lon!==null) {
        $cLat=(float)($settings['latitude']??3.36965100);
        $cLon=(float)($settings['longitude']??101.57162700);
        $dist=haversineDistanceMeters($lat,$lon,$cLat,$cLon);
        if($dist>$allowedRadius && $u['role']!=='admin') {
            fail(422,"Anda berada di luar lingkungan pusat ($dist meter). Clock In hanya dibenarkan dalam lingkungan {$allowedRadius}m dari Beruntung Brainiac.");
        }
    }

    $loc=trim((string)($b['location']??'Pusat'));
    $note=trim((string)($b['note']??''));
    if(strlen($note)>1000)fail(422,'Catatan terlalu panjang.');
    $status=((int)str_replace(':','',$my['time'])>900)?'Lewat':'Tepat masa';
    $id=uid();
    query('INSERT INTO hub_staff_attendance(id,user_id,user_name,user_role,work_date,clock_in,clock_out,duration_minutes,latitude,longitude,distance_meters,device_type,work_location,status,note,created_at,updated_at) VALUES(?,?,?,?,?,?,NULL,0,?,?,?,?,?,?,?,?,?)',
        [$id,$u['id'],$u['name'],$u['role'],$my['date'],$my['iso'],$lat,$lon,$dist,$isMobile?'Mobile':'Desktop',$loc,$status,$note,stamp(),stamp()]);
    audit('clock_in',['date'=>$my['date'],'time'=>$my['time'],'dist'=>$dist],$u['id']);
    $rec=query('SELECT * FROM hub_staff_attendance WHERE id=?',[$id])->fetch();
    reply(['ok'=>true,'record'=>$rec,'message'=>'Clock In berjaya disahkan pada '.$my['time'].' (Jarak: '.$dist.'m). Selamat bertugas!']);
}
if($method==='POST' && $action==='clock_out') {
    requirePermanentStaff($u);
    ensureHrTables();
    $my=malaysiaNow();
    $settings=query('SELECT * FROM hub_hr_settings WHERE id=1')->fetch();
    $existing=query('SELECT * FROM hub_staff_attendance WHERE user_id=? AND work_date=? AND clock_out IS NULL ORDER BY created_at DESC LIMIT 1',[$u['id'],$my['date']])->fetch();
    if(!$existing){
        $any=query('SELECT * FROM hub_staff_attendance WHERE user_id=? AND work_date=? ORDER BY created_at DESC LIMIT 1',[$u['id'],$my['date']])->fetch();
        if($any&&!empty($any['clock_out']))fail(409,'Anda sudah selesai Clock Out untuk hari ini pada '.substr($any['clock_out'],11,5).'.');
        fail(404,'Tiada rekod Clock In aktif hari ini.');
    }
    $note=trim((string)($b['note']??''));
    $finalNote=$existing['note'];
    if($note!==''){$finalNote=$finalNote?($finalNote.' | '.$note):$note;}
    if(strlen($finalNote)>2000)$finalNote=substr($finalNote,0,2000);
    $inTime=strtotime($existing['clock_in']);
    $outTime=time();
    $mins=max(1,(int)round(($outTime-$inTime)/60));

    $reqMins=(int)round(((float)($settings['shift_hours']??8.50))*60);
    $wasLate=str_starts_with((string)$existing['status'],'Lewat');
    if($mins>=$reqMins){
        $status=$wasLate?'Lewat (Cukup Syif)':'Cukup Syif';
    }else{
        $status=$wasLate?'Lewat (Kurang Jam)':'Kurang Jam';
    }

    query('UPDATE hub_staff_attendance SET clock_out=?,duration_minutes=?,status=?,note=?,updated_at=? WHERE id=?',
        [$my['iso'],$mins,$status,$finalNote,stamp(),$existing['id']]);
    audit('clock_out',['date'=>$my['date'],'time'=>$my['time'],'duration'=>$mins],$u['id']);
    $rec=query('SELECT * FROM hub_staff_attendance WHERE id=?',[$existing['id']])->fetch();
    reply(['ok'=>true,'record'=>$rec,'message'=>'Clock Out berjaya direkodkan pada '.$my['time'].' ('.$status.'). Terima kasih atas khidmat anda!']);
}
if($method==='GET' && $action==='my_attendance') {
    requirePermanentStaff($u);
    ensureHrTables();
    $rows=query('SELECT * FROM hub_staff_attendance WHERE user_id=? ORDER BY work_date DESC, clock_in DESC LIMIT 90',[$u['id']])->fetchAll();
    reply(['records'=>$rows]);
}

function ensureStaffLeaveBalance(string $userId, int $year): array {
    $bal=query('SELECT * FROM hub_leave_balances WHERE user_id=? AND year=?',[$userId,$year])->fetch();
    if($bal)return $bal;
    // Automatic annual rollover (carry forward up to carry_forward_max from previous year)
    $prev=query('SELECT * FROM hub_leave_balances WHERE user_id=? AND year=?',[$userId,$year-1])->fetch();
    $carry=0.0;$carryMax=5.0;$annTot=12.0;$medTot=14.0;$hospTot=60.0;$matTot=98.0;
    if($prev){
        $carryMax=(float)$prev['carry_forward_max'];
        $rem=max(0.0,((float)$prev['annual_total']+(float)$prev['annual_carry_forward'])-(float)$prev['annual_used']);
        $carry=min($carryMax,$rem);
        $annTot=(float)$prev['annual_total'];
        $medTot=(float)$prev['medical_total'];
        $hospTot=(float)$prev['hospitalisation_total'];
        $matTot=(float)$prev['maternity_total'];
    }
    $id=uid();
    query('INSERT INTO hub_leave_balances (id,user_id,year,annual_total,annual_used,annual_carry_forward,carry_forward_max,medical_total,medical_used,hospitalisation_total,hospitalisation_used,maternity_total,maternity_used,created_at,updated_at) VALUES (?,?,?,?,0.0,?,?,?,0.0,?,0.0,?,0.0,?,?)',
        [$id,$userId,$year,$annTot,$carry,$carryMax,$medTot,$hospTot,$matTot,stamp(),stamp()]);
    return query('SELECT * FROM hub_leave_balances WHERE id=?',[$id])->fetch();
}

function ensureStaffClaimAllowance(string $userId, int $year): array {
    $bal=query('SELECT * FROM hub_medical_allowance_balances WHERE user_id=? AND year=?',[$userId,$year])->fetch();
    if($bal)return $bal;
    // Reset every 1st Jan, keeping custom annual_limit if previously set
    $prev=query('SELECT * FROM hub_medical_allowance_balances WHERE user_id=? AND year=?',[$userId,$year-1])->fetch();
    $limit=$prev?(float)$prev['annual_limit']:500.00;
    $id=uid();
    query('INSERT INTO hub_medical_allowance_balances(id,user_id,year,annual_limit,amount_used,balance,created_at,updated_at) VALUES(?,?,?,?,0.00,?,?,?)',
        [$id,$userId,$year,$limit,$limit,stamp(),stamp()]);
    return query('SELECT * FROM hub_medical_allowance_balances WHERE id=?',[$id])->fetch();
}

// Leaves & Balances (Staff)
if($method==='GET' && $action==='my_leaves') {
    requirePermanentStaff($u);
    ensureHrTables();
    $year=(int)date('Y');
    $bal=ensureStaffLeaveBalance($u['id'],$year);
    $history=query('SELECT * FROM hub_staff_leaves WHERE user_id=? ORDER BY created_at DESC LIMIT 60',[$u['id']])->fetchAll();
    reply(['balance'=>$bal,'leaves'=>$history]);
}
if($method==='POST' && $action==='apply_leave') {
    requirePermanentStaff($u);
    ensureHrTables();
    $year=(int)date('Y');
    $type=trim((string)($b['leave_type']??'annual'));
    $startDate=trim((string)($b['start_date']??''));
    $endDate=trim((string)($b['end_date']??''));
    $days=max(0.5,(float)($b['days_count']??1.0));
    $reason=trim((string)($b['reason']??''));
    $attachmentUrl=trim((string)($b['attachment_url']??''));
    $attachmentName=trim((string)($b['attachment_name']??''));
    if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$startDate)||!preg_match('/^\d{4}-\d{2}-\d{2}$/',$endDate))fail(422,'Format tarikh cuti tidak sah.');
    if($endDate<$startDate)fail(422,'Tarikh akhir cuti tidak boleh lebih awal daripada tarikh mula.');
    if($reason==='')fail(422,'Sila masukkan sebab permohonan cuti.');
    if($type==='medical' && $attachmentUrl==='')fail(422,'Wajib memuat naik foto dokumen sijil cuti sakit (MC).');

    $bal=ensureStaffLeaveBalance($u['id'],$year);
    if($bal && in_array($type,['annual','medical','hospitalisation','maternity'],true)){
        $tot=(float)$bal[$type.'_total']+($type==='annual'?(float)$bal['annual_carry_forward']:0);
        $usd=(float)$bal[$type.'_used'];
        if(($usd+$days)>$tot)fail(422,"Baki cuti tidak mencukupi (Baki: ".($tot-$usd)." hari).");
    }
    $id=uid();
    query('INSERT INTO hub_staff_leaves(id,user_id,user_name,leave_type,start_date,end_date,days_count,reason,attachment_url,attachment_name,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        [$id,$u['id'],$u['name'],$type,$startDate,$endDate,$days,$reason,$attachmentUrl?:null,$attachmentName?:null,'Pending',stamp(),stamp()]);
    audit('apply_leave',['type'=>$type,'days'=>$days,'start'=>$startDate],$u['id']);
    reply(['ok'=>true,'id'=>$id,'message'=>'Permohonan cuti berjaya dihantar untuk kelulusan Pentadbir.']);
}

// Medical Claims (Staff)
if($method==='GET' && $action==='my_claims') {
    requirePermanentStaff($u);
    ensureHrTables();
    $year=(int)date('Y');
    $bal=ensureStaffClaimAllowance($u['id'],$year);
    $claims=query('SELECT * FROM hub_medical_claims WHERE user_id=? ORDER BY created_at DESC LIMIT 60',[$u['id']])->fetchAll();
    reply(['allowance'=>$bal,'claims'=>$claims]);
}
if($method==='POST' && $action==='apply_claim') {
    requirePermanentStaff($u);
    ensureHrTables();
    $year=(int)date('Y');
    $treatDate=trim((string)($b['treatment_date']??''));
    $clinic=trim((string)($b['clinic_name']??''));
    $amount=max(0.01,round((float)($b['amount']??0),2));
    $notes=trim((string)($b['notes']??''));
    $receiptUrl=trim((string)($b['receipt_url']??''));
    $receiptName=trim((string)($b['receipt_name']??''));
    if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$treatDate))fail(422,'Format tarikh rawatan tidak sah.');
    if($clinic==='')fail(422,'Sila masukkan nama klinik/hospital.');
    if($amount<=0)fail(422,'Jumlah tuntutan mesti lebih daripada RM0.');
    if($receiptUrl==='')fail(422,'Wajib memuat naik foto resit bil rawatan klinik.');

    $bal=ensureStaffClaimAllowance($u['id'],$year);
    $rem=(float)$bal['balance'];
    if($amount>$rem)fail(422,"Jumlah tuntutan (RM".number_format($amount,2).") melebihi baki elaun perubatan tahunan anda (Baki: RM".number_format($rem,2).").");

    $id=uid();
    query('INSERT INTO hub_medical_claims(id,user_id,user_name,year,treatment_date,clinic_name,amount,receipt_url,receipt_name,notes,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        [$id,$u['id'],$u['name'],$year,$treatDate,$clinic,$amount,$receiptUrl,$receiptName?:null,$notes,'Pending',stamp(),stamp()]);
    audit('apply_claim',['clinic'=>$clinic,'amount'=>$amount],$u['id']);
    reply(['ok'=>true,'id'=>$id,'message'=>'Tuntutan perubatan RM'.number_format($amount,2).' berjaya dihantar untuk semakan Admin.']);
}

// Self-Service Payslips
if($method==='GET' && $action==='my_payslips') {
    requirePermanentStaff($u);
    ensureHrTables();
    $rows=query('SELECT * FROM hub_payslips WHERE user_id=? ORDER BY `year_month` DESC',[$u['id']])->fetchAll();
    reply(['payslips'=>$rows]);
}

// ADMIN-ONLY ACTIONS
if($u['role']!=='admin')fail(403,'Akses Admin diperlukan.');

// Admin Attendance
if($method==='GET' && $action==='admin_attendance') {
    ensureHrTables();
    $from=trim((string)($_GET['from']??''));
    $to=trim((string)($_GET['to']??''));
    $userId=trim((string)($_GET['user_id']??''));
    $role=trim((string)($_GET['role']??''));
    $sql='SELECT * FROM hub_staff_attendance WHERE 1=1';
    $args=[];
    if($from!==''&&preg_match('/^\d{4}-\d{2}-\d{2}$/',$from)){$sql.=' AND work_date>=?';$args[]=$from;}
    if($to!==''&&preg_match('/^\d{4}-\d{2}-\d{2}$/',$to)){$sql.=' AND work_date<=?';$args[]=$to;}
    if($userId!==''&&$userId!=='all'){$sql.=' AND user_id=?';$args[]=$userId;}
    if($role!==''&&$role!=='all'){$sql.=' AND user_role=?';$args[]=$role;}
    $sql.=' ORDER BY work_date DESC, clock_in DESC LIMIT 500';
    $rows=query($sql,$args)->fetchAll();
    $users=query("SELECT id, name, role, email FROM hub_users WHERE role IN ('admin','teacher') ORDER BY name")->fetchAll();
    reply(['records'=>$rows,'users'=>$users]);
}
if($method==='POST' && $action==='admin_attendance_save') {
    ensureHrTables();
    $id=trim((string)($b['id']??''));
    $userId=trim((string)($b['user_id']??''));
    $targetUser=query('SELECT * FROM hub_users WHERE id=?',[$userId])->fetch();
    if(!$targetUser)fail(404,'Staf tidak ditemui.');
    $workDate=trim((string)($b['work_date']??''));
    if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$workDate))fail(422,'Format tarikh tidak sah (YYYY-MM-DD).');
    $clockIn=trim((string)($b['clock_in']??''));
    $clockOut=trim((string)($b['clock_out']??''));
    $loc=trim((string)($b['work_location']??'Pusat'));
    $status=trim((string)($b['status']??'Tepat masa'));
    $reason=trim((string)($b['adjustment_reason']??''));
    if($reason==='')fail(422,'Wajib memasukkan Sebab Pelarasan Manual untuk tujuan audit.');
    $note=trim((string)($b['note']??''));
    $mins=(int)($b['duration_minutes']??0);
    if($mins<=0&&$clockIn!==''&&$clockOut!==''){
        $mins=max(0,(int)round((strtotime($clockOut)-strtotime($clockIn))/60));
    }
    if($id){
        $old=query('SELECT * FROM hub_staff_attendance WHERE id=?',[$id])->fetch();
        if(!$old)fail(404,'Rekod kehadiran tidak ditemui.');
        query('UPDATE hub_staff_attendance SET user_id=?,user_name=?,user_role=?,work_date=?,clock_in=?,clock_out=?,duration_minutes=?,work_location=?,status=?,adjustment_reason=?,note=?,updated_at=? WHERE id=?',
            [$targetUser['id'],$targetUser['name'],$targetUser['role'],$workDate,$clockIn,$clockOut?:null,$mins,$loc,$status,$reason,$note,stamp(),$id]);
        audit('admin_attendance_edit',['id'=>$id,'user_id'=>$targetUser['id'],'reason'=>$reason],$u['id']);
    }else{
        $id=uid();
        query('INSERT INTO hub_staff_attendance(id,user_id,user_name,user_role,work_date,clock_in,clock_out,duration_minutes,work_location,status,adjustment_reason,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [$id,$targetUser['id'],$targetUser['name'],$targetUser['role'],$workDate,$clockIn,$clockOut?:null,$mins,$loc,$status,$reason,$note,stamp(),stamp()]);
        audit('admin_attendance_add',['id'=>$id,'user_id'=>$targetUser['id'],'reason'=>$reason],$u['id']);
    }
    reply(['ok'=>true,'id'=>$id,'message'=>'Rekod kehadiran berjaya diselaraskan.']);
}
if($method==='POST' && $action==='admin_attendance_delete') {
    ensureHrTables();
    $id=trim((string)($b['id']??''));
    query('DELETE FROM hub_staff_attendance WHERE id=?',[$id]);
    audit('admin_attendance_delete',['id'=>$id],$u['id']);
    reply(['ok'=>true,'message'=>'Rekod kehadiran dipadamkan.']);
}

// Admin Leaves Management
if($method==='GET' && $action==='admin_leaves') {
    ensureHrTables();
    $year=(int)date('Y');
    $users=query("SELECT id, name, role, email FROM hub_users WHERE role IN ('admin','teacher') ORDER BY name")->fetchAll();
    foreach($users as $usr){ensureStaffLeaveBalance($usr['id'],$year);}
    $leaves=query('SELECT * FROM hub_staff_leaves ORDER BY created_at DESC LIMIT 300')->fetchAll();
    $balances=query('SELECT b.*, u.name as user_name, u.role as user_role, u.email FROM hub_leave_balances b JOIN hub_users u ON b.user_id = u.id WHERE b.year=? ORDER BY u.name',[$year])->fetchAll();
    reply(['leaves'=>$leaves,'balances'=>$balances,'users'=>$users]);
}
if($method==='POST' && $action==='admin_leave_action') {
    ensureHrTables();
    $id=trim((string)($b['id']??''));
    $actionType=trim((string)($b['action_type']??'')); // 'Approved' or 'Rejected'
    $adminNotes=trim((string)($b['admin_notes']??''));
    if(!in_array($actionType,['Approved','Rejected'],true))fail(422,'Tindakan kelulusan tidak sah.');

    $leave=query('SELECT * FROM hub_staff_leaves WHERE id=?',[$id])->fetch();
    if(!$leave)fail(404,'Permohonan cuti tidak ditemui.');
    if($leave['status']!=='Pending')fail(409,'Permohonan ini telah disemak terdahulu.');

    $pdo->beginTransaction();
    query('UPDATE hub_staff_leaves SET status=?,admin_notes=?,reviewed_by=?,reviewed_at=?,updated_at=? WHERE id=?',
        [$actionType,$adminNotes,$u['id'],stamp(),stamp(),$id]);

    if($actionType==='Approved'){
        $year=(int)substr($leave['start_date'],0,4);
        ensureStaffLeaveBalance($leave['user_id'],$year);
        $type=$leave['leave_type'];
        $days=(float)$leave['days_count'];
        if(in_array($type,['annual','medical','hospitalisation','maternity'],true)){
            query("UPDATE hub_leave_balances SET {$type}_used={$type}_used+?,updated_at=? WHERE user_id=? AND year=?",
                [$days,stamp(),$leave['user_id'],$year]);
        }
        // Sync every date in range to attendance record with proper user role and Malaysia timezone
        $targetUser=query('SELECT role FROM hub_users WHERE id=?',[$leave['user_id']])->fetch();
        $uRole=$targetUser['role']??'teacher';
        $typeLabel=['annual'=>'Cuti Tahunan','medical'=>'Cuti Sakit (MC)','hospitalisation'=>'Cuti Hospitalisasi','maternity'=>'Cuti Bersalin'][$type]??('Cuti '.ucfirst($type));
        $curTs=strtotime($leave['start_date']);
        $endTs=strtotime($leave['end_date']);
        $guard=0;
        while($curTs!==false && $endTs!==false && $curTs<=$endTs && $guard<120){
            $dStr=date('Y-m-d',$curTs);
            $attId=uid();
            query('INSERT INTO hub_staff_attendance(id,user_id,user_name,user_role,work_date,clock_in,clock_out,duration_minutes,work_location,status,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [$attId,$leave['user_id'],$leave['user_name'],$uRole,$dStr,$dStr.'T08:30:00+08:00',$dStr.'T17:00:00+08:00',0,'Cuti','Cuti',$typeLabel.' diluluskan: '.$leave['reason'],stamp(),stamp()]);
            $curTs=strtotime('+1 day',$curTs);
            $guard++;
        }
    }
    audit('admin_leave_action',['id'=>$id,'status'=>$actionType],$u['id']);
    $pdo->commit();
    reply(['ok'=>true,'message'=>'Permohonan cuti telah berjaya '.($actionType==='Approved'?'diluluskan':'ditolak').'.']);
}
if($method==='POST' && $action==='admin_leave_balance_save') {
    ensureHrTables();
    $userId=trim((string)($b['user_id']??''));
    $year=(int)($b['year']??date('Y'));
    $annTotal=max(0,(float)($b['annual_total']??12));
    $annCarry=max(0,(float)($b['annual_carry_forward']??0));
    $carryMax=max(0,(float)($b['carry_forward_max']??5));
    $medTotal=max(0,(float)($b['medical_total']??14));
    $hospTotal=max(0,(float)($b['hospitalisation_total']??60));
    $matTotal=max(0,(float)($b['maternity_total']??98));

    $bal=query('SELECT id FROM hub_leave_balances WHERE user_id=? AND year=?',[$userId,$year])->fetch();
    if($bal){
        query('UPDATE hub_leave_balances SET annual_total=?,annual_carry_forward=?,carry_forward_max=?,medical_total=?,hospitalisation_total=?,maternity_total=?,updated_at=? WHERE id=?',
            [$annTotal,$annCarry,$carryMax,$medTotal,$hospTotal,$matTotal,stamp(),$bal['id']]);
    }else{
        $id=uid();
        query('INSERT INTO hub_leave_balances(id,user_id,year,annual_total,annual_used,annual_carry_forward,carry_forward_max,medical_total,medical_used,hospitalisation_total,hospitalisation_used,maternity_total,maternity_used,created_at,updated_at) VALUES(?,?,?,?,0.0,?,?,?,0.0,?,0.0,?,0.0,?,?)',
            [$id,$userId,$year,$annTotal,$annCarry,$carryMax,$medTotal,$hospTotal,$matTotal,stamp(),stamp()]);
    }
    audit('admin_leave_balance_save',['user_id'=>$userId,'year'=>$year],$u['id']);
    reply(['ok'=>true,'message'=>'Kuota cuti staf berjaya disimpan.']);
}

// Admin Medical Claims Management
if($method==='GET' && $action==='admin_claims') {
    ensureHrTables();
    $year=(int)date('Y');
    $users=query("SELECT id, name, role, email FROM hub_users WHERE role IN ('admin','teacher') ORDER BY name")->fetchAll();
    foreach($users as $usr){ensureStaffClaimAllowance($usr['id'],$year);}
    $claims=query('SELECT * FROM hub_medical_claims ORDER BY created_at DESC LIMIT 300')->fetchAll();
    $allowances=query('SELECT b.*, u.name as user_name, u.role as user_role, u.email FROM hub_medical_allowance_balances b JOIN hub_users u ON b.user_id = u.id WHERE b.year=? ORDER BY u.name',[$year])->fetchAll();
    reply(['claims'=>$claims,'allowances'=>$allowances,'users'=>$users]);
}
if($method==='POST' && $action==='admin_claim_action') {
    ensureHrTables();
    $id=trim((string)($b['id']??''));
    $actionType=trim((string)($b['action_type']??'')); // 'Approved' or 'Rejected'
    $adminNotes=trim((string)($b['admin_notes']??''));
    if(!in_array($actionType,['Approved','Rejected'],true))fail(422,'Tindakan kelulusan tidak sah.');

    $claim=query('SELECT * FROM hub_medical_claims WHERE id=?',[$id])->fetch();
    if(!$claim)fail(404,'Tuntutan perubatan tidak ditemui.');
    if($claim['status']!=='Pending')fail(409,'Tuntutan ini telah disemak terdahulu.');

    $pdo->beginTransaction();
    query('UPDATE hub_medical_claims SET status=?,admin_notes=?,reviewed_by=?,reviewed_at=?,updated_at=? WHERE id=?',
        [$actionType,$adminNotes,$u['id'],stamp(),stamp(),$id]);

    if($actionType==='Approved'){
        $amt=(float)$claim['amount'];
        $year=(int)$claim['year'];
        ensureStaffClaimAllowance($claim['user_id'],$year);
        query('UPDATE hub_medical_allowance_balances SET amount_used=amount_used+?, balance=GREATEST(0,balance-?), updated_at=? WHERE user_id=? AND year=?',
            [$amt,$amt,stamp(),$claim['user_id'],$year]);
    }
    audit('admin_claim_action',['id'=>$id,'status'=>$actionType],$u['id']);
    $pdo->commit();
    reply(['ok'=>true,'message'=>'Tuntutan perubatan berjaya '.($actionType==='Approved'?'diluluskan dan ditolak daripada baki elaun staf':'ditolak').'.']);
}
if($method==='POST' && $action==='admin_claim_balance_save') {
    ensureHrTables();
    $userId=trim((string)($b['user_id']??''));
    $year=(int)($b['year']??date('Y'));
    $limit=max(0,(float)($b['annual_limit']??500.00));
    $bal=query('SELECT id, amount_used FROM hub_medical_allowance_balances WHERE user_id=? AND year=?',[$userId,$year])->fetch();
    if($bal){
        $newBal=max(0,$limit-(float)$bal['amount_used']);
        query('UPDATE hub_medical_allowance_balances SET annual_limit=?,balance=?,updated_at=? WHERE id=?',
            [$limit,$newBal,stamp(),$bal['id']]);
    }else{
        $id=uid();
        query('INSERT INTO hub_medical_allowance_balances(id,user_id,year,annual_limit,amount_used,balance,created_at,updated_at) VALUES(?,?,?,?,0.00,?,?,?)',
            [$id,$userId,$year,$limit,$limit,stamp(),stamp()]);
    }
    audit('admin_claim_balance_save',['user_id'=>$userId,'limit'=>$limit],$u['id']);
    reply(['ok'=>true,'message'=>'Had elaun perubatan tahunan staf berjaya dikemas kini.']);
}

// Admin Payroll Management
if($method==='GET' && $action==='admin_payroll_data') {
    ensureHrTables();
    $users=query("SELECT id, name, role, email FROM hub_users WHERE role IN ('admin','teacher') ORDER BY name")->fetchAll();
    $profiles=query('SELECT * FROM hub_staff_payroll_profiles')->fetchAll();
    $runs=query('SELECT * FROM hub_payroll_runs ORDER BY `year_month` DESC')->fetchAll();
    $payslips=query('SELECT * FROM hub_payslips ORDER BY `year_month` DESC, user_name ASC')->fetchAll();
    $claimsPending=query("SELECT * FROM hub_medical_claims WHERE status='Approved' AND paid_via_payroll=0 ORDER BY treatment_date DESC")->fetchAll();
    $settings=query('SELECT * FROM hub_hr_settings WHERE id=1')->fetch();
    reply(['users'=>$users,'profiles'=>$profiles,'runs'=>$runs,'payslips'=>$payslips,'approvedClaims'=>$claimsPending,'settings'=>$settings]);
}
if($method==='POST' && $action==='admin_payroll_profile_save') {
    ensureHrTables();
    $userId=trim((string)($b['user_id']??''));
    $targetUser=query('SELECT * FROM hub_users WHERE id=?',[$userId])->fetch();
    if(!$targetUser)fail(404,'Staf tidak ditemui.');

    $ic=trim((string)($b['ic_no']??''));
    $epf=trim((string)($b['epf_no']??''));
    $socso=trim((string)($b['socso_no']??''));
    $tax=trim((string)($b['income_tax_no']??''));
    $bank=trim((string)($b['bank_name']??''));
    $bankAcc=trim((string)($b['bank_acc_no']??''));
    $basic=max(0,(float)($b['basic_salary']??0.00));
    $allowance=max(0,(float)($b['fixed_allowance']??0.00));
    $epfEeRate=(float)($b['epf_employee_rate']??11.00);
    $epfErRate=(float)($b['epf_employer_rate']??13.00);
    $socsoCat=trim((string)($b['socso_category']??'cat1'));
    $eisActive=!empty($b['eis_active'])?1:0;
    $skbbkActive=isset($b['skbbk_active'])?(!empty($b['skbbk_active'])?1:0):1;
    $pcb=max(0,(float)($b['monthly_pcb']??0.00));

    $rawOther=$b['other_deductions']??[];
    if(is_string($rawOther)){
        $trimmed=trim($rawOther);
        if($trimmed===''){
            $rawOther=[];
        }else{
            $decoded=json_decode($trimmed,true);
            $rawOther=is_array($decoded)?$decoded:null;
        }
    }
    if(!is_array($rawOther))fail(422,'Format potongan lain-lain tidak sah.');
    if(count($rawOther)>20)fail(422,'Maksimum 20 item potongan lain-lain dibenarkan.');
    $otherDeductions=[];
    foreach($rawOther as $item){
        if(!is_array($item))fail(422,'Item potongan lain-lain tidak sah.');
        $desc=trim((string)($item['description']??''));
        $amt=round((float)($item['amount']??0),2);
        if($desc==='' && $amt==0.0)continue;
        if($desc==='')fail(422,'Sila masukkan penerangan bagi setiap potongan lain-lain.');
        if(strlen($desc)>150)fail(422,'Penerangan potongan lain-lain maksimum 150 aksara.');
        if($amt<=0)fail(422,'Jumlah potongan lain-lain mesti lebih daripada RM0.00.');
        $otherDeductions[]=['description'=>$desc,'amount'=>$amt];
    }
    $otherJson=json_encode($otherDeductions,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);

    $existing=query('SELECT id FROM hub_staff_payroll_profiles WHERE user_id=?',[$userId])->fetch();
    if($existing){
        query('UPDATE hub_staff_payroll_profiles SET ic_no=?,epf_no=?,socso_no=?,income_tax_no=?,bank_name=?,bank_acc_no=?,basic_salary=?,fixed_allowance=?,epf_employee_rate=?,epf_employer_rate=?,socso_category=?,eis_active=?,skbbk_active=?,monthly_pcb=?,other_deductions_json=?,updated_at=? WHERE id=?',
            [$ic,$epf,$socso,$tax,$bank,$bankAcc,$basic,$allowance,$epfEeRate,$epfErRate,$socsoCat,$eisActive,$skbbkActive,$pcb,$otherJson,stamp(),$existing['id']]);
    }else{
        $id=uid();
        query('INSERT INTO hub_staff_payroll_profiles(id,user_id,ic_no,epf_no,socso_no,income_tax_no,bank_name,bank_acc_no,basic_salary,fixed_allowance,epf_employee_rate,epf_employer_rate,socso_category,eis_active,skbbk_active,monthly_pcb,other_deductions_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [$id,$userId,$ic,$epf,$socso,$tax,$bank,$bankAcc,$basic,$allowance,$epfEeRate,$epfErRate,$socsoCat,$eisActive,$skbbkActive,$pcb,$otherJson,stamp(),stamp()]);
    }
    audit('admin_payroll_profile_save',['user_id'=>$userId,'basic'=>$basic,'other_deductions_count'=>count($otherDeductions)],$u['id']);
    reply(['ok'=>true,'message'=>'Profil gaji staf berjaya disimpan.']);
}
if($method==='POST' && $action==='admin_payroll_run_process') {
    ensureHrTables();
    $yearMonth=trim((string)($b['year_month']??date('Y-m')));
    if(!preg_match('/^\d{4}-\d{2}$/',$yearMonth))fail(422,'Format bulan tidak sah (YYYY-MM).');

    $settings=query('SELECT * FROM hub_hr_settings WHERE id=1')->fetch();
    $payDay=str_pad((string)($settings['pay_day']??27),2,'0',STR_PAD_LEFT);
    $payDate=$yearMonth.'-'.$payDay;
    $cutStart=$yearMonth.'-01';
    $lastDay=date('t',strtotime($cutStart));
    $cutEnd=$yearMonth.'-'.$lastDay;

    $users=query("SELECT * FROM hub_users WHERE role IN ('admin','teacher') AND active=1")->fetchAll();
    if(empty($users))fail(422,'Tiada staf guru atau admin aktif untuk diproses.');

    $pdo->beginTransaction();
    // Unmark claims already linked to this month so re-running payroll preserves medical claim reimbursements
    query('UPDATE hub_medical_claims SET paid_via_payroll=0, payroll_month=NULL WHERE payroll_month=?',[$yearMonth]);
    query('DELETE FROM hub_payslips WHERE `year_month`=?',[$yearMonth]);
    query('DELETE FROM hub_payroll_runs WHERE `year_month`=?',[$yearMonth]);

    $runId=uid();
    $totBasic=0.0;$totAllow=0.0;$totClaims=0.0;$totGross=0.0;
    $totEpfEe=0.0;$totEpfEr=0.0;$totSocsoEe=0.0;$totSocsoEr=0.0;
    $totEisEe=0.0;$totEisEr=0.0;$totPcb=0.0;$totOtherDed=0.0;$totNet=0.0;

    foreach($users as $usr){
        $prof=query('SELECT * FROM hub_staff_payroll_profiles WHERE user_id=?',[$usr['id']])->fetch();
        $basic=$prof?(float)$prof['basic_salary']:0.00;
        $allowance=$prof?(float)$prof['fixed_allowance']:0.00;
        $epfEeRate=$prof?(float)$prof['epf_employee_rate']:11.00;
        $epfErRate=$prof?(float)$prof['epf_employer_rate']:13.00;
        $socsoCat=$prof?$prof['socso_category']:'cat1';
        $eisActive=$prof?(bool)(int)$prof['eis_active']:true;
        $skbbkActive=($prof&&array_key_exists('skbbk_active',$prof))?(bool)(int)$prof['skbbk_active']:true;
        $pcb=$prof?(float)$prof['monthly_pcb']:0.00;

        $rawOther=json_decode((string)($prof['other_deductions_json']??'[]'),true);
        $otherItems=[];$otherDedSum=0.0;
        if(is_array($rawOther)){
            foreach($rawOther as $od){
                $desc=trim((string)($od['description']??''));
                $amt=round((float)($od['amount']??0),2);
                if($desc!=='' && $amt>0){
                    $otherItems[]=['description'=>$desc,'amount'=>$amt];
                    $otherDedSum=round($otherDedSum+$amt,2);
                }
            }
        }

        // Approved claims not yet paid (or previously paid in this month)
        $approvedClaims=query("SELECT id, user_id, user_name, year, treatment_date, clinic_name, amount, notes, status FROM hub_medical_claims WHERE user_id=? AND status='Approved' AND paid_via_payroll=0",[$usr['id']])->fetchAll();
        $claimSum=0.0;
        foreach($approvedClaims as $cl){$claimSum+=(float)$cl['amount'];}

        $calc=calculateStatutoryContributions($basic,$allowance,$epfEeRate,$epfErRate,$socsoCat,$eisActive,$skbbkActive);
        $gross=$calc['gross'];
        $totDeductions=round($calc['epf_employee']+$calc['socso_employee']+$calc['eis_employee']+$pcb+$otherDedSum,2);
        $net=round(($gross+$claimSum)-$totDeductions,2);

        $slipDetails=[
            'user'=>publicUser($usr),
            'profile'=>$prof?:[],
            'claims'=>$approvedClaims,
            'other_deductions'=>$otherItems,
            'calculation'=>$calc,
            'net'=>$net
        ];

        $slipId=uid();
        query('INSERT INTO hub_payslips(id,run_id,user_id,user_name,user_role,`year_month`,pay_date,basic_salary,fixed_allowance,medical_claims,other_earnings,gross_salary,epf_employee,epf_employer,socso_employee,socso_employer,eis_employee,eis_employer,pcb_amount,other_deductions,total_deductions,net_salary,details_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [$slipId,$runId,$usr['id'],$usr['name'],$usr['role'],$yearMonth,$payDate,$basic,$allowance,$claimSum,0.00,$gross,$calc['epf_employee'],$calc['epf_employer'],$calc['socso_employee'],$calc['socso_employer'],$calc['eis_employee'],$calc['eis_employer'],$pcb,$otherDedSum,$totDeductions,$net,json_encode($slipDetails,JSON_UNESCAPED_UNICODE),$cutEnd.'T00:00:00+08:00']);

        // Mark claims as paid via payroll
        foreach($approvedClaims as $cl){
            query('UPDATE hub_medical_claims SET paid_via_payroll=1,payroll_month=?,updated_at=? WHERE id=?',[$yearMonth,stamp(),$cl['id']]);
        }

        $totBasic+=$basic;$totAllow+=$allowance;$totClaims+=$claimSum;$totGross+=$gross;
        $totEpfEe+=$calc['epf_employee'];$totEpfEr+=$calc['epf_employer'];
        $totSocsoEe+=$calc['socso_employee'];$totSocsoEr+=$calc['socso_employer'];
        $totEisEe+=$calc['eis_employee'];$totEisEr+=$calc['eis_employer'];
        $totPcb+=$pcb;$totOtherDed+=$otherDedSum;$totNet+=$net;
    }

    query('INSERT INTO hub_payroll_runs(id,`year_month`,cutoff_start,cutoff_end,pay_date,total_basic,total_allowance,total_claims,total_gross,total_epf_employee,total_epf_employer,total_socso_employee,total_socso_employer,total_eis_employee,total_eis_employer,total_pcb,total_other_deductions,total_net,status,processed_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [$runId,$yearMonth,$cutStart,$cutEnd,$payDate,$totBasic,$totAllow,$totClaims,$totGross,$totEpfEe,$totEpfEr,$totSocsoEe,$totSocsoEr,$totEisEe,$totEisEr,$totPcb,$totOtherDed,$totNet,'Approved',$u['id'],stamp(),stamp()]);

    audit('admin_payroll_run_process',['year_month'=>$yearMonth,'total_net'=>$totNet,'total_other_deductions'=>$totOtherDed],$u['id']);
    $pdo->commit();
    reply(['ok'=>true,'runId'=>$runId,'message'=>'Penggajian bulan '.$yearMonth.' berjaya diproses dan slip gaji digital telah dijana.']);
}
if($method==='GET' && $action==='admin_payroll_export_kwsp') {
    ensureHrTables();
    $yearMonth=trim((string)($_GET['year_month']??date('Y-m')));
    $settings=query('SELECT * FROM hub_hr_settings WHERE id=1')->fetch();
    $slips=query('SELECT p.*, prof.ic_no, prof.epf_no FROM hub_payslips p LEFT JOIN hub_staff_payroll_profiles prof ON p.user_id = prof.user_id WHERE p.`year_month`=?',[$yearMonth])->fetchAll();
    if(empty($slips))fail(404,'Tiada rekod gaji bagi bulan '.$yearMonth.'. Sila proses penggajian dahulu.');

    $epfEmployerNo=str_pad(preg_replace('/[^0-9]/','',$settings['epf_employer_no']??'12345678'),8,'0',STR_PAD_LEFT);
    $employerName=strtoupper(substr($settings['center_name']??'BERUNTUNG BRAINIAC',0,40));
    $mY=date('mY',strtotime($yearMonth.'-01'));

    $totEe=0;$totEr=0;$totWages=0;
    $detailRows=[];
    foreach($slips as $s){
        $ic=preg_replace('/[^0-9]/','',$s['ic_no']??'');
        $epfMember=preg_replace('/[^0-9]/','',$s['epf_no']??'');
        $name=strtoupper(substr($s['user_name'],0,40));
        $wage=(float)$s['gross_salary'];
        $ee=(float)$s['epf_employee'];
        $er=(float)$s['epf_employer'];
        $totWages+=$wage;$totEe+=$ee;$totEr+=$er;
        // Standard KWSP Borang A CSV layout
        $detailRows[]=[$ic,$epfMember,$name,number_format($wage,2,'.',''),number_format($er,2,'.',''),number_format($ee,2,'.','')];
    }

    $cell=fn($v)=>'"'.str_replace('"','""',$v).'"';
    $out="\uFEFF";
    $out.="BORANG A - KWSP (i-Akaun Upload File)\r\n";
    $out.="NO MAJIKAN:,".$cell($epfEmployerNo).",NAMA MAJIKAN:,".$cell($employerName).",BULAN CARUMAN:,".$cell($mY)."\r\n";
    $out.="JUMLAH PEKERJA:,".count($slips).",JUMLAH UPAH:,".number_format($totWages,2,'.','').",JUMLAH CARUMAN MAJIKAN:,".number_format($totEr,2,'.','').",JUMLAH CARUMAN PEKERJA:,".number_format($totEe,2,'.','').",JUMLAH BESAR:,".number_format($totEr+$totEe,2,'.','')."\r\n\r\n";
    $out.="NO KAD PENGENALAN,NO AHLI KWSP,NAMA PEKERJA,JUMLAH UPAH (RM),CARUMAN MAJIKAN (RM),CARUMAN PEKERJA (RM)\r\n";
    foreach($detailRows as $r){
        $out.=implode(',',array_map($cell,$r))."\r\n";
    }

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="KWSP_BorangA_'.$epfEmployerNo.'_'.$mY.'.csv"');
    echo $out;
    exit;
}

// User accounts management
if($method==='GET' && $action==='users') reply(['users'=>array_map('publicUser',query('SELECT * FROM hub_users ORDER BY name')->fetchAll())]);
if($method==='POST' && $action==='users') {
    [$email,$name,$role]=identity($b);$id=$b['id']??'';$active=($b['active']??true)?1:0;
    $newPassword=(string)($b['password']??'');$hash=$newPassword!==''?password($newPassword):null;
    $pdo->beginTransaction();query('SELECT id FROM hub_state WHERE id=1'.lockSuffix())->fetch();
    if(query('SELECT id FROM hub_users WHERE email=? AND id<>?',[$email,$id])->fetch()){$pdo->rollBack();fail(422,'Emel sudah digunakan.');}
    if($id){
        $old=query('SELECT * FROM hub_users WHERE id=?',[$id])->fetch();if(!$old){$pdo->rollBack();fail(404,'Pengguna tidak ditemui.');}
        if($old['role']==='admin'&&(int)$old['active']&&($role!=='admin'||!$active)&&(int)query("SELECT COUNT(*) FROM hub_users WHERE role='admin' AND active=1")->fetchColumn()<=1){$pdo->rollBack();fail(422,'Sekurang-kurangnya seorang Admin aktif diperlukan.');}
        if($id===$u['id']&&($role!=='admin'||!$active||$hash)){$pdo->rollBack();fail(422,'Gunakan Tukar kata laluan untuk akaun sendiri. Admin lain boleh menukar peranan anda.');}
        query('UPDATE hub_users SET email=?,name=?,role=?,active=?,password_hash=?,must_change=?,version=version+1 WHERE id=?',[$email,$name,$role,$active,$hash??$old['password_hash'],$hash?1:$old['must_change'],$id]);
        if($id===$u['id'])$_SESSION['version']=(int)$u['version']+1;
    }else{
        if(!$hash){$pdo->rollBack();fail(422,'Kata laluan sementara diperlukan.');}
        $id=uid();query('INSERT INTO hub_users(id,email,name,role,password_hash,active,must_change,created_at) VALUES(?,?,?,?,?,?,1,?)',[$id,$email,$name,$role,$hash,$active,stamp()]);
    }
    audit('user_updated',['id'=>$id,'role'=>$role,'active'=>$active,'password_reset'=>(bool)$hash]);$pdo->commit();reply(['ok'=>true]);
}

// Full Database Backup (Admin only)
$backupTables=[
    'hub_users','hub_state','hub_audit','hub_rate','hub_writes',
    'hub_hr_settings','hub_staff_attendance','hub_leave_balances','hub_staff_leaves',
    'hub_medical_allowance_balances','hub_medical_claims',
    'hub_staff_payroll_profiles','hub_payroll_runs','hub_payslips'
];
if($method==='GET' && $action==='admin_backup_summary') {
    ensureHrTables();
    $counts=[];$totalRows=0;
    foreach($backupTables as $tbl){
        $c=(int)query('SELECT COUNT(*) FROM `'.$tbl.'`')->fetchColumn();
        $counts[$tbl]=$c;$totalRows+=$c;
    }
    $stateRow=query('SELECT revision FROM hub_state WHERE id=1')->fetch();
    $my=malaysiaNow();
    reply([
        'generated_at'=>$my['iso'],
        'state_revision'=>$stateRow?(int)$stateRow['revision']:0,
        'total_tables'=>count($backupTables),
        'total_rows'=>$totalRows,
        'counts'=>$counts
    ]);
}
if($method==='POST' && $action==='admin_backup_export') {
    limit('backup:'.$u['id'],20);
    ensureHrTables();
    $format=strtolower(trim((string)($b['format']??'sql')));
    if(!in_array($format,['sql','json'],true))fail(422,'Format sandaran tidak sah. Pilih sql atau json.');
    if(function_exists('set_time_limit'))@set_time_limit(120);
    $my=malaysiaNow();
    try{$tz=new DateTimeZone('Asia/Kuala_Lumpur');$fileStamp=(new DateTimeImmutable('now',$tz))->format('Ymd_His');}catch(Throwable){$fileStamp=gmdate('Ymd_His');}
    audit('admin_backup_export',['format'=>$format,'tables'=>count($backupTables)],$u['id']);
    for($lvl=ob_get_level();$lvl>0;$lvl--){if(!@ob_end_clean())break;}
    header('X-Content-Type-Options: nosniff');
    $qId=fn(string $id): string => '`'.str_replace('`','``',$id).'`';
    if($format==='json'){
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="BrainiacHub_Backup_'.$fileStamp.'.json"');
        $meta=[
            'app'=>'Brainiac Hub',
            'exported_at'=>$my['iso'],
            'timezone'=>'Asia/Kuala_Lumpur',
            'exported_by'=>['id'=>$u['id'],'name'=>$u['name'],'email'=>$u['email']],
            'note'=>'Untuk pemulihan penuh termasuk kata laluan log masuk, gunakan fail sandaran .sql di phpMyAdmin.',
            'tables'=>$backupTables
        ];
        echo "{\n\"meta\": ".json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR).",\n\"tables\": {\n";
        $tTotal=count($backupTables);
        foreach($backupTables as $tIdx=>$tbl){
            echo json_encode($tbl,JSON_THROW_ON_ERROR).": [\n";
            $stmt=query('SELECT * FROM '.$qId($tbl));
            $first=true;
            while($row=$stmt->fetch(PDO::FETCH_ASSOC)){
                if($tbl==='hub_users'&&array_key_exists('password_hash',$row))$row['password_hash']='[REDACTED]';
                if(!$first)echo ",\n";
                echo json_encode($row,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
                $first=false;
            }
            $stmt->closeCursor();
            echo "\n]".($tIdx<$tTotal-1?",\n":"\n");
        }
        echo "}\n}\n";
        exit;
    }
    $driver=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    header('Content-Type: application/sql; charset=utf-8');
    header('Content-Disposition: attachment; filename="BrainiacHub_Backup_'.$fileStamp.'.sql"');
    echo "-- Brainiac Hub Full Database Backup\n";
    echo "-- Generated: ".$my['iso']." (Asia/Kuala_Lumpur)\n";
    echo "-- Exported by: ".str_replace(["\r","\n"],' ',$u['name'])." <".str_replace(["\r","\n"],' ',$u['email']).">\n";
    echo "-- Driver: ".$driver."\n\n";
    if($driver==='mysql'){
        echo "SET NAMES utf8mb4;\n";
        echo "SET FOREIGN_KEY_CHECKS = 0;\n";
        echo "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n\n";
    }
    $qVal=function($val) use ($pdo): string {
        if($val===null)return 'NULL';
        if(is_int($val)||is_float($val))return (string)$val;
        return $pdo->quote((string)$val);
    };
    foreach($backupTables as $tbl){
        echo "-- --------------------------------------------------------\n";
        echo "-- Table: ".$tbl."\n";
        echo "-- --------------------------------------------------------\n";
        if($driver==='mysql'){
            $createRow=query('SHOW CREATE TABLE '.$qId($tbl))->fetch(PDO::FETCH_NUM);
            if($createRow&&isset($createRow[1])){
                echo "DROP TABLE IF EXISTS ".$qId($tbl).";\n";
                echo $createRow[1].";\n\n";
            }
        }else{
            $createSql=query("SELECT sql FROM sqlite_master WHERE type='table' AND name=?",[$tbl])->fetchColumn();
            if($createSql){
                echo "DROP TABLE IF EXISTS ".$qId($tbl).";\n";
                echo $createSql.";\n\n";
            }
        }
        $stmt=query('SELECT * FROM '.$qId($tbl));
        $cols=null;$batch=[];$batchBytes=0;
        $flushBatch=function() use (&$batch,&$batchBytes,&$cols,$tbl,$qId): void {
            if(!$batch)return;
            echo "INSERT INTO ".$qId($tbl)." (".implode(', ',array_map($qId,$cols)).") VALUES\n".implode(",\n",$batch).";\n";
            $batch=[];$batchBytes=0;
        };
        while($row=$stmt->fetch(PDO::FETCH_ASSOC)){
            if($cols===null)$cols=array_keys($row);
            $vals=[];
            foreach($cols as $col)$vals[]=$qVal($row[$col]);
            $tuple='('.implode(', ',$vals).')';
            if($batch&&($batchBytes+strlen($tuple)>524288||count($batch)>=50))$flushBatch();
            $batch[]=$tuple;
            $batchBytes+=strlen($tuple);
        }
        $stmt->closeCursor();
        $flushBatch();
        echo "\n";
    }
    if($driver==='mysql')echo "SET FOREIGN_KEY_CHECKS = 1;\n";
    exit;
}

fail(404,'Tindakan tidak ditemui.');
