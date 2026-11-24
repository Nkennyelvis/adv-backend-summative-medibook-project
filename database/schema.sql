-- MediBook database schema
-- run with: mysql -u root -p < database/schema.sql

CREATE DATABASE IF NOT EXISTS medibook;
USE medibook;

DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS patients;

CREATE TABLE patients (
  patient_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  phone         VARCHAR(20)  NOT NULL,
  date_of_birth DATE         NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (patient_id),
  UNIQUE KEY uq_patients_email (email),
  UNIQUE KEY uq_patients_phone (phone)
);

CREATE TABLE doctors (
  doctor_id        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  full_name        VARCHAR(100)  NOT NULL,
  email            VARCHAR(150)  NOT NULL,
  specialty        VARCHAR(80)   NOT NULL,
  consultation_fee DECIMAL(10,2) NOT NULL,
  room             VARCHAR(10)   NOT NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (doctor_id),
  UNIQUE KEY uq_doctors_email (email),
  CONSTRAINT chk_doctors_fee CHECK (consultation_fee > 0)
);

-- one row per booking. cancelled rows are kept so we have the refund history.
-- active_slot is only filled while the appointment is 'booked', so the UNIQUE key
-- (doctor_id, active_slot) means a doctor can never have two active appointments
-- at the same date/time, but a cancelled slot can be booked again.
CREATE TABLE appointments (
  appointment_id INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  patient_id     INT UNSIGNED  NOT NULL,
  doctor_id      INT UNSIGNED  NOT NULL,
  appt_datetime  DATETIME      NOT NULL,
  status         ENUM('booked','cancelled') NOT NULL DEFAULT 'booked',
  amount_paid    DECIMAL(10,2) NOT NULL,
  booked_on      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at   DATETIME      NULL,
  refund_percent TINYINT UNSIGNED NULL,
  refund_amount  DECIMAL(10,2) NULL,
  active_slot    DATETIME GENERATED ALWAYS AS (IF(status = 'booked', appt_datetime, NULL)) STORED,
  PRIMARY KEY (appointment_id),
  UNIQUE KEY uq_doctor_active_slot (doctor_id, active_slot),
  KEY idx_appt_patient (patient_id),
  KEY idx_appt_doctor_datetime (doctor_id, appt_datetime),
  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES patients (patient_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_appt_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (doctor_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  -- 30 minute slots, first one 09:00, last one 16:30 (ends 17:00)
  CONSTRAINT chk_appt_slot CHECK (
    MINUTE(appt_datetime) IN (0, 30)
    AND SECOND(appt_datetime) = 0
    AND TIME(appt_datetime) BETWEEN '09:00:00' AND '16:30:00'
  ),
  CONSTRAINT chk_appt_amount CHECK (amount_paid >= 0),
  CONSTRAINT chk_appt_refund CHECK (
    (status = 'booked' AND cancelled_at IS NULL AND refund_percent IS NULL AND refund_amount IS NULL)
    OR
    (status = 'cancelled' AND cancelled_at IS NOT NULL AND refund_percent IN (0, 50, 100)
      AND refund_amount BETWEEN 0 AND amount_paid)
  )
);
