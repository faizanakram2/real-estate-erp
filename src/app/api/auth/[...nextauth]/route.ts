import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * @swagger
 * /api/auth/providers:
 *   get:
 *     summary: Get available authentication providers
 *     description: Returns the configured NextAuth authentication providers.
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: Authentication providers retrieved successfully
 *       500:
 *         description: Internal server error
 *
 * /api/auth/csrf:
 *   get:
 *     summary: Get CSRF token
 *     description: Returns a CSRF token required before submitting credentials to NextAuth.
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: CSRF token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 csrfToken:
 *                   type: string
 *                   example: abc123xyz
 *
 * /api/auth/callback/credentials:
 *   post:
 *     summary: Login with email and password
 *     description: |
 *       Authenticates a user using the NextAuth Credentials Provider.
 *
 *       A CSRF token must first be obtained from /api/auth/csrf.
 *
 *       On successful authentication, NextAuth creates a JWT session
 *       and stores it in a session cookie.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - csrfToken
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@devlayers.org
 *               password:
 *                 type: string
 *                 format: password
 *                 example: admin123
 *               csrfToken:
 *                 type: string
 *                 description: CSRF token obtained from /api/auth/csrf
 *               callbackUrl:
 *                 type: string
 *                 example: http://localhost:3000
 *               json:
 *                 type: string
 *                 example: "true"
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *
 * /api/auth/session:
 *   get:
 *     summary: Get current authenticated user session
 *     description: Returns the current NextAuth session.
 *     tags:
 *       - Authentication
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current session retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserSession'
 *
 * /api/auth/signout:
 *   post:
 *     summary: Sign out current user
 *     description: Clears the current NextAuth session.
 *     tags:
 *       - Authentication
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Successfully signed out
 */

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
