import * as admin from 'firebase-admin';

// Initialise the Admin SDK once (Next.js hot-reload safe)
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // Private key stored in env with literal \n — convert to real newlines
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    // Fallback: use Application Default Credentials (e.g. GCP / Cloud Run)
    admin.initializeApp();
  }
}

export { admin };

/**
 * Verify a Firebase ID token from an Authorization header.
 * Returns the decoded token or throws if invalid/missing.
 */
export async function verifyIdToken(request: Request): Promise<admin.auth.DecodedIdToken> {
  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or malformed Authorization header');
  }
  const idToken = authHeader.slice(7);
  return admin.auth().verifyIdToken(idToken);
}
