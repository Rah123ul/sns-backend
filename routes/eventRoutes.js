const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Registration = require('../models/Registration');

// GET /api/events — fetch all active events
router.get('/', async (req, res) => {
    try {
        const events = await Event.find({ isActive: true }).sort({ createdAt: -1 });
        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Server error while fetching events' });
    }
});

// POST /api/events/register — register for an event
router.post('/register', async (req, res) => {
    try {
        const { name, email, rollNo, phone, eventId } = req.body;

        // Validate required fields
        if (!name || !email || !rollNo || !phone || !eventId) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Validate phone number (10 digits)
        if (!/^\d{10}$/.test(phone)) {
            return res.status(400).json({ message: 'Please enter a valid 10-digit phone number' });
        }

        // Validate email format
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ message: 'Please enter a valid email address' });
        }

        // Check if event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Create registration
        const registration = new Registration({ name, email, rollNo, phone, eventId });
        await registration.save();

        res.status(201).json({
            message: 'Registration successful! You have been registered for the event.',
            registration,
        });
    } catch (error) {
        // Handle duplicate registration
        if (error.code === 11000) {
            return res.status(409).json({
                message: 'You have already registered for this event with this email address.',
            });
        }

        console.error('Error registering:', error);

        // Mongoose validation error
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({ message: messages.join(', ') });
        }

        res.status(500).json({ message: 'Server error during registration' });
    }
});

module.exports = router;
