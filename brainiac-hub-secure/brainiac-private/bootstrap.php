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
