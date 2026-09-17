// src/auth-helper.js - Graviton V2.0.0 Ecosystem & Google Account Credentials Helper
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';

export async function getGoogleOAuthAccessToken() {
  const adcPath = path.join(os.homedir(), 'AppData', 'Roaming', 'gcloud', 'application_default_credentials.json');
  if (!fs.existsSync(adcPath)) {
    return null;
  }

  try {
    const creds = JSON.parse(fs.readFileSync(adcPath, 'utf8'));
    if (!creds.refresh_token) return null;

    const postData = new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: 'refresh_token'
    }).toString();

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.access_token) {
              resolve({
                token: data.access_token,
                projectId: creds.quota_project_id || 'stitch-project-508504'
              });
            } else {
              resolve(null);
            }
          } catch(e) {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.write(postData);
      req.end();
    });
  } catch (e) {
    return null;
  }
}
