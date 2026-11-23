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

CREATE TABLE IF NOT EXISTS hub_hr_settings (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO hub_hr_settings (id, center_name, center_ssm, epf_employer_no, socso_employer_no, latitude, longitude, geofence_radius_meters, shift_hours, pay_day, updated_at)
VALUES (1, 'Beruntung Brainiac', '202503030392 (003694359-M)', '', '', 3.36965100, 101.57162700, 100, 8.50, 27, '2026-11-19T00:00:00Z');

CREATE TABLE IF NOT EXISTS hub_staff_attendance (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hub_leave_balances (
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
 updated_at VARCHAR(30) NOT NULL,
 UNIQUE KEY uq_user_year (user_id, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hub_staff_leaves (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hub_medical_allowance_balances (
 id VARCHAR(36) PRIMARY KEY,
 user_id VARCHAR(36) NOT NULL,
 year INT NOT NULL,
 annual_limit DECIMAL(10,2) NOT NULL DEFAULT 500.00,
 amount_used DECIMAL(10,2) NOT NULL DEFAULT 0.00,
 balance DECIMAL(10,2) NOT NULL DEFAULT 500.00,
 created_at VARCHAR(30) NOT NULL,
 updated_at VARCHAR(30) NOT NULL,
 UNIQUE KEY uq_med_user_year (user_id, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hub_medical_claims (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hub_staff_payroll_profiles (
 id VARCHAR(36) PRIMARY KEY,
 user_id VARCHAR(36) NOT NULL UNIQUE,
 ic_no VARCHAR(20) NOT NULL DEFAULT '',
 epf_no VARCHAR(30) NOT NULL DEFAULT '',
 socso_no VARCHAR(30) NOT NULL DEFAULT '',
 income_tax_no VARCHAR(30) NOT NULL DEFAULT '',
 bank_name VARCHAR(60) NOT NULL DEFAULT '',
 bank_acc_no VARCHAR(40) NOT NULL DEFAULT '',
 basic_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
 fixed_allowance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
 travelling_allowance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
 epf_employee_rate DECIMAL(4,2) NOT NULL DEFAULT 11.00,
 epf_employer_rate DECIMAL(4,2) NOT NULL DEFAULT 13.00,
 socso_category VARCHAR(10) NOT NULL DEFAULT 'cat1',
 eis_active INT NOT NULL DEFAULT 1,
 skbbk_active INT NOT NULL DEFAULT 1,
 monthly_pcb DECIMAL(10,2) NOT NULL DEFAULT 0.00,
 other_deductions_json LONGTEXT DEFAULT NULL,
 created_at VARCHAR(30) NOT NULL,
 updated_at VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hub_payroll_runs (
 id VARCHAR(36) PRIMARY KEY,
 `year_month` VARCHAR(7) NOT NULL UNIQUE,
 cutoff_start VARCHAR(10) NOT NULL,
 cutoff_end VARCHAR(10) NOT NULL,
 pay_date VARCHAR(10) NOT NULL,
 total_basic DECIMAL(12,2) NOT NULL DEFAULT 0.00,
 total_allowance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
 total_travelling_allowance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hub_payslips (
 id VARCHAR(36) PRIMARY KEY,
 run_id VARCHAR(36) NOT NULL,
 user_id VARCHAR(36) NOT NULL,
 user_name VARCHAR(120) NOT NULL,
 user_role VARCHAR(16) NOT NULL,
 `year_month` VARCHAR(7) NOT NULL,
 pay_date VARCHAR(10) NOT NULL,
 basic_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
 fixed_allowance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
 travelling_allowance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
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
 created_at VARCHAR(30) NOT NULL,
 UNIQUE KEY uq_payslip_user_month (user_id, `year_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
