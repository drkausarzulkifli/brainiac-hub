<?php
// Copy to config.php OUTSIDE public_html. Never upload credentials inside public_html.
return [
    'dsn' => 'mysql:host=localhost;port=3306;dbname=YOUR_DATABASE;charset=utf8mb4',
    'db_user' => 'YOUR_DATABASE_USER',
    'db_password' => 'YOUR_DATABASE_PASSWORD',
    'origin' => 'https://brainiachub.io',
    // Choose a random secret of at least 32 characters. Used ONLY for initial admin setup.
    'setup_token' => 'REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS',
    'allow_http_local' => false,
];
