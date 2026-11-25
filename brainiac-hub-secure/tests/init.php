<?php
// Local test database only. Never include this configuration in a deployment archive.
$file=__DIR__.'/test.sqlite';if(is_file($file))unlink($file);
$pdo=new PDO('sqlite:'.$file);$sql=file_get_contents(__DIR__.'/../brainiac-private/schema.sql');
$sql=str_replace(' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4','',$sql);
$sql=preg_replace('/UNIQUE KEY\s+\w+\s*\(/i','UNIQUE (',$sql);
$sql=str_replace('INSERT IGNORE','INSERT OR IGNORE',$sql);$pdo->exec($sql);
$config=['dsn'=>'sqlite:'.$file,'db_user'=>'','db_password'=>'','origin'=>'http://127.0.0.1:8789','setup_token'=>'local-test-only-'.str_repeat('x',40),'allow_http_local'=>true];
file_put_contents(__DIR__.'/../brainiac-private/config.php',"<?php\nreturn ".var_export($config,true).";\n");
echo "Local SQLite fixture initialized (not production).\n";
