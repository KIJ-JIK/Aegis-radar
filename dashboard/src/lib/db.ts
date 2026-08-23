import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface UserScrapeRecord {
  id: string;
  userId: string;
  url: string;
  pageTitle: string;
  scrapedAt: string;
  source: string;
  notices: any[];
  stats?: any;
  rawHtml?: string;
  rawHtmlLines?: number;
  rawHtmlBytes?: number;
  openGraph?: any;
  metaTags?: any;
  jsonLd?: any[];
  wafInfo?: any;
  fullMarkdown?: string;
  contentSections?: any[];
  tables?: any[];
}

// Local fallback paths
const ROOT_DIR = path.join(process.cwd(), '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const USER_HISTORY_FILE = path.join(DATA_DIR, 'user_history.json');

// MongoDB cached client for serverless environments
let cachedMongoClient: any = null;

export function isMongoDBConfigured(): boolean {
  const uri = process.env.MONGODB_URI;
  if (!uri) return false;
  // Ignore placeholder strings
  if (
    uri.includes('<username>') ||
    uri.includes('<password>') ||
    uri.includes('your-') ||
    uri.includes('cluster0.mongodb.net') // Placeholder without cluster hash
  ) {
    return false;
  }
  return true;
}

async function getMongoDB() {
  if (!isMongoDBConfigured()) return null;
  const uri = process.env.MONGODB_URI!;

  try {
    if (!cachedMongoClient) {
      const { MongoClient } = await import('mongodb');
      cachedMongoClient = new MongoClient(uri, {
        serverSelectionTimeoutMS: 4000,
        connectTimeoutMS: 4000
      });
      await cachedMongoClient.connect();
      console.log('[DB] ✅ Connected to MongoDB Atlas');
    }
    return cachedMongoClient.db(process.env.MONGODB_DB_NAME || 'aegis-radar');
  } catch (err: any) {
    console.error('[DB] ⚠️ MongoDB connection error, falling back to local store:', err.message);
    cachedMongoClient = null;
    return null;
  }
}

// Local file helper utilities
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error(`[DB] Error reading ${filePath}:`, err);
  }
  return fallback;
}

