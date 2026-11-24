-- MediBook sample data
-- run after schema.sql: mysql -u root -p < database/seed.sql
-- dates are relative to today so the data always has upcoming appointments.

USE medibook;

INSERT INTO patients (full_name, email, phone, date_of_birth) VALUES
  ('Ama Mensah',     'ama@mail.com',     '0244-111-222', '1994-03-12'),
  ('Kojo Owusu',     'kojo@mail.com',    '0555-333-444', '1988-11-02'),
  ('Akosua Darko',   'akosua@mail.com',  '0244-555-666', '2001-06-25'),
  ('Kofi Appiah',    'kofi@mail.com',    '0201-777-888', '1979-01-30'),
  ('Esi Ofori',      'esi@mail.com',     '0277-999-000', '1996-09-14'),
  ('Yaw Boadu',      'yaw@mail.com',     '0243-121-343', '1990-12-01'),
  ('Abena Sarpong',  'abena@mail.com',   '0554-565-787', '1985-04-18'),
  ('Kwesi Amoah',    'kwesi@mail.com',   '0209-989-101', '2003-02-07'),
  ('Adwoa Nyarko',   'adwoa@mail.com',   '0246-232-454', '1999-07-21'),
  ('Kwabena Ansah',  'kwabena@mail.com', '0501-676-898', '1972-10-09'),
  ('Afia Kyei',      'afia@mail.com',    '0248-343-565', '1993-05-03'),
  ('Nana Osei',      'nana@mail.com',    '0262-787-909', '1981-08-27');

INSERT INTO doctors (full_name, email, specialty, consultation_fee, room) VALUES
  ('Dr. Kwame Boateng', 'boateng@medibook.com', 'Dermatology', 150.00, 'R-12'),
  ('Dr. Efua Adjei',    'adjei@medibook.com',   'Paediatrics', 100.00, 'R-03'),
  ('Dr. Yaw Asante',    'asante@medibook.com',  'Cardiology',  200.00, 'R-07');
-- Dr. Asante (id 3) has no appointments on purpose (shows up with 0 in the doctors report)

-- past appointments (from the old spreadsheet)
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid, booked_on) VALUES
  (1, 1, TIMESTAMP(CURDATE() - INTERVAL 10 DAY, '09:00:00'), 150.00, NOW() - INTERVAL 20 DAY),
  (2, 1, TIMESTAMP(CURDATE() - INTERVAL 10 DAY, '09:30:00'), 120.00, NOW() - INTERVAL 19 DAY),
  (1, 2, TIMESTAMP(CURDATE() - INTERVAL 8 DAY,  '10:00:00'), 100.00, NOW() - INTERVAL 18 DAY);

-- upcoming appointments with Dr. Adjei
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid, booked_on) VALUES
  (3, 2, TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '16:00:00'), 100.00, NOW() - INTERVAL 2 DAY),
  (4, 2, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '10:00:00'), 100.00, NOW() - INTERVAL 2 DAY),
  (5, 2, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '10:30:00'), 100.00, NOW() - INTERVAL 1 DAY),
  (6, 2, TIMESTAMP(CURDATE() + INTERVAL 10 DAY, '14:00:00'), 100.00, NOW() - INTERVAL 1 DAY);

-- a cancelled appointment that was refunded 100% (slot is free again)
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, status, amount_paid, booked_on,
                          cancelled_at, refund_percent, refund_amount) VALUES
  (7, 2, TIMESTAMP(CURDATE() + INTERVAL 4 DAY, '11:00:00'), 'cancelled', 100.00, NOW() - INTERVAL 5 DAY,
   NOW() - INTERVAL 1 DAY, 100, 100.00);

-- Dr. Boateng is almost full in 5 days: 11 of 12 slots taken
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid, booked_on) VALUES
  (1,  1, TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '09:00:00'), 150.00, NOW() - INTERVAL 6 DAY),
  (2,  1, TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '09:30:00'), 150.00, NOW() - INTERVAL 6 DAY),
  (3,  1, TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '10:00:00'), 150.00, NOW() - INTERVAL 5 DAY),
  (4,  1, TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '10:30:00'), 150.00, NOW() - INTERVAL 5 DAY),
  (5,  1, TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '11:00:00'), 150.00, NOW() - INTERVAL 4 DAY),
  (6,  1, TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '11:30:00'), 150.00, NOW() - INTERVAL 4 DAY),
  (7,  1, TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '13:00:00'), 150.00, NOW() - INTERVAL 3 DAY),
  (8,  1, TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '13:30:00'), 150.00, NOW() - INTERVAL 3 DAY),
  (9,  1, TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '14:00:00'), 150.00, NOW() - INTERVAL 2 DAY),
  (10, 1, TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '14:30:00'), 150.00, NOW() - INTERVAL 2 DAY),
  (11, 1, TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '15:00:00'), 150.00, NOW() - INTERVAL 1 DAY);
