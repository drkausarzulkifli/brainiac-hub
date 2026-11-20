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
if($u['role']!=='admin')fail(403,'Akses Admin diperlukan.');
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
fail(404,'Tindakan tidak ditemui.');
