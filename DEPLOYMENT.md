# Deployment Guide: Google Cloud Run & GCP

This full-stack application (**BBMP CivicPulse**) is engineered specifically for **Google Cloud Run** using Node.js, Express, and Vite.

---

## Option 1: Live Deployment (Already Running on Cloud Run!)

In Google AI Studio, this app is **already deployed on Cloud Run**:
- **Shared App URL**: `https://ais-pre-tebxupwvgnrq2qnq77iymp-431187085493.asia-northeast1.run.app`
- **Development App URL**: `https://ais-dev-tebxupwvgnrq2qnq77iymp-431187085493.asia-northeast1.run.app`

### How to share with judges or team members:
1. Click the **Share** button in the top right of the Google AI Studio interface.
2. Select **Public Link** or share with specific Google accounts.
3. Anyone with the link can access the live Cloud Run instance, submit civic grievances, and view the real-time City Command Center!

---

## Option 2: Deploy to Your Own Personal / Enterprise GCP Project

If you want to deploy this repository to your own Google Cloud Platform (GCP) project on Cloud Run:

### Step 1: Install & Initialize Google Cloud SDK
Make sure you have the `gcloud` CLI installed:
```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
```

### Step 2: Enable Required GCP APIs
Enable Cloud Run, Cloud Build, and Artifact Registry:
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

### Step 3: Deploy Directly from Source
Run the one-line deployment command in the project root:
```bash
gcloud run deploy bbmp-civicpulse \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,GEMINI_API_KEY=YOUR_GEMINI_API_KEY"
```

*Notes:*
- **Region**: `asia-south1` (Mumbai) is recommended for lowest latency to Bengaluru, or use any region like `us-central1`.
- **Port**: Cloud Run automatically injects `PORT=8080`, which `server.ts` automatically binds to.
- **Firebase**: The included `firebase-applet-config.json` is packaged inside the container to connect directly to the provisioned Firestore database (`ai-studio-747bd7e8-b744-4616-9b07-f151f70dfc27`).

---

## Option 3: Continuous Deployment via GitHub Actions or Cloud Build

You can automate deployments whenever code is pushed to your GitHub repository:
1. Go to **Google Cloud Console** $\rightarrow$ **Cloud Run** $\rightarrow$ **Create Service**.
2. Select **Continuously deploy from a repository**.
3. Link your GitHub repository and select the `Dockerfile` build method.
4. Add `GEMINI_API_KEY` under **Variables & Secrets**.
