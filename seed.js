const mongoose = require('mongoose');
require('dotenv').config();
const Event = require('./models/Event');

const seedEvents = [
    {
        title: 'Bhagavad Gita Chinmaya Program',
        month: 'MARCH',
        day: '18',
        time: 'Wednesday · 2:00 PM',
        location: 'NIT Calicut Campus',
        description:
            'The Bhagavad Gita Chinmaya Program is a structured spiritual course by Chinmaya Mission, guiding seekers through timeless teachings of the Bhagavad Gita for self-mastery, inner peace, and purposeful living.',
        tag: 'Spiritual Programme',
        isActive: true,
    },
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing events
        await Event.deleteMany({});
        console.log('🗑️  Cleared existing events');

        // Insert seed data
        const created = await Event.insertMany(seedEvents);
        console.log(`🌱 Seeded ${created.length} event(s):`);
        created.forEach((e) => console.log(`   → ${e.title} (${e._id})`));

        await mongoose.disconnect();
        console.log('✅ Done. MongoDB disconnected.');
    } catch (err) {
        console.error('❌ Seed error:', err.message);
        process.exit(1);
    }
}

seed();
