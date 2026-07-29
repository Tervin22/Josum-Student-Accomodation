# Staff Accounts

Staff users sign in from the public login page by choosing **Staff Login**.

## Roles

- `MANAGER`: application review, student records, maintenance workflow, and room operations.
- `SECURITY`: staff dashboard access focused on room visibility.
- `TECHNICIAN`: maintenance workflow and room visibility.
- `ADMINISTRATOR`: created separately through the first-administrator bootstrap flow.

## Registration

Managers, security staff, and technicians can create their own account from:

`/login?portal=admin`

Open **Staff Login**, then choose **Create manager, security, or technician**.

Registration requires the matching environment key:

- `STAFF_MANAGER_REGISTRATION_KEY`
- `STAFF_SECURITY_REGISTRATION_KEY`
- `STAFF_TECHNICIAN_REGISTRATION_KEY`

The backend rejects staff registration when the key is missing or incorrect. Set these in `.env.local` for local testing and in the production environment before deployment, then restart the API.

## Login

After registration, staff use the same **Staff Login** form. Managers, security staff, technicians, and administrators are all routed to the operational dashboard.
