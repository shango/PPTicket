// Web Push for Cloudflare Workers using Web Crypto API

function base64UrlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(pad);
  const raw = atob(padded);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signVapidJwt(audience: string, subject: string, privateKeyBase64: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // web-push generates raw 32-byte private keys — wrap in PKCS8 for import
  const privateKeyBytes = base64UrlToUint8Array(privateKeyBase64);
  const pkcs8Header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8Key = new Uint8Array([...pkcs8Header, ...privateKeyBytes]);

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Key,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format
  const sigArray = new Uint8Array(signature);
  let rawSig: Uint8Array;

  if (sigArray.length === 64) {
    rawSig = sigArray;
  } else {
    // DER format: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
    let offset = 2; // skip 0x30 and length
    offset += 1; // skip 0x02
    const rLen = sigArray[offset++];
    const r = sigArray.slice(offset, offset + rLen);
    offset += rLen;
    offset += 1; // skip 0x02
    const sLen = sigArray[offset++];
    const s = sigArray.slice(offset, offset + sLen);

    rawSig = new Uint8Array(64);
    rawSig.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
    rawSig.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  }

  return `${unsignedToken}.${uint8ArrayToBase64Url(rawSig)}`;
}

async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const clientPublicKeyRaw = base64UrlToUint8Array(p256dhBase64);
  const clientAuth = base64UrlToUint8Array(authBase64);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  ) as CryptoKeyPair;

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKeyRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
    localKeyPair.privateKey,
    256
  );

  // Export local public key
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey) as ArrayBuffer);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF for auth info
  const authInfo = new Uint8Array([
    ...new TextEncoder().encode('WebPush: info\0'),
    ...clientPublicKeyRaw,
    ...localPublicKeyRaw,
  ]);

  const ikm = await hkdf(clientAuth, new Uint8Array(sharedSecret), authInfo, 32);
  const prk = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);

  // Encrypt with AES-128-GCM
  const paddedPayload = new Uint8Array([...new Uint8Array([0, 0]), ...new TextEncoder().encode(payload)]);

  const key = await crypto.subtle.importKey('raw', prk, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    paddedPayload
  );

  // Build aes128gcm content: salt(16) + rs(4) + idLen(1) + keyId(65) + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);

  const result = new Uint8Array([
    ...salt,
    ...rs,
    localPublicKeyRaw.length,
    ...localPublicKeyRaw,
    ...new Uint8Array(encrypted),
  ]);

  return { ciphertext: result, salt, localPublicKey: localPublicKeyRaw };
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm));
  const prkKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const infoAndOne = new Uint8Array([...info, 1]);
  const output = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, infoAndOne));
  return output.slice(0, length);
}

export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const jwt = await signVapidJwt(audience, 'mailto:noreply@pre-pro.cc', vapidPrivateKey);
    const { ciphertext } = await encryptPayload(JSON.stringify(payload), subscription.p256dh, subscription.auth);

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
      },
      body: ciphertext,
    });

    // 410 Gone or 404 means subscription expired — should be cleaned up
    if (response.status === 410 || response.status === 404) {
      return false; // caller should delete this subscription
    }

    return response.ok;
  } catch (e) {
    console.error('Push send failed:', e);
    return false;
  }
}

export async function sendPushToUser(
  db: D1Database,
  userId: string,
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<void> {
  const subs = await db.prepare(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?'
  ).bind(userId).all<{ id: string; endpoint: string; p256dh: string; auth: string }>();

  for (const sub of subs.results) {
    const ok = await sendPushNotification(sub, payload, vapidPublicKey, vapidPrivateKey);
    if (!ok) {
      // Clean up expired subscriptions
      await db.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run();
    }
  }
}

export async function sendPushToUsers(
  db: D1Database,
  userIds: string[],
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<void> {
  for (const userId of userIds) {
    await sendPushToUser(db, userId, payload, vapidPublicKey, vapidPrivateKey);
  }
}
