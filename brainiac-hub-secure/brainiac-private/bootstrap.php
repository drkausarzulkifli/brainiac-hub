<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Cache-Control: no-store, private, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: DENY');
function fail(int $status, string $message): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error'=>$message], JSON_UNESCAPED_UNICODE); exit;
}
set_exception_handler(function(Throwable $e): void {
    if (isset($GLOBALS['pdo']) && $GLOBALS['pdo']->inTransaction()) $GLOBALS['pdo']->rollBack();
    error_log('Brainiac Hub: '.get_class($e));
    fail(503, 'Server belum tersedia. Semak konfigurasi pangkalan data atau cuba semula.');
});
$configPath = __DIR__.'/config.php';
if (!is_file($configPath)) fail(503, 'Pemasangan belum lengkap. Pentadbir perlu menyediakan konfigurasi pangkalan data.');
$config = require $configPath;
$local = ($config['allow_http_local'] ?? false) && in_array($_SERVER['REMOTE_ADDR']??'', ['127.0.0.1','::1'], true);
if (!$local && (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS']==='off')) fail(400, 'Sambungan HTTPS diperlukan.');
if (!$local) header('Strict-Transport-Security: max-age=31536000');
ini_set('session.use_strict_mode','1');
ini_set('session.use_only_cookies','1');
ini_set('session.gc_maxlifetime','28800');
session_name('brainiac_session');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>!$local,'httponly'=>true,'samesite'=>'Strict']);
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
$pdo = new PDO($config['dsn'], $config['db_user'], $config['db_password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
function query(string $sql, array $args=[]): PDOStatement { global $pdo; $q=$pdo->prepare($sql);$q->execute($args);return $q; }
function lockSuffix(): string {global $pdo;return $pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql'?' FOR UPDATE':'';}
function stamp(): string {return gmdate('Y-m-d\TH:i:s\Z');}
function uid(): string {return bin2hex(random_bytes(16));}
function audit(string $action, array $meta=[], ?string $actor=null): void {
    query('INSERT INTO hub_audit(id,actor,action,metadata,created_at) VALUES(?,?,?,?,?)',[uid(),$actor??($_SESSION['uid']??null),$action,json_encode($meta,JSON_THROW_ON_ERROR),stamp()]);
}
function body(): array {
    if (!str_starts_with($_SERVER['CONTENT_TYPE']??'', 'application/json')) fail(415,'Permintaan JSON diperlukan.');
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>12582912) fail(413,'Rekod terlalu besar.');
    $raw=file_get_contents('php://input',false,null,0,12582913);
    if (strlen($raw)>12582912) fail(413,'Rekod terlalu besar.');
    try {$value=json_decode($raw,true,64,JSON_THROW_ON_ERROR);} catch(Throwable) {fail(400,'Permintaan tidak sah.');}
    if(!is_array($value)) fail(400,'Permintaan tidak sah.');return $value;
}
function csrf(): void {global $config;
    $origin=$_SERVER['HTTP_ORIGIN']??'';
    if($origin!=='' && !hash_equals(rtrim($config['origin'],'/'),$origin)) fail(403,'Asal permintaan tidak dibenarkan.');
    if(!hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??'')) fail(403,'Sesi borang tamat. Muat semula halaman.');
}
function user(bool $required=true): ?array {
    $u=isset($_SESSION['uid'])?query('SELECT * FROM hub_users WHERE id=?',[$_SESSION['uid']])->fetch():false;
    if(!$u || !(int)$u['active'] || (int)$u['version']!==($_SESSION['version']??0) || time()-($_SESSION['seen']??0)>1800 || time()-($_SESSION['started']??0)>28800){
        unset($_SESSION['uid'],$_SESSION['version']);if($required)fail(401,'Sesi tamat. Log masuk semula.');return null;
    }
    $_SESSION['seen']=time();return $u;
}
function publicUser(array $u): array {return array_intersect_key($u,array_flip(['id','email','name','role','active','must_change','version']));}
function password(string $value): string {
    if(strlen($value)<12 || strlen($value)>72)fail(422,'Kata laluan mesti 12 hingga 72 bait.');
    return password_hash($value,PASSWORD_DEFAULT);
}
function identity(array $b): array {
    $email=strtolower(trim((string)($b['email']??'')));$name=trim((string)($b['name']??''));$role=$b['role']??'';
    if(!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($email)>190||$name===''||strlen($name)>120||!in_array($role,['admin','teacher','therapist'],true))fail(422,'Semak nama, emel dan peranan.');
    return [$email,$name,$role];
}
function limit(string $scope,int $max): void {
    $now=time();$bucket=hash('sha256',$scope.':'.intdiv($now,900));
    try{query('INSERT INTO hub_rate(bucket,attempts,expires) VALUES(?,0,?)',[$bucket,$now+1800]);}catch(PDOException $e){if(!in_array((string)$e->getCode(),['23000','23505']))throw $e;}
    query('UPDATE hub_rate SET attempts=attempts+1 WHERE bucket=?',[$bucket]);
    if((int)query('SELECT attempts FROM hub_rate WHERE bucket=?',[$bucket])->fetchColumn()>$max) {header('Retry-After: 900');fail(429,'Terlalu banyak percubaan. Cuba lagi selepas 15 minit.');}
    query('DELETE FROM hub_rate WHERE expires<?',[$now]);
}
function reply(array $value): never {header('Content-Type: application/json; charset=utf-8');echo json_encode($value,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
function ensureAttendanceTable(): void { ensureHrTables(); }
function ensureHrTables(): void {
    global $pdo;static $checked=false;if($checked)return;$checked=true;
    $driver=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME);$engine=$driver==='mysql'?' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4':'';
    $run=function(string $sql) use ($pdo): void {
        try{$pdo->exec($sql);}catch(Throwable $e){error_log('Brainiac ensureHrTables: '.$e->getMessage());}
    };
    $run("CREATE TABLE IF NOT EXISTS hub_hr_settings (
        id INT PRIMARY KEY,
        center_name VARCHAR(120) NOT NULL DEFAULT 'Beruntung Brainiac',
        center_ssm VARCHAR(50) NOT NULL DEFAULT '202503030392 (003694359-M)',
        epf_employer_no VARCHAR(50) DEFAULT '',
        socso_employer_no VARCHAR(50) DEFAULT '',
        latitude DECIMAL(10,8) NOT NULL DEFAULT 3.36965100,
        longitude DECIMAL(11,8) NOT NULL DEFAULT 101.57162700,
        geofence_radius_meters INT NOT NULL DEFAULT 100,
        shift_hours DECIMAL(4,2) NOT NULL DEFAULT 8.50,
        pay_day INT NOT NULL DEFAULT 27,
        updated_at VARCHAR(30) NOT NULL
    )$engine;");
    $run("INSERT ".($driver==='mysql'?'IGNORE':'OR IGNORE')." INTO hub_hr_settings (id, center_name, center_ssm, epf_employer_no, socso_employer_no, latitude, longitude, geofence_radius_meters, shift_hours, pay_day, updated_at) VALUES (1, 'Beruntung Brainiac', '202503030392 (003694359-M)', '', '', 3.36965100, 101.57162700, 100, 8.50, 27, '".stamp()."');");
    $run("UPDATE hub_hr_settings SET latitude=3.36965100, longitude=101.57162700 WHERE id=1 AND ABS(latitude-3.139003)<0.0001 AND ABS(longitude-101.686855)<0.0001;");

    $run("CREATE TABLE IF NOT EXISTS hub_staff_attendance (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        user_name VARCHAR(120) NOT NULL,
        user_role VARCHAR(16) NOT NULL,
        work_date VARCHAR(10) NOT NULL,
        clock_in VARCHAR(30) NOT NULL,
        clock_out VARCHAR(30) DEFAULT NULL,
        duration_minutes INT DEFAULT 0,
        latitude DECIMAL(10,8) DEFAULT NULL,
        longitude DECIMAL(11,8) DEFAULT NULL,
        distance_meters INT DEFAULT 0,
        device_type VARCHAR(30) DEFAULT 'Mobile',
        work_location VARCHAR(50) DEFAULT 'Pusat',
        status VARCHAR(30) DEFAULT 'Tepat masa',
        adjustment_reason TEXT DEFAULT NULL,
        note TEXT DEFAULT NULL,
        created_at VARCHAR(30) NOT NULL,
        updated_at VARCHAR(30) NOT NULL
    )$engine;");

    $run("CREATE TABLE IF NOT EXISTS hub_leave_balances (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        year INT NOT NULL,
        annual_total DECIMAL(4,1) NOT NULL DEFAULT 12.0,
        annual_used DECIMAL(4,1) NOT NULL DEFAULT 0.0,
        annual_carry_forward DECIMAL(4,1) NOT NULL DEFAULT 0.0,
        carry_forward_max DECIMAL(4,1) NOT NULL DEFAULT 5.0,
        medical_total DECIMAL(4,1) NOT NULL DEFAULT 14.0,
        medical_used DECIMAL(4,1) NOT NULL DEFAULT 0.0,
        hospitalisation_total DECIMAL(4,1) NOT NULL DEFAULT 60.0,
        hospitalisation_used DECIMAL(4,1) NOT NULL DEFAULT 0.0,
        maternity_total DECIMAL(4,1) NOT NULL DEFAULT 98.0,
        maternity_used DECIMAL(4,1) NOT NULL DEFAULT 0.0,
        created_at VARCHAR(30) NOT NULL,
        updated_at VARCHAR(30) NOT NULL
    )$engine;");

    $run("CREATE TABLE IF NOT EXISTS hub_staff_leaves (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        user_name VARCHAR(120) NOT NULL,
        leave_type VARCHAR(30) NOT NULL,
        start_date VARCHAR(10) NOT NULL,
        end_date VARCHAR(10) NOT NULL,
        days_count DECIMAL(4,1) NOT NULL,
        reason TEXT NOT NULL,
        attachment_url LONGTEXT DEFAULT NULL,
        attachment_name VARCHAR(255) DEFAULT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Pending',
        admin_notes TEXT DEFAULT NULL,
        reviewed_by VARCHAR(36) DEFAULT NULL,
        reviewed_at VARCHAR(30) DEFAULT NULL,
        created_at VARCHAR(30) NOT NULL,
        updated_at VARCHAR(30) NOT NULL
    )$engine;");

    $run("CREATE TABLE IF NOT EXISTS hub_medical_allowance_balances (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        year INT NOT NULL,
        annual_limit DECIMAL(10,2) NOT NULL DEFAULT 500.00,
        amount_used DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        balance DECIMAL(10,2) NOT NULL DEFAULT 500.00,
        created_at VARCHAR(30) NOT NULL,
        updated_at VARCHAR(30) NOT NULL
    )$engine;");

    $run("CREATE TABLE IF NOT EXISTS hub_medical_claims (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        user_name VARCHAR(120) NOT NULL,
        year INT NOT NULL,
        treatment_date VARCHAR(10) NOT NULL,
        clinic_name VARCHAR(150) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        receipt_url LONGTEXT NOT NULL,
        receipt_name VARCHAR(255) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Pending',
        admin_notes TEXT DEFAULT NULL,
        payroll_month VARCHAR(7) DEFAULT NULL,
        paid_via_payroll INT NOT NULL DEFAULT 0,
        reviewed_by VARCHAR(36) DEFAULT NULL,
        reviewed_at VARCHAR(30) DEFAULT NULL,
        created_at VARCHAR(30) NOT NULL,
        updated_at VARCHAR(30) NOT NULL
    )$engine;");

    $run("CREATE TABLE IF NOT EXISTS hub_staff_payroll_profiles (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        ic_no VARCHAR(20) NOT NULL DEFAULT '',
        epf_no VARCHAR(30) NOT NULL DEFAULT '',
        socso_no VARCHAR(30) NOT NULL DEFAULT '',
        income_tax_no VARCHAR(30) NOT NULL DEFAULT '',
        bank_name VARCHAR(60) NOT NULL DEFAULT '',
        bank_acc_no VARCHAR(40) NOT NULL DEFAULT '',
        basic_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        fixed_allowance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        epf_employee_rate DECIMAL(4,2) NOT NULL DEFAULT 11.00,
        epf_employer_rate DECIMAL(4,2) NOT NULL DEFAULT 13.00,
        socso_category VARCHAR(10) NOT NULL DEFAULT 'cat1',
        eis_active INT NOT NULL DEFAULT 1,
        monthly_pcb DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        other_deductions_json LONGTEXT DEFAULT NULL,
        created_at VARCHAR(30) NOT NULL,
        updated_at VARCHAR(30) NOT NULL
    )$engine;");

    $run("CREATE TABLE IF NOT EXISTS hub_payroll_runs (
        id VARCHAR(36) PRIMARY KEY,
        `year_month` VARCHAR(7) NOT NULL,
        cutoff_start VARCHAR(10) NOT NULL,
        cutoff_end VARCHAR(10) NOT NULL,
        pay_date VARCHAR(10) NOT NULL,
        total_basic DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_allowance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_claims DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_gross DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_epf_employee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_epf_employer DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_socso_employee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_socso_employer DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_eis_employee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_eis_employer DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_pcb DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_other_deductions DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_net DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(20) NOT NULL DEFAULT 'Draft',
        processed_by VARCHAR(36) NOT NULL,
        created_at VARCHAR(30) NOT NULL,
        updated_at VARCHAR(30) NOT NULL
    )$engine;");

    $run("CREATE TABLE IF NOT EXISTS hub_payslips (
        id VARCHAR(36) PRIMARY KEY,
        run_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        user_name VARCHAR(120) NOT NULL,
        user_role VARCHAR(16) NOT NULL,
        `year_month` VARCHAR(7) NOT NULL,
        pay_date VARCHAR(10) NOT NULL,
        basic_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        fixed_allowance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        medical_claims DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        other_earnings DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        gross_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        epf_employee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        epf_employer DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        socso_employee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        socso_employer DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        eis_employee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        eis_employer DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        pcb_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        other_deductions DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_deductions DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        net_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        details_json LONGTEXT NOT NULL,
        created_at VARCHAR(30) NOT NULL
    )$engine;");

    $hasCol=function(string $table, string $col) use ($pdo, $driver): bool {
        try{
            if($driver==='mysql'){
                $rows=$pdo->query("SHOW COLUMNS FROM `{$table}`")->fetchAll();
                foreach($rows as $r){if(strcasecmp((string)($r['Field']??''),$col)===0)return true;}
                return false;
            }
            $rows=$pdo->query("PRAGMA table_info(`{$table}`)")->fetchAll();
            foreach($rows as $r){if(strcasecmp((string)($r['name']??''),$col)===0)return true;}
            return false;
        }catch(Throwable){return false;}
    };
    if(!$hasCol('hub_staff_payroll_profiles','other_deductions_json')){
        $run('ALTER TABLE hub_staff_payroll_profiles ADD COLUMN other_deductions_json LONGTEXT DEFAULT NULL');
    }
    if(!$hasCol('hub_payroll_runs','total_other_deductions')){
        $run('ALTER TABLE hub_payroll_runs ADD COLUMN total_other_deductions DECIMAL(12,2) NOT NULL DEFAULT 0.00');
    }
    if(!$hasCol('hub_payslips','other_deductions')){
        $run('ALTER TABLE hub_payslips ADD COLUMN other_deductions DECIMAL(10,2) NOT NULL DEFAULT 0.00');
    }
}
function haversineDistanceMeters(float $lat1, float $lon1, float $lat2, float $lon2): int {
    $earthRadius=6371000;
    $dLat=deg2rad($lat2-$lat1);$dLon=deg2rad($lon2-$lon1);
    $a=sin($dLat/2)*sin($dLat/2)+cos(deg2rad($lat1))*cos(deg2rad($lat2))*sin($dLon/2)*sin($dLon/2);
    $c=2*atan2(sqrt($a),sqrt(1-$a));
    return (int)round($earthRadius*$c);
}
function calculateStatutoryContributions(float $basic, float $allowance, float $epfEeRate=11.0, float $epfErRate=13.0, string $socsoCat='cat1', bool $eisActive=true): array {
    $gross=$basic+$allowance;
    $actualEpfErRate=($gross>5000&&$epfErRate==13.0)?12.0:$epfErRate;
    $epfEe=round($gross*($epfEeRate/100),2);
    $epfEr=round($gross*($actualEpfErRate/100),2);
    $socsoBase=min($gross,6000.0);
    $socsoEe=($socsoCat==='cat1')?round($socsoBase*0.005,2):0.0;
    $socsoEr=($socsoCat==='cat1')?round($socsoBase*0.0175,2):round($socsoBase*0.0125,2);
    $eisBase=min($gross,6000.0);
    $eisEe=$eisActive?round($eisBase*0.002,2):0.0;
    $eisEr=$eisActive?round($eisBase*0.002,2):0.0;
    return ['gross'=>$gross,'epf_employee'=>$epfEe,'epf_employer'=>$epfEr,'socso_employee'=>$socsoEe,'socso_employer'=>$socsoEr,'eis_employee'=>$eisEe,'eis_employer'=>$eisEr];
}
function malaysiaNow(): array {
    try{$tz=new DateTimeZone('Asia/Kuala_Lumpur');$dt=new DateTimeImmutable('now',$tz);}catch(Throwable){$dt=new DateTimeImmutable('now +8 hours');}
    return ['date'=>$dt->format('Y-m-d'),'time'=>$dt->format('H:i'),'iso'=>$dt->format('c')];
}
