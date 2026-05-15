# Srinivasa Billing

A professional billing and invoice management system for **Srinivasa Dyeing**.

## 🚀 Deployment

This project is configured for professional deployment using **Render** or **Railway**.

### Deployment Requirements
Since this application uses local JSON files for its database, you **must** use a hosting provider that supports **Persistent Storage**.

### Option 1: Render (Professional Blueprint)
1.  Push your code to GitHub.
2.  In [Render](https://render.com/), click **New** -> **Blueprint**.
3.  Connect this repository.
4.  Render will automatically use the `render.yaml` file to set up the Web Service and the Persistent Disk.
    *   *Note: Persistent disks on Render require a paid plan (~$7/mo).*

### Option 2: Railway
1.  Connect your repo to [Railway.app](https://railway.app/).
2.  Add a **Volume** in the settings.
3.  Set the **Mount Path** to `/app/data`.
4.  This will ensure your invoices and customer data are saved permanently.

## 🛠️ Local Development
1. `npm install`
2. `npm run dev` (Starts frontend and backend)
3. `npm start` (Runs the production server locally)

## 📁 Data Structure
All application data is stored in the `/data` folder:
- `customerdb.json`: Customer records
- `productdb.json`: Product inventory
- `invoicedb.json`: Invoice records and settings
- `/invoices`: Generated PDF and Word reports
