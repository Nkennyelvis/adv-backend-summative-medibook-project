# MediBook - Clinic Appointment System

This is my backend for the MediBook final assessment. It is made with Node.js, Express, MySQL and Redis.

**Video walkthrough:** (link coming soon)

## What you need
- Node.js
- MySQL 8
- Redis (I used docker for this, there is a `docker-compose.yml` if you want to use it too)

## How to run it

1. Install packages
```
npm install
```

2. Copy `.env.example` to `.env` and put your MySQL password

3. Create the database and add the sample data
```
npm run db:setup
```
(or run `database/schema.sql` and then `database/seed.sql` in MySQL Workbench)

4. Start the API
```
npm start
```

5. In another terminal start the worker (it sends the confirmation messages and handles the waitlist)
```
npm run worker
```

6. Run the tests
```
npm test
```

The API runs on http://localhost:3000

## Database
Schema diagram: `schema-diagram.png`

There are 3 tables: `patients`, `doctors` and `appointments`. A patient can have many appointments and a doctor can have many appointments.

## Endpoints

There is a Postman collection in `postman/MediBook.postman_collection.json` with all the requests (import it in Postman). Run `npm run db:setup` first so the dates match.

**Patients**
- `GET /api/patients`
- `GET /api/patients/:id`
- `POST /api/patients`
- `PATCH /api/patients/:id`
- `DELETE /api/patients/:id`
- `GET /api/patients/:id/appointments`

**Doctors**
- `GET /api/doctors` (can filter with `?specialty=`)
- `GET /api/doctors/:id`
- `POST /api/doctors`
- `PATCH /api/doctors/:id`
- `DELETE /api/doctors/:id`
- `GET /api/doctors/:id/stats`
- `GET /api/doctors/:id/availability?date=2026-12-01`

**Appointments**
- `GET /api/appointments` (filters: `doctor_id`, `patient_id`, `status`, `date`)
- `GET /api/appointments/:id`
- `POST /api/appointments` with `{ "patient_id": 1, "doctor_id": 2, "datetime": "2026-12-01 09:30" }`
- `PATCH /api/appointments/:id/cancel`

**Waitlist**
- `POST /api/waitlist` with `{ "patient_id": 1, "doctor_id": 1, "date": "2026-12-01" }`
- `GET /api/waitlist?doctor_id=1&date=2026-12-01`
- `DELETE /api/waitlist` (same body as POST)

**Reports**
- `GET /api/reports/doctors`
- `GET /api/reports/busy-days`

**Feedback page**
- `GET /feedback` and `GET /feedback?lang=fr`

## My decisions

**Part C - booking and cancelling**
- I used `PATCH /api/appointments/:id/cancel` and not DELETE because the appointment is not really deleted. It is kept so we still have the refund history.
- Booking happens inside a transaction. First I lock the doctor row with `SELECT ... FOR UPDATE`, so if two people book the same doctor at the same time one of them waits. Then I count the doctor's appointments for that day (max 12) and check the slot is free.
- There is also a UNIQUE key on `(doctor_id, active_slot)` in the database. `active_slot` is the appointment time while it is booked and NULL after it is cancelled, so the slot can be booked again. This is the backup if two requests still get through at the same time.
- Refund policy: more than 48 hours = 100%, from 24 to 48 hours (including exactly 24 and exactly 48) = 50%, less than 24 hours = 0%. The server calculates it, not the client.
- The cancellation and the refund are saved in the same transaction, so both happen or neither happens.
- Status codes: 400 for bad input, 404 when something doesn't exist, 409 when the slot is taken or the day is full, 422 when the time breaks a rule (past, outside 09:00-17:00, not on :00 or :30).

**Part D - audit log**
- Every booking and cancellation is added as one JSON line to `logs/audit.log` using `fs/promises` (no Sync functions). The folder is created if it is missing.
- If writing the log fails it only prints an error, so the user's request still works.

**Part E - queues**
- I used BullMQ for the jobs and Redis lists for the waitlist (one list per doctor per day).
- When a booking is made a confirmation job is added. The worker "sends" it by writing the message into the audit log.
- When an appointment is cancelled a job is added and the worker books the first person on the waitlist into the free slot.
- So the patient doesn't get lost if the booking fails: the worker moves them to a "processing" list first (with LMOVE) instead of removing them. If the booking fails they are put back at the front of the line. If the worker crashes, they are put back when it starts again. If the patient was deleted they go to a `waitlist:failed` list.
- If Redis is down, booking still works (the notification just isn't queued) and the waitlist endpoints return 503.
