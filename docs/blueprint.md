# **App Name**: HarmonyAI

## Core Features:

- User Authentication: Secure sign-up, login, and session management using Firebase Authentication to manage user access.
- Profile Management: Users can view and edit their profile, including a photo, name, short bio, and verification status. Profile data is stored in Firebase Firestore.
- AI Personality Interview: An interactive chat tool where users converse with an AI to analyze their personality and communication style, generating insights for matching.
- Match Discovery & Display: Displays a curated list and grid preview of potential matches based on AI-driven insights and user preferences. Match data is managed in Firestore.
- Real-time Messaging: Allows verified users to engage in real-time chat with their matches using a messenger-style UI, powered by Firebase Firestore's live listeners.
- Identity Verification: A system for users to upload identification documents and a selfie. Files are stored securely in Firebase Storage, and verification status is tracked in Firestore.
- Secure Access Control: Protects routes and features (like messaging) by restricting access based on user authentication and identity verification status, showing lock screens where applicable.

## Style Guidelines:

- The primary brand color, a calm and modern violet, evoking connection and trust: #9066CC.
- A soft, barely-there background color with a hint of the primary hue, promoting a clean and minimalist aesthetic: #FAF9FB.
- An analogous accent color, a gentle blue-violet, for interactive elements and highlights to add depth and clarity: #939AEB.
- Verification status indicators: Verified users are shown with a friendly green (#38B038), and unverified users with a warm, encouraging orange (#E09933).
- Body and headline font: 'Inter' (sans-serif) for a modern, objective, and highly readable textual experience consistent across all content.
- Use a consistent set of minimalist, outline-style icons across the application for clear visual communication, reinforcing the clean aesthetic.
- A mobile-first, vertical layout featuring generously rounded cards and soft shadows to create a friendly, contemporary interface with clean spacing.
- Incorporate subtle hover animations on interactive elements and smooth transitions for page navigation to enhance the user experience without distraction.