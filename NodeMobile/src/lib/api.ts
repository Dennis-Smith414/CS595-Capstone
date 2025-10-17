// src/lib/api.ts
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { API_BASE as ENV_API_BASE, DEV_SERVER_IP } from '@env';

//Detects if the app is running on an emulator
async function isEmulator(): Promise<boolean> {
  try {
    return await DeviceInfo.isEmulator();
  } catch (error) {
    console.warn('[API] Failed to dectect emulator, moving to physical device');
    return false;
  }
}

//Get IP from machine Running Metro Bundler
function getLocalMachineIP(): string | null {
  try {
    const DevServer = require('react-native/Libraries/Core/Devtools/getDevServer');
    const scriptURL = DevServer().url;
    
      if (scriptURL) {
        const match = scriptURL.match('/https?:\/\/([0-9.]+)/');
        if (match && match[1]) {
          return match[1];
        }
    }
  } catch (error) {
    console.error('[API] Could not auto-detect local IP:', error);
  }
  //Fallback to env variable
  return DEV_SERVER_IP || null;
}

//Caller for local IP
async function determineApiBase(): Promise<string> {
 // If ENV_API_BASE is set just use it MANNUAL OVER RIDE HERE
  if (ENV_API_BASE) {
    return ENV_API_BASE;
  }

  // Determine base URL based on environment
  const isRunningOnEmulator = await isEmulator();
  
  if (isRunningOnEmulator) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5100';
    } 
  } else {
    // Hanlde case of physical device
    const localIP = getLocalMachineIP();
    
    if (localIP && __DEV__) {
      console.log(`[API] Detected local machine IP: ${localIP}`);
      return `http://${localIP}:5100`;
    }
    
    if (__DEV__) {
      console.error(
        '[API] Could not detect local machine IP. ' +
        'Add DEV_SERVER_IP to your .env file or set API_BASE manually.\n' +
        'Example: DEV_SERVER_IP=192.168.1.100'
      );
    }
  }
  
  return 'http://10.0.2.2:5100/';
}

if (!ENV_API_BASE) {
  console.error("[boot] ❌ No API_BASE found. Check your .env file path and contents.");
  throw new Error("Missing API_BASE");
}

export const API_BASE = ENV_API_BASE;

export async function fetchRouteList() {
  const res = await fetch(`${API_BASE}/api/routes/list`);
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json.items ?? [];
  } catch {
    throw new Error(`Bad JSON from /routes/list: ${text.slice(0,200)}`);
  }
}

export async function fetchRouteGeo(id: number) {
  const r = await fetch(`${API_BASE}/api/routes/${id}.geojson`);
  if (!r.ok) throw new Error(`geo error ${r.status}`);
  return r.json();
}

export async function fetchUserRoutes(token: string) {
  const res = await fetch(`${API_BASE}/api/users/me/routes`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to load user routes (${res.status})`);
  }

  return res.json();
}


export async function fetchUserWaypoints(token: string) {
  const res = await fetch(`${API_BASE}/api/users/me/waypoints`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to load user waypoints (${res.status})`);
  }

  return res.json();
}

export async function fetchUserComments(token: string) {
  const res = await fetch(`${API_BASE}/api/users/me/comments`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to load user comments (${res.status})`);
  }

  return res.json();
}


export async function fetchCurrentUser(token: string) {
  const res = await fetch(`${API_BASE}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
  const json = await res.json();
  return json.user;
}