function writeJSON(filePath: string, data: any) {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[DB] Error writing ${filePath}:`, err);
  }
}

// --- USER OPERATIONS ---

export async function getUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const db = await getMongoDB();

  if (db) {
    try {
      const user = await db.collection('users').findOne({ email: normalizedEmail });
      if (user) {
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          passwordHash: user.passwordHash,
          createdAt: user.createdAt
        };
      }
      return null;
    } catch (err) {
      console.warn('[DB] MongoDB getUserByEmail failed, checking local:', err);
    }
  }

  // Local fallback
  const users = readJSON<User[]>(USERS_FILE, []);
  return users.find(u => u.email.toLowerCase() === normalizedEmail) || null;
}

export async function getUserById(id: string): Promise<User | null> {
  const db = await getMongoDB();

  if (db) {
    try {
      const { ObjectId } = await import('mongodb');
      try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(id) });
        if (user) {
          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            passwordHash: user.passwordHash,
            createdAt: user.createdAt
          };
        }
      } catch {
        const user = await db.collection('users').findOne({ id });
        if (user) {
          return {
            id: user.id || user._id.toString(),
            name: user.name,
            email: user.email,
            passwordHash: user.passwordHash,
            createdAt: user.createdAt
          };
        }
      }
    } catch (err) {
      console.warn('[DB] MongoDB getUserById failed, checking local:', err);
    }
  }

  // Local fallback
  const users = readJSON<User[]>(USERS_FILE, []);
  return users.find(u => u.id === id) || null;
}

export async function createUser(data: { id?: string; name: string; email: string; passwordHash: string }): Promise<User> {
  const normalizedEmail = data.email.toLowerCase().trim();
  const id = data.id || crypto.randomUUID();
  const now = new Date().toISOString();

  const newUser: User = {
    id,
    name: data.name.trim(),
    email: normalizedEmail,
    passwordHash: data.passwordHash,
    createdAt: now
  };

  const db = await getMongoDB();
  if (db) {
    try {
      await db.collection('users').insertOne({
        ...newUser,
        _id: undefined
      });
      return newUser;
    } catch (err) {
      console.warn('[DB] MongoDB createUser failed, saving to local store:', err);
    }
  }

  // Local fallback
  const users = readJSON<User[]>(USERS_FILE, []);
  users.push(newUser);
  writeJSON(USERS_FILE, users);
  return newUser;
}

// --- USER SCRAPE HISTORY OPERATIONS ---

export async function saveUserScrapeSession(userId: string, sessionData: any): Promise<UserScrapeRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const record: UserScrapeRecord = {
    id,
    userId,
    url: sessionData.url || sessionData.targetUrl || '',
    pageTitle: sessionData.pageTitle || 'Scraped Document Feed',
    scrapedAt: sessionData.scrapedAt || now,
    source: sessionData.source || 'aegis-scraper',
    notices: sessionData.notices || [],
    stats: sessionData.stats || {
      totalNotices: sessionData.notices?.length || 0,
      rawHtmlLines: sessionData.rawHtmlLines || 0,
      rawHtmlBytes: sessionData.rawHtmlBytes || 0
    },
    rawHtml: sessionData.rawHtml || '',
    rawHtmlLines: sessionData.rawHtmlLines || sessionData.stats?.rawHtmlLines || 0,
    rawHtmlBytes: sessionData.rawHtmlBytes || sessionData.stats?.rawHtmlBytes || 0,
    openGraph: sessionData.openGraph || {},
    metaTags: sessionData.metaTags || {},
    jsonLd: sessionData.jsonLd || [],
    wafInfo: sessionData.wafInfo || {},
    fullMarkdown: sessionData.fullMarkdown || '',
    contentSections: sessionData.contentSections || [],
    tables: sessionData.tables || []
  };

  const db = await getMongoDB();
  if (db) {
    try {
      await db.collection('user_history').insertOne(record);
      return record;
    } catch (err) {
      console.warn('[DB] MongoDB saveUserScrapeSession failed, saving to local fallback:', err);
    }
  }

  // Local fallback
  let allHistory = readJSON<UserScrapeRecord[]>(USER_HISTORY_FILE, []);
  
  allHistory = allHistory.filter(
    h => !(h.userId === userId && h.url === record.url && (Date.now() - new Date(h.scrapedAt).getTime()) < 5000)
  );

  allHistory.unshift(record);
  
  // Keep max 25 total records in local fallback cache and strip bulky rawHtml from older sessions
  allHistory = allHistory.slice(0, 25).map((item, idx) => {
    if (idx > 4 && item.rawHtml) {
      const { rawHtml, ...rest } = item;
      return rest;
    }
    return item;
  });

  writeJSON(USER_HISTORY_FILE, allHistory);
  return record;
}

export async function getUserScrapeHistory(userId: string): Promise<UserScrapeRecord[]> {
  const db = await getMongoDB();
  if (db) {
    try {
      const history = await db.collection('user_history')
        .find({ userId })
        .sort({ scrapedAt: -1 })
        .limit(100)
        .toArray();
      
      return history.map((item: any) => ({
        id: item.id || item._id.toString(),
        userId: item.userId,
        url: item.url,
        pageTitle: item.pageTitle,
        scrapedAt: item.scrapedAt,
        source: item.source,
        notices: item.notices || [],
        stats: item.stats || {},
        rawHtml: item.rawHtml || '',
        rawHtmlLines: item.rawHtmlLines || 0,
        rawHtmlBytes: item.rawHtmlBytes || 0,
        openGraph: item.openGraph || {},
        metaTags: item.metaTags || {},
        jsonLd: item.jsonLd || [],
        wafInfo: item.wafInfo || {},
        fullMarkdown: item.fullMarkdown || '',
        contentSections: item.contentSections || [],
        tables: item.tables || []
      }));
    } catch (err) {
      console.warn('[DB] MongoDB getUserScrapeHistory failed, reading local:', err);
    }
  }

  // Local fallback
  const allHistory = readJSON<UserScrapeRecord[]>(USER_HISTORY_FILE, []);
  return allHistory.filter(h => h.userId === userId);
}

export async function deleteUserScrapeSession(userId: string, recordId: string): Promise<boolean> {
  const db = await getMongoDB();
  if (db) {
    try {
      const res = await db.collection('user_history').deleteOne({ userId, id: recordId });
      return res.deletedCount > 0;
    } catch (err) {
      console.warn('[DB] MongoDB delete failed, deleting from local:', err);
    }
  }

  // Local fallback
  const allHistory = readJSON<UserScrapeRecord[]>(USER_HISTORY_FILE, []);
  const filtered = allHistory.filter(h => !(h.userId === userId && h.id === recordId));
  writeJSON(USER_HISTORY_FILE, filtered);
  return true;
}

export async function clearUserScrapeHistory(userId: string): Promise<boolean> {
  const db = await getMongoDB();
  if (db) {
    try {
      await db.collection('user_history').deleteMany({ userId });
      return true;
    } catch (err) {
      console.warn('[DB] MongoDB clear failed, clearing local:', err);
    }
  }

  // Local fallback
  const allHistory = readJSON<UserScrapeRecord[]>(USER_HISTORY_FILE, []);
  const filtered = allHistory.filter(h => h.userId !== userId);
  writeJSON(USER_HISTORY_FILE, filtered);
  return true;
}
