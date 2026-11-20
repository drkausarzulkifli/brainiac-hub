CREATE TABLE IF NOT EXISTS hub_users (
 id VARCHAR(36) PRIMARY KEY, email VARCHAR(190) NOT NULL UNIQUE,
 name VARCHAR(120) NOT NULL, role VARCHAR(16) NOT NULL,
 password_hash VARCHAR(255) NOT NULL, active INT NOT NULL DEFAULT 1,
 must_change INT NOT NULL DEFAULT 0, version INT NOT NULL DEFAULT 1,
 created_at VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS hub_state (
 id INT PRIMARY KEY, revision INT NOT NULL DEFAULT 0, payload LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO hub_state(id,revision,payload) VALUES (1,0,'{"sessions":[],"plans":[],"enquiries":[],"studentProfiles":[],"staffProfiles":[],"datedBookings":[],"weeklyBookings":[],"classNotes":[],"assessments":[],"therapyNotes":[],"progressReports":[]}');
CREATE TABLE IF NOT EXISTS hub_audit (
 id VARCHAR(36) PRIMARY KEY, actor VARCHAR(36), action VARCHAR(40) NOT NULL,
 metadata TEXT NOT NULL, created_at VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS hub_rate (
 bucket VARCHAR(64) PRIMARY KEY, attempts INT NOT NULL, expires BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS hub_writes (
 id VARCHAR(64) PRIMARY KEY, actor VARCHAR(36) NOT NULL,
 digest VARCHAR(64) NOT NULL, revision INT NOT NULL, created_at VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
