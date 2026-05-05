/**
 * seedUsers.mjs
 *
 * Seeds Firestore with 15 realistic demo users so the Discovery feed
 * has people to show during development / testing.
 *
 * Run once:
 *   node scripts/seedUsers.mjs
 *
 * Requires the Firebase JS SDK (already installed as a project dep).
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, setDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            'AIzaSyCNDRrFb7R0G3lukOnORMOj1-6AV8rhOAE',
  authDomain:        'community-app-5a4d1.firebaseapp.com',
  projectId:         'community-app-5a4d1',
  storageBucket:     'community-app-5a4d1.firebasestorage.app',
  databaseURL:       'https://community-app-5a4d1-default-rtdb.firebaseio.com',
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ─── Seed Data ───────────────────────────────────────────────────────────────

const USERS = [
  {
    uid: 'seed_user_01',
    name: 'Priya Sharma',
    age: 24,
    city: 'Bengaluru',
    bio: 'UX designer by day, home chef by night 🍳 Love hiking and discovering hole-in-the-wall cafes.',
    interests: ['Design', 'Cooking', 'Hiking', 'Photography', 'Coffee'],
    lookingFor: ['friends', 'networking'],
    vibeProfile: { energy: 0.7, social: 0.8, adventure: 0.6, aesthetic: 0.9,
      primaryVibes: ['Creative', 'Chill Vibes'], musicTaste: ['Indie', 'Pop'], nightlifeStyle: 'houseparty' },
    profileCompleteness: 85,
  },
  {
    uid: 'seed_user_02',
    name: 'Arjun Mehta',
    age: 26,
    city: 'Mumbai',
    bio: 'Startup founder, cricket obsessive, terrible at cooking but great at ordering food 😂',
    interests: ['Cricket', 'Startups', 'Tech', 'Gaming', 'Travel'],
    lookingFor: ['networking', 'friends'],
    vibeProfile: { energy: 0.9, social: 0.7, adventure: 0.8, aesthetic: 0.5,
      primaryVibes: ['Hustle Mode', 'Energetic'], musicTaste: ['Hip-hop', 'EDM'], nightlifeStyle: 'club' },
    profileCompleteness: 80,
  },
  {
    uid: 'seed_user_03',
    name: 'Meera Nair',
    age: 22,
    city: 'Bengaluru',
    bio: 'Final year CS student 👩‍💻 Building my first SaaS. Always up for a hackathon or board game night.',
    interests: ['Coding', 'Board Games', 'Anime', 'Reading', 'Startups'],
    lookingFor: ['friends', 'networking'],
    vibeProfile: { energy: 0.6, social: 0.65, adventure: 0.5, aesthetic: 0.7,
      primaryVibes: ['Night Owl', 'Creative'], musicTaste: ['Lo-fi', 'Indie'], nightlifeStyle: 'houseparty' },
    profileCompleteness: 75,
  },
  {
    uid: 'seed_user_04',
    name: 'Rohan Kapoor',
    age: 28,
    city: 'Delhi',
    bio: 'Product manager at a fintech. Weekend runner, amateur photographer 📷 Coffee snob, no apologies.',
    interests: ['Running', 'Photography', 'Coffee', 'Tech', 'Finance'],
    lookingFor: ['friends', 'dating'],
    vibeProfile: { energy: 0.75, social: 0.6, adventure: 0.7, aesthetic: 0.8,
      primaryVibes: ['Active', 'Aesthetic Vibes'], musicTaste: ['Jazz', 'Indie'], nightlifeStyle: 'rooftop_bar' },
    profileCompleteness: 90,
  },
  {
    uid: 'seed_user_05',
    name: 'Ananya Krishnan',
    age: 23,
    city: 'Bengaluru',
    bio: 'Dance instructor + Bollywood fanatic 💃 Looking for gym buddies & people to explore Indiranagar with.',
    interests: ['Dance', 'Fitness', 'Movies', 'Travel', 'Music'],
    lookingFor: ['friends', 'events'],
    vibeProfile: { energy: 0.95, social: 0.9, adventure: 0.75, aesthetic: 0.8,
      primaryVibes: ['Energetic', 'Social Butterfly'], musicTaste: ['Bollywood', 'Pop', 'EDM'], nightlifeStyle: 'club' },
    profileCompleteness: 88,
  },
  {
    uid: 'seed_user_06',
    name: 'Kabir Singh',
    age: 27,
    city: 'Hyderabad',
    bio: 'ML engineer. Working on AI art tools. Terrible at small talk but great at deep conversations 🧠',
    interests: ['AI/ML', 'Art', 'Chess', 'Philosophy', 'Coding'],
    lookingFor: ['networking', 'friends'],
    vibeProfile: { energy: 0.4, social: 0.45, adventure: 0.5, aesthetic: 0.85,
      primaryVibes: ['Deep Thinker', 'Night Owl'], musicTaste: ['Classical', 'Ambient', 'Lo-fi'], nightlifeStyle: 'houseparty' },
    profileCompleteness: 72,
  },
  {
    uid: 'seed_user_07',
    name: 'Divya Patel',
    age: 25,
    city: 'Ahmedabad',
    bio: 'Food blogger 🍜 Visited 200+ restaurants in Gujarat. Event organiser, coffee addict, dog mom 🐕',
    interests: ['Food', 'Blogging', 'Events', 'Dogs', 'Coffee'],
    lookingFor: ['friends', 'events', 'networking'],
    vibeProfile: { energy: 0.8, social: 0.95, adventure: 0.7, aesthetic: 0.9,
      primaryVibes: ['Social Butterfly', 'Foodie'], musicTaste: ['Pop', 'Bollywood'], nightlifeStyle: 'rooftop_bar' },
    profileCompleteness: 95,
  },
  {
    uid: 'seed_user_08',
    name: 'Nikhil Reddy',
    age: 29,
    city: 'Bengaluru',
    bio: 'SWE at FAANG. Weekend trekker 🏔️ Have done Kedarkantha, Hampta Pass, Kuari Pass. Next: Chadar Trek.',
    interests: ['Trekking', 'Coding', 'Fitness', 'Mountains', 'Travel'],
    lookingFor: ['friends', 'events'],
    vibeProfile: { energy: 0.85, social: 0.6, adventure: 0.98, aesthetic: 0.6,
      primaryVibes: ['Adventure Seeker', 'Active'], musicTaste: ['Rock', 'Folk'], nightlifeStyle: 'houseparty' },
    profileCompleteness: 78,
  },
  {
    uid: 'seed_user_09',
    name: 'Tanvi Joshi',
    age: 21,
    city: 'Pune',
    bio: 'Psych undergrad + aspiring therapist 🌱 Big on journaling, sunset walks and honest conversations.',
    interests: ['Psychology', 'Reading', 'Yoga', 'Art', 'Music'],
    lookingFor: ['friends', 'dating'],
    vibeProfile: { energy: 0.5, social: 0.7, adventure: 0.45, aesthetic: 0.9,
      primaryVibes: ['Chill Vibes', 'Creative'], musicTaste: ['Acoustic', 'Indie', 'Lo-fi'], nightlifeStyle: 'houseparty' },
    profileCompleteness: 82,
  },
  {
    uid: 'seed_user_10',
    name: 'Aditya Bose',
    age: 30,
    city: 'Kolkata',
    bio: 'Journalist @ The Wire. Bookworm, street photographer, terrible chess player trying to improve ♟️',
    interests: ['Writing', 'Photography', 'Chess', 'Books', 'Politics'],
    lookingFor: ['networking', 'friends'],
    vibeProfile: { energy: 0.55, social: 0.65, adventure: 0.6, aesthetic: 0.85,
      primaryVibes: ['Deep Thinker', 'Creative'], musicTaste: ['Classical', 'Jazz', 'Indie'], nightlifeStyle: 'rooftop_bar' },
    profileCompleteness: 88,
  },
  {
    uid: 'seed_user_11',
    name: 'Sneha Gupta',
    age: 24,
    city: 'Bengaluru',
    bio: 'Marketing at a D2C brand. Brunch enthusiast 🥞 Weekend pottery classes and absolutely obsessed with plants 🌿',
    interests: ['Marketing', 'Pottery', 'Plants', 'Brunch', 'Sustainability'],
    lookingFor: ['friends', 'events'],
    vibeProfile: { energy: 0.65, social: 0.85, adventure: 0.55, aesthetic: 0.95,
      primaryVibes: ['Aesthetic Vibes', 'Chill Vibes'], musicTaste: ['Indie', 'Pop', 'Acoustic'], nightlifeStyle: 'rooftop_bar' },
    profileCompleteness: 91,
  },
  {
    uid: 'seed_user_12',
    name: 'Vikram Iyer',
    age: 27,
    city: 'Chennai',
    bio: 'Carnatic musician + software developer. Jam sessions, filter coffee and late night debugging sessions ☕',
    interests: ['Music', 'Coding', 'Coffee', 'Gaming', 'Cooking'],
    lookingFor: ['friends', 'networking'],
    vibeProfile: { energy: 0.6, social: 0.6, adventure: 0.45, aesthetic: 0.75,
      primaryVibes: ['Night Owl', 'Creative'], musicTaste: ['Classical', 'Indie', 'Lo-fi'], nightlifeStyle: 'houseparty' },
    profileCompleteness: 74,
  },
  {
    uid: 'seed_user_13',
    name: 'Ishaan Chaudhary',
    age: 23,
    city: 'Bengaluru',
    bio: 'Comedian + content creator 🎭 3M views on YouTube but still can\'t figure out how to cook rice properly.',
    interests: ['Comedy', 'Content Creation', 'Gaming', 'Movies', 'Food'],
    lookingFor: ['friends', 'events', 'networking'],
    vibeProfile: { energy: 0.9, social: 0.98, adventure: 0.7, aesthetic: 0.65,
      primaryVibes: ['Social Butterfly', 'Energetic'], musicTaste: ['Hip-hop', 'Pop', 'Bollywood'], nightlifeStyle: 'club' },
    profileCompleteness: 86,
  },
  {
    uid: 'seed_user_14',
    name: 'Rhea Fernandes',
    age: 26,
    city: 'Mumbai',
    bio: 'Interior designer 🛋️ Vintage furniture hunter. Love spontaneous road trips and live music gigs.',
    interests: ['Design', 'Travel', 'Music', 'Art', 'Photography'],
    lookingFor: ['friends', 'events', 'dating'],
    vibeProfile: { energy: 0.75, social: 0.75, adventure: 0.8, aesthetic: 0.98,
      primaryVibes: ['Aesthetic Vibes', 'Adventure Seeker'], musicTaste: ['Indie', 'Jazz', 'Acoustic'], nightlifeStyle: 'rooftop_bar' },
    profileCompleteness: 93,
  },
  {
    uid: 'seed_user_15',
    name: 'Ayaan Khan',
    age: 25,
    city: 'Bengaluru',
    bio: 'Backend engineer + competitive gamer 🎮 Play football on weekends, win nothing but have fun.',
    interests: ['Gaming', 'Football', 'Coding', 'Music', 'Anime'],
    lookingFor: ['friends', 'events'],
    vibeProfile: { energy: 0.8, social: 0.7, adventure: 0.65, aesthetic: 0.55,
      primaryVibes: ['Energetic', 'Night Owl'], musicTaste: ['EDM', 'Hip-hop', 'Lo-fi'], nightlifeStyle: 'houseparty' },
    profileCompleteness: 79,
  },
];

// ─── Seed ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`Seeding ${USERS.length} demo users into Firestore…\n`);
  const now = Date.now();

  for (let i = 0; i < USERS.length; i++) {
    const u = USERS[i];
    const docData = {
      ...u,
      phoneNumber:  '',
      isVerified:   false,
      isBanned:     false,
      coins:        100 + Math.floor(Math.random() * 400),
      streak:       { current: Math.floor(Math.random() * 10) + 1, longest: Math.floor(Math.random() * 20) + 5, lastLoginDate: new Date().toISOString().slice(0, 10) },
      // Stagger createdAt so they have unique sort keys
      createdAt:    now - i * 3_600_000,
    };

    await setDoc(doc(db, 'users', u.uid), docData, { merge: true });
    console.log(`  ✓ ${u.name} (${u.city})`);
  }

  console.log('\n✅ Seed complete! Pull-to-refresh the Discovery screen.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err.message ?? err);
  process.exit(1);
});
